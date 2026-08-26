// Cloudflare Worker for makmai-tennis-v2.
//
// Route "/" or "/auth" (POST): exchange a LINE Login authorization code for a Firebase
//   custom token. Frontend sends { code, redirectUri } -> we exchange with LINE, verify
//   the id_token, then mint a Firebase custom token (uid = "line:<lineUserId>").
//
// Route "/notify" (POST): send a LINE push message to a resident when admin confirms a
//   booking's payment. Requires the caller to present a valid Firebase ID token for an
//   account listed in the /admins collection — verified server-side so this can't be
//   abused to spam arbitrary LINE users from the browser console.

import { importX509, jwtVerify } from 'jose';

function corsHeaders(origin, allowed) {
  const allowOrigin = allowed === '*' || allowed === origin ? (allowed === '*' ? '*' : origin) : allowed;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body, status, cors) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function b64url(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromString(str) {
  return b64url(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function signServiceAccountJWT(claims, saPrivateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(saPrivateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

async function mintFirebaseToken(uid, saEmail, saPrivateKey, extraClaims) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: saEmail,
    sub: saEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  };
  if (extraClaims && Object.keys(extraClaims).length) payload.claims = extraClaims;
  return signServiceAccountJWT(payload, saPrivateKey);
}

// Exchange the service account's identity for a short-lived Google OAuth2 access token,
// used to call the Firestore REST API (to check the caller is a real admin).
async function getGoogleAccessToken(scope, saEmail, saPrivateKey) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signServiceAccountJWT(
    {
      iss: saEmail,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    saPrivateKey
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error('google_oauth_failed: ' + JSON.stringify(json));
  return json.access_token;
}

// Verify a Firebase ID token (signature + issuer + audience + expiry) using Google's
// public certs, and return the verified uid (payload.sub).
async function verifyFirebaseIdToken(idToken, projectId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed_id_token');
  const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));

  const certsRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  const certs = await certsRes.json();
  const pem = certs[header.kid];
  if (!pem) throw new Error('unknown_kid');

  const publicKey = await importX509(pem, 'RS256');
  const { payload } = await jwtVerify(idToken, publicKey, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  return payload.sub;
}

async function isAdminUid(uid, projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.status === 200;
}

async function getResidentDoc(uid, projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/residents/${encodeURIComponent(uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status !== 200) return null;
  const doc = await res.json();
  const f = doc.fields || {};
  return {
    houseNumber: f.houseNumber?.stringValue || '',
    ownerName: f.ownerName?.stringValue || '',
    displayName: f.displayName?.stringValue || '',
  };
}

async function listAdminUids(projectId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins?pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.documents || []).map((d) => d.name.split('/').pop());
}

async function pushLineMessage(lineUserId, text, channelAccessToken) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channelAccessToken}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function handleAuth(request, env, cors) {
  const { code, redirectUri } = await request.json();
  if (!code || !redirectUri) return jsonResponse({ error: 'missing_code_or_redirect' }, 400, cors);

  // 1) Exchange authorization code for LINE tokens.
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.LINE_CHANNEL_ID,
      client_secret: env.LINE_CHANNEL_SECRET,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.id_token) return jsonResponse({ error: 'line_token_exchange_failed', detail: tokenJson }, 401, cors);

  // 2) Verify id_token with LINE and read the profile.
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: tokenJson.id_token, client_id: env.LINE_CHANNEL_ID }),
  });
  const profile = await verifyRes.json();
  if (!verifyRes.ok || !profile.sub) return jsonResponse({ error: 'line_verify_failed', detail: profile }, 401, cors);

  // 3) Mint a Firebase custom token bound to the LINE user id.
  const uid = `line:${profile.sub}`;
  const firebaseToken = await mintFirebaseToken(uid, env.FIREBASE_SA_EMAIL, env.FIREBASE_SA_PRIVATE_KEY, { provider: 'line' });

  return jsonResponse({ firebaseToken, uid, displayName: profile.name || '', picture: profile.picture || '' }, 200, cors);
}

async function handleNotify(request, env, cors) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return jsonResponse({ error: 'missing_id_token' }, 401, cors);

  const projectId = env.FIREBASE_PROJECT_ID;
  let callerUid;
  try {
    callerUid = await verifyFirebaseIdToken(idToken, projectId);
  } catch (e) {
    return jsonResponse({ error: 'invalid_id_token', detail: String(e) }, 401, cors);
  }

  const accessToken = await getGoogleAccessToken(
    'https://www.googleapis.com/auth/datastore',
    env.FIREBASE_SA_EMAIL,
    env.FIREBASE_SA_PRIVATE_KEY
  );
  const admin = await isAdminUid(callerUid, projectId, accessToken);
  if (!admin) return jsonResponse({ error: 'not_admin' }, 403, cors);

  const { targetUid, message } = await request.json();
  if (!targetUid || !message) return jsonResponse({ error: 'missing_target_or_message' }, 400, cors);
  if (!targetUid.startsWith('line:')) return jsonResponse({ error: 'target_not_a_line_user' }, 400, cors);
  const lineUserId = targetUid.slice('line:'.length);

  if (!env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) {
    return jsonResponse({ error: 'messaging_not_configured' }, 501, cors);
  }

  const push = await pushLineMessage(lineUserId, message, env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN);
  if (!push.ok) return jsonResponse({ error: 'line_push_failed', status: push.status, detail: push.body }, 502, cors);

  return jsonResponse({ ok: true }, 200, cors);
}

// Called right after a resident submits their house-registration request.
// Any signed-in caller may trigger this (they aren't admin yet), but the message text is
// built entirely server-side from their OWN resident doc — never from client input — so
// this can't be abused to send arbitrary spam text to admins.
async function handleNotifyAdmins(request, env, cors) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return jsonResponse({ error: 'missing_id_token' }, 401, cors);

  const projectId = env.FIREBASE_PROJECT_ID;
  let callerUid;
  try {
    callerUid = await verifyFirebaseIdToken(idToken, projectId);
  } catch (e) {
    return jsonResponse({ error: 'invalid_id_token', detail: String(e) }, 401, cors);
  }

  if (!env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) {
    return jsonResponse({ error: 'messaging_not_configured' }, 501, cors);
  }

  const accessToken = await getGoogleAccessToken(
    'https://www.googleapis.com/auth/datastore',
    env.FIREBASE_SA_EMAIL,
    env.FIREBASE_SA_PRIVATE_KEY
  );

  const resident = await getResidentDoc(callerUid, projectId, accessToken);
  if (!resident) return jsonResponse({ error: 'resident_not_found' }, 404, cors);

  const text = `🔔 มีคำขอลงทะเบียนใหม่\nบ้านเลขที่ ${resident.houseNumber} (${resident.ownerName || resident.displayName || 'ไม่ทราบชื่อ'})\nกรุณาเข้าเว็บเพื่ออนุมัติ`;
  const adminUids = await listAdminUids(projectId, accessToken);
  let sent = 0;
  const results = [];
  for (const uid of adminUids) {
    if (!uid.startsWith('line:')) continue;
    const push = await pushLineMessage(uid.slice('line:'.length), text, env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN);
    if (push.ok) sent++;
    results.push({ uid, status: push.status, detail: push.body });
  }

  return jsonResponse({ ok: true, notified: sent, adminCount: adminUids.length, results }, 200, cors);
}

// TEMP DEBUG — read-only check of whether LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is valid at all
// (doesn't send any message). Remove once the messaging secret is confirmed working.
async function handleDebugLineToken(request, env, cors) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return jsonResponse({ error: 'missing_id_token' }, 401, cors);
  try {
    await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (e) {
    return jsonResponse({ error: 'invalid_id_token', detail: String(e) }, 401, cors);
  }
  if (!env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) return jsonResponse({ error: 'messaging_not_configured' }, 501, cors);

  const res = await fetch('https://api.line.me/v2/bot/info', {
    headers: { Authorization: `Bearer ${env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}` },
  });
  const body = await res.text();
  return jsonResponse({ status: res.status, body }, 200, cors);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = corsHeaders(origin, allowed);
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, cors);

    try {
      if (pathname === '/notify') return await handleNotify(request, env, cors);
      if (pathname === '/notify-admins') return await handleNotifyAdmins(request, env, cors);
      if (pathname === '/debug-line-token') return await handleDebugLineToken(request, env, cors);
      return await handleAuth(request, env, cors);
    } catch (err) {
      return jsonResponse({ error: 'server_error', detail: String(err) }, 500, cors);
    }
  },
};
