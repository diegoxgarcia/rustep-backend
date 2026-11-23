const express = require('express');
const { body, query } = require('express-validator');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const gameConfig = require('./game.config');
const auth = require('./game.auth.controller');
const game = require('./game.controller');

/**
 * Rustep Run (Unreal desktop game) — mounted at /api/v1/game.
 * New endpoints only; the game reuses the existing /stamina/balance and /auth/refresh.
 */
const router = express.Router();

// ── Browser login (polling) ──────────────────────────────────────────────────
router.post('/auth/start', auth.start);
router.get('/auth/google', auth.google);
router.get('/auth/callback', auth.callback);
router.get('/auth/poll', auth.poll);

// ── Races ────────────────────────────────────────────────────────────────────
router.post(
  '/races',
  protect,
  [
    body('raceId')
      .isString().withMessage('raceId must be a string')
      .matches(/^[A-Za-z0-9-]{8,64}$/).withMessage('raceId must be 8-64 letters, digits or dashes'),
    body('distance')
      .isIn(gameConfig.DISTANCES).withMessage(`distance must be one of ${gameConfig.DISTANCES.join(', ')}`),
    body('finished')
      .isBoolean({ strict: true }).withMessage('finished must be true or false'),
    body('timeSec')
      .optional({ nullable: true })
      .isFloat({ min: 0, max: 86400 }).withMessage('timeSec must be between 0 and 86400'),
    body('coins')
      .optional()
      .isInt({ min: 0, max: 1000000 }).withMessage('coins must be a non-negative integer'),
    body('staminaUsed')
      .isInt({ min: 0, max: 1000000 }).withMessage('staminaUsed must be a non-negative integer')
  ],
  validate,
  game.submitRace
);

// ── Leaderboard ──────────────────────────────────────────────────────────────
router.get(
  '/leaderboard',
  protect,
  [
    query('distance')
      .isIn(gameConfig.DISTANCES).withMessage(`distance must be one of ${gameConfig.DISTANCES.join(', ')}`),
    query('scope')
      .optional()
      .isIn(['global', 'friends']).withMessage('scope must be global or friends'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: gameConfig.leaderboardMaxLimit })
      .withMessage(`limit must be between 1 and ${gameConfig.leaderboardMaxLimit}`)
  ],
  validate,
  game.getLeaderboard
);

module.exports = router;
