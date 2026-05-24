const express = require('express');
const { body, query } = require('express-validator');
const usersController = require('./users.controller');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get user stats
router.get('/stats', usersController.getUserStats);

// Search users
router.get(
  '/search',
  [
    query('query')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2 })
      .withMessage('Search query must be at least 2 characters')
  ],
  validate,
  usersController.searchUsers
);

// Update profile
router.put(
  '/profile',
  [
    body('age').optional().isInt({ min: 13, max: 120 }).withMessage('Age must be between 13 and 120'),
    body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender'),
    body('activityCategory').optional().isIn(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']).withMessage('Invalid activity category')
  ],
  validate,
  usersController.updateProfile
);

// Delete account
router.delete('/account', usersController.deleteAccount);

// Get user profile (must be last to avoid conflicts)
router.get('/:id', usersController.getUserProfile);

module.exports = router;
