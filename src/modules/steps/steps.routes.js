const express = require('express');
const { body, query } = require('express-validator');
const stepsController = require('./steps.controller');
const { protect } = require('../../middleware/auth');
const { stepsLimiter } = require('../../middleware/rateLimit');
const validate = require('../../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Submit steps
router.post(
  '/',
  stepsLimiter,
  [
    body('stepsCount')
      .isInt({ min: 1, max: 100000 })
      .withMessage('Steps count must be between 1 and 100000'),
    body('startTime')
      .notEmpty()
      .withMessage('Start time is required')
      .isISO8601()
      .withMessage('Invalid start time format'),
    body('endTime')
      .notEmpty()
      .withMessage('End time is required')
      .isISO8601()
      .withMessage('Invalid end time format'),
    body('gpsVarianceMeters')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('GPS variance must be a positive number'),
    body('avgSpeedKmh')
      .optional()
      .isFloat({ min: 0, max: 50 })
      .withMessage('Average speed must be between 0 and 50 km/h'),
    body('stepsDistribution')
      .optional()
      .isArray()
      .withMessage('Steps distribution must be an array')
  ],
  validate,
  stepsController.submitSteps
);

// Get today's steps
router.get('/today', stepsController.getTodaySteps);

// Get steps statistics
router.get('/stats', stepsController.getStepsStats);

// Get steps history
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

module.exports = router;
