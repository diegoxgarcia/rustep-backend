/**
 * Settings for the Rustep Run (Unreal) integration. Read straight from the
 * environment so the shared env.config.js stays untouched.
 */
const DISTANCES = ['D3K', 'D5K', 'D10K', 'D21K', 'D42K'];

module.exports = {
  DISTANCES,

  // How long a pending browser login lives (the game gives up polling at 3 min).
  loginTtlSeconds: parseInt(process.env.GAME_LOGIN_TTL_SECONDS, 10) || 300,

  // Must be registered as an "Authorized redirect URI" on the Google Web client
  // (the same client whose ID is GOOGLE_CLIENT_ID). If unset it is derived from
  // the request: https://<host>/api/v1/game/auth/callback
  googleRedirectUri: process.env.GAME_GOOGLE_REDIRECT_URI || null,

  leaderboardDefaultLimit: 50,
  leaderboardMaxLimit: 100
};
