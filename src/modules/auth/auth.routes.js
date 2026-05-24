const express = require('express');
const { body } = require('express-validator');
const authController = require('./auth.controller');
const { protect } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');
const validate = require('../../middleware/validate');

const router = express.Router();

// Google Sign-In
router.post(
  '/google',
  authLimiter,
  [
    body('idToken')
      .notEmpty()
      .withMessage('ID token is required')
      .isString()
      .withMessage('ID token must be a string')
  ],
  validate,
  authController.googleSignIn
);

// Refresh token
router.post(
  '/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  validate,
  authController.refreshToken
);

// Get current user
router.get('/me', protect, authController.getMe);

// Logout
router.post('/logout', protect, authController.logout);

module.exports = router;
