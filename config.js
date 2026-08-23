// Public client configuration (safe to commit — these are not secrets).
// Fill each REPLACE_... value after creating the accounts in SETUP.md.
window.APP_CONFIG = {
  // Firebase Web config (Firebase console > Project settings > Your apps > Web app)
  firebase: {
    apiKey: "AIzaSyBBsvn6fheatdQ3SUlT2PjhGHFUW5u4dV0",
    authDomain: "makmai-tennis-v2.firebaseapp.com",
    projectId: "makmai-tennis-v2",
    storageBucket: "makmai-tennis-v2.firebasestorage.app",
    messagingSenderId: "426185473483",
    appId: "1:426185473483:web:907df48354da587f834a4e",
  },

  // LINE Login channel (LINE Developers console > your Login channel)
  lineChannelId: "2011217015",

  // The exact page URL registered as the LINE callback (must match GitHub Pages URL).
  // Leave empty to auto-use the current page origin + path.
  lineRedirectUri: "https://chumphola-coder.github.io/makmai-tennis-v2/",

  // Deployed Cloudflare Worker URL (e.g. https://makmai-line-auth.<subdomain>.workers.dev)
  authWorkerUrl: "https://makmai-line-auth.chumphola.workers.dev",
};
