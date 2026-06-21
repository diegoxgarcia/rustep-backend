const express = require('express');
const { body, query } = require('express-validator');
const stepsController = require('./steps.controller');
const { protect } = require('../../middleware/auth');
const { stepsLimiter } = require('../../middleware/rateLimit');
const validate = require('../../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ── Batch sync (mobile primary endpoint) ──────────────────────────────────
router.post(
  '/sync',
  stepsLimiter,
  [
    body('sessions')
      .isArray({ min: 1, max: 50 })
      .withMessage('sessions must be an array of 1–50 items'),
    body('sessions.*.stepsCount')
      .isInt({ min: 1, max: 100000 })
      .withMessage('Each session stepsCount must be between 1 and 100000'),
    body('sessions.*.startTime')
      .notEmpty().withMessage('startTime is required')
      .isISO8601().withMessage('startTime must be ISO8601'),
    body('sessions.*.endTime')
      .notEmpty().withMessage('endTime is required')
      .isISO8601().withMessage('endTime must be ISO8601'),
    body('sessions.*.gpsPoints')
      .optional().isArray().withMessage('gpsPoints must be an array'),
    body('sessions.*.avgSpeedKmh')
      .optional().isFloat({ min: 0, max: 50 })
      .withMessage('avgSpeedKmh must be between 0 and 50'),
    body('sessions.*.gpsVarianceMeters')
      .optional().isFloat({ min: 0 })
      .withMessage('gpsVarianceMeters must be positive'),
    body('sessions.*.stepsDistribution')
      .optional().isArray()
      .withMessage('stepsDistribution must be an array')
  ],
  validate,
  stepsController.syncSteps
);

// ── Daily totals (mobile primary endpoint — Health Connect daily aggregates) ──
router.post(
  '/daily',
  stepsLimiter,
  [
    body('days')
      .isArray({ min: 1, max: 31 })
      .withMessage('days must be an array of 1–31 items'),
    body('days.*.date')
      .notEmpty().withMessage('date is required')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
    body('days.*.steps')
      .isInt({ min: 0, max: 100000 })
      .withMessage('Each day steps must be between 0 and 100000')
  ],
  validate,
  stepsController.syncDailySteps
);

// ── Weekly summary (mobile home screen flower widget) ─────────────────────
router.get('/weekly-summary', stepsController.getWeeklySummary);

// ── Today summary ─────────────────────────────────────────────────────────
router.get('/today', stepsController.getTodaySteps);

// ── Stats ─────────────────────────────────────────────────────────────────
router.get('/stats', stepsController.getStepsStats);

// ── History (paginated) ───────────────────────────────────────────────────
router.get(
  '/history',
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1')
  ],
  validate,
  stepsController.getStepsHistory
);

// ── Single session (legacy / backward compat) ─────────────────────────────
router.post(
  '/',
  stepsLimiter,
  [
    body('stepsCount')
      .isInt({ min: 1, max: 100000 })
      .withMessage('Steps count must be between 1 and 100000'),
    body('startTime')
      .notEmpty().withMessage('Start time is required')
      .isISO8601().withMessage('Invalid start time format'),
    body('endTime')
      .notEmpty().withMessage('End time is required')
      .isISO8601().withMessage('Invalid end time format'),
    body('gpsVarianceMeters')
      .optional().isFloat({ min: 0 })
      .withMessage('GPS variance must be a positive number'),
    body('avgSpeedKmh')
      .optional().isFloat({ min: 0, max: 50 })
      .withMessage('Average speed must be between 0 and 50 km/h'),
    body('stepsDistribution')
      .optional().isArray()
      .withMessage('Steps distribution must be an array')
  ],
  validate,
  stepsController.submitSteps
);

module.exports = router;
