const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../../config/env.config');
const gameConfig = require('./game.config');
const User = require('../../../models/User');
const GameLoginSession = require('../../../models/GameLoginSession');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');
const { successResponse } = require('../../utils/response');

/**
 * Browser login for the desktop game (Rustep Run).
 *
 * The game cannot use the Android Credential Manager flow, so it uses the
 * standard OAuth "authorization code" flow in the system browser plus polling:
 *
 *   1. POST /game/auth/start          → { sessionId, pollSecret, loginUrl, expiresIn }
 *   2. game opens loginUrl            → GET /game/auth/google?sid=... → 302 to Google
 *   3. Google redirects back          → GET /game/auth/callback?code&state=sessionId
 *   4. game polls                     → GET /game/auth/poll?sessionId&pollSecret
 *                                       → { status: pending|done|expired|denied, ... }
 *
 * The issued tokens are the exact same JWTs as POST /auth/google, so the game
 * can call the existing endpoints (/stamina/balance, /auth/refresh) unchanged.
 * pollSecret never travels through the browser, so a leaked loginUrl alone
 * cannot be used to collect the tokens.
 */

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const safeEqualHex = (a, b) => {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/** Public base URL of this API as seen by the browser (Render terminates TLS). */
const publicBase = (req) => {
  const proto = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
};

const redirectUri = (req) =>
  gameConfig.googleRedirectUri || `${publicBase(req)}/api/${config.apiVersion}/game/auth/callback`;

const oauthClient = (req) =>
  new OAuth2Client(config.google.clientId, config.google.clientSecret, redirectUri(req));

// Same token shape/secrets/expiry as the app login (auth.controller.js).
const generateToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });

/** Find or create the user exactly like POST /auth/google does. */
const upsertGoogleUser = async ({ sub: googleId, email, name, picture }) => {
  let user = await User.findOne({ googleId });
  if (!user) {
    user = await User.create({ googleId, email, displayName: name, photoUrl: picture });
  } else {
    user.displayName = name;
    user.photoUrl = picture;
    await user.updateLastActive();
  }
  return user;
};

// ── Minimal HTML pages shown in the player's browser ─────────────────────────

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const page = (res, status, title, message) => {
  res.status(status).type('html').send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rustep Run</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0f1115;color:#f2f2f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:420px;padding:32px;text-align:center}
  h1{font-size:22px;margin:0 0 12px;color:#ff7a1a}
  p{margin:0;color:#b8bcc6;line-height:1.5}
</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`);
};

const isLive = (session) => session && session.expiresAt.getTime() > Date.now();

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * @desc    Start a browser login for the game
 * @route   POST /api/v1/game/auth/start
 * @access  Public
 */
exports.start = catchAsync(async (req, res, next) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return next(new AppError('Game login is not configured', 503));
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const pollSecret = crypto.randomBytes(32).toString('hex');
  const expiresIn = gameConfig.loginTtlSeconds;

  await GameLoginSession.create({
    sessionId,
    pollSecretHash: sha256(pollSecret),
    expiresAt: new Date(Date.now() + expiresIn * 1000)
  });

  successResponse(res, {
    sessionId,
    pollSecret,
    loginUrl: `${publicBase(req)}/api/${config.apiVersion}/game/auth/google?sid=${sessionId}`,
    expiresIn
  }, 'Login session created', 201);
});

/**
 * @desc    Redirect the browser to Google's consent screen
 * @route   GET /api/v1/game/auth/google?sid=
 * @access  Public (opened in the player's browser)
 */
exports.google = catchAsync(async (req, res) => {
  const sid = String(req.query.sid || '');
  const session = sid ? await GameLoginSession.findOne({ sessionId: sid }) : null;

  if (!isLive(session) || session.status !== 'pending') {
    return page(res, 410, 'El enlace venció',
      'Volvé a Rustep Run y tocá "Iniciar sesión" otra vez.');
  }

  const url = oauthClient(req).generateAuthUrl({
    scope: GOOGLE_SCOPES,
    state: sid,
    prompt: 'select_account',
    include_granted_scopes: true
  });

  res.redirect(302, url);
});

/**
 * @desc    Google OAuth callback: verify the user and mark the session as done
 * @route   GET /api/v1/game/auth/callback?code&state  (or ?error&state)
 * @access  Public (Google redirects the browser here)
 */
exports.callback = catchAsync(async (req, res) => {
  const sid = String(req.query.state || '');
  const session = sid ? await GameLoginSession.findOne({ sessionId: sid }) : null;

  if (!isLive(session) || session.status !== 'pending') {
    return page(res, 410, 'El enlace venció',
      'Volvé a Rustep Run y tocá "Iniciar sesión" otra vez.');
  }

  if (req.query.error || !req.query.code) {
    session.status = 'denied';
    await session.save();
    return page(res, 200, 'Inicio de sesión cancelado',
      'No se conectó tu cuenta. Podés cerrar esta pestaña y volver a Rustep Run.');
  }

  try {
    const client = oauthClient(req);
    const { tokens } = await client.getToken(String(req.query.code));
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId
    });
    const user = await upsertGoogleUser(ticket.getPayload());

    session.status = 'done';
    session.userId = user._id;
    await session.save();

    return page(res, 200, '¡Listo!',
      `Iniciaste sesión como ${user.displayName}. Ya podés cerrar esta pestaña y volver a Rustep Run.`);
  } catch (err) {
    logger.error(`Game login callback failed: ${err.message}`);
    return page(res, 500, 'No pudimos iniciar sesión',
      'Ocurrió un error con Google. Volvé a Rustep Run e intentá de nuevo.');
  }
});

/**
 * @desc    Poll a login session. Always 200 with a status the game can switch on.
 *          "done" is delivered once: the session is deleted when the tokens are minted.
 * @route   GET /api/v1/game/auth/poll?sessionId&pollSecret
 * @access  Public (pollSecret required)
 */
exports.poll = catchAsync(async (req, res) => {
  const sessionId = String(req.query.sessionId || '');
  const pollSecret = String(req.query.pollSecret || '');

  const session = sessionId ? await GameLoginSession.findOne({ sessionId }) : null;

  // Unknown, expired or wrong secret all look the same to the caller.
  if (!isLive(session) || !/^[0-9a-f]{64}$/.test(pollSecret) ||
      !safeEqualHex(sha256(pollSecret), session.pollSecretHash)) {
    return successResponse(res, { status: 'expired' }, 'Login session expired');
  }

  if (session.status === 'pending') {
    return successResponse(res, { status: 'pending' }, 'Waiting for the browser');
  }

  if (session.status === 'denied') {
    await GameLoginSession.deleteOne({ _id: session._id });
    return successResponse(res, { status: 'denied' }, 'Login cancelled');
  }

  // status === 'done' — claim it atomically so the tokens are handed out only once.
  const claimed = await GameLoginSession.findOneAndDelete({ _id: session._id, status: 'done' });
  if (!claimed) {
    return successResponse(res, { status: 'expired' }, 'Login session expired');
  }

  const user = await User.findById(claimed.userId);
  if (!user) {
    return successResponse(res, { status: 'expired' }, 'Login session expired');
  }

  successResponse(res, {
    status: 'done',
    token: generateToken(user._id),
    refreshToken: generateRefreshToken(user._id),
    user: {
      id: user._id,
      displayName: user.displayName,
      photoUrl: user.photoUrl
    }
  }, 'Authentication successful');
});
