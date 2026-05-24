const express = require('express');
const { param, query } = require('express-validator');
const rankingsController = require('./rankings.controller');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get weekly rankings
router.get(
  '/weekly/:category',
  [
    param('category')
      .isIn(['WEEKLY_STEPS', 'WEEKLY_STAMINA', 'WEEKLY_SESSIONS', 'ALL_TIME_STEPS'])
      .withMessage('Invalid category'),
    query('weekNumber')
      .optional()
      .isInt({ min: 1, max: 53 })
      .withMessage('Week number must be between 1 and 53'),
    query('year')
      .optional()
      .isInt({ min: 2020, max: 2100 })
      .withMessage('Invalid year'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000')
  ],
  validate,
  rankingsController.getWeeklyRankings
);

// Get user's position
router.get(
  '/my-position/:category',
  [
    param('category')
      .isIn(['WEEKLY_STEPS', 'WEEKLY_STAMINA', 'WEEKLY_SESSIONS', 'ALL_TIME_STEPS'])
      .withMessage('Invalid category'),
    query('weekNumber')
      .optional()
      .isInt({ min: 1, max: 53 })
      .withMessage('Week number must be between 1 and 53'),
    query('year')
      .optional()
      .isInt({ min: 2020, max: 2100 })
      .withMessage('Invalid year')
  ],
  validate,
  rankingsController.getMyPosition
);

// Get friends rankings
router.get(
  '/friends/:category',
  [
    param('category')
      .isIn(['WEEKLY_STEPS', 'WEEKLY_STAMINA', 'WEEKLY_SESSIONS', 'ALL_TIME_STEPS'])
      .withMessage('Invalid category'),
    query('weekNumber')
      .optional()
      .isInt({ min: 1, max: 53 })
      .withMessage('Week number must be between 1 and 53'),
    query('year')
      .optional()
      .isInt({ min: 2020, max: 2100 })
      .withMessage('Invalid year')
  ],
  validate,
  rankingsController.getFriendsRankings
);

module.exports = router;
