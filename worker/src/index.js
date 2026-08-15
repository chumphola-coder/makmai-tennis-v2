// Cloudflare Worker: exchange a LINE Login authorization code for a Firebase custom token.
// Flow: frontend sends { code, redirectUri } -> we exchange with LINE, verify the id_token,
// then mint a Firebase custom token (uid = "line:<lineUserId>") signed with the service account key.

function corsHeaders(origin, allowed) {
  const allowOrigin = allowed === '*' || allowed === origin ? (allowed === '*' ? '*' : origin) : allowed;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
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

async function mintFirebaseToken(uid, saEmail, saPrivateKey, extraClaims) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: saEmail,
    sub: saEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  };
  if (extraClaims && Object.keys(extraClaims).length) payload.claims = extraClaims;

  const signingInput = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(payload))}`;
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const { code, redirectUri } = await request.json();
      if (!code || !redirectUri) {
        return new Response(JSON.stringify({ error: 'missing_code_or_redirect' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

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
      if (!tokenRes.ok || !tokenJson.id_token) {
        return new Response(JSON.stringify({ error: 'line_token_exchange_failed', detail: tokenJson }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // 2) Verify id_token with LINE and read the profile.
      const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: tokenJson.id_token, client_id: env.LINE_CHANNEL_ID }),
      });
      const profile = await verifyRes.json();
      if (!verifyRes.ok || !profile.sub) {
        return new Response(JSON.stringify({ error: 'line_verify_failed', detail: profile }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // 3) Mint a Firebase custom token bound to the LINE user id.
      const uid = `line:${profile.sub}`;
      const firebaseToken = await mintFirebaseToken(
        uid,
        env.FIREBASE_SA_EMAIL,
        env.FIREBASE_SA_PRIVATE_KEY,
        { provider: 'line' }
      );

      return new Response(
        JSON.stringify({
          firebaseToken,
          uid,
          displayName: profile.name || '',
          picture: profile.picture || '',
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: 'server_error', detail: String(err) }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
