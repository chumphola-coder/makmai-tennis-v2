// Public client configuration (safe to commit — these are not secrets).
// Fill each REPLACE_... value after creating the accounts in SETUP.md.
window.APP_CONFIG = {
  // Firebase Web config (Firebase console > Project settings > Your apps > Web app)
  firebase: {
    apiKey: "REPLACE_firebase_apiKey",
    authDomain: "REPLACE_project.firebaseapp.com",
    projectId: "REPLACE_project_id",
    storageBucket: "REPLACE_project.appspot.com",
    messagingSenderId: "REPLACE_sender_id",
    appId: "REPLACE_app_id",
  },

  // LINE Login channel (LINE Developers console > your Login channel)
  lineChannelId: "REPLACE_LINE_LOGIN_CHANNEL_ID",

  // The exact page URL registered as the LINE callback (must match GitHub Pages URL).
  // Leave empty to auto-use the current page origin + path.
  lineRedirectUri: "",

  // Deployed Cloudflare Worker URL (e.g. https://makmai-line-auth.<subdomain>.workers.dev)
  authWorkerUrl: "REPLACE_https://your-worker.workers.dev",
};
