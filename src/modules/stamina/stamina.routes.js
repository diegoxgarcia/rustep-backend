const express = require('express');
const { body, query } = require('express-validator');
const staminaController = require('./stamina.controller');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get balance
router.get('/balance', staminaController.getBalance);

// Get daily summary
router.get('/daily', staminaController.getDailySummary);

// Get statistics
router.get('/stats', staminaController.getStats);

// Get transactions
router.get(
  '/transactions',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
    query('type').optional().isString().withMessage('Type must be a string')
  ],
  validate,
  staminaController.getTransactions
);

// Spend stamina
router.post(
  '/spend',
  [
    body('amount')
      .isInt({ min: 1 })
      .withMessage('Amount must be a positive integer'),
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('referenceId')
      .optional()
      .isString()
      .withMessage('Reference ID must be a string')
  ],
  validate,
  staminaController.spendStamina
);

// ── Donation & recovery (GDD 11.5) ──────────────────────────────

// My recovery state + monthly cap usage
router.get('/recovery', staminaController.getRecovery);

// Activate / renew my recovery state
router.post(
  '/recovery',
  [
    body('reason')
      .isIn(['injured', 'sick', 'hospitalized', 'recovering'])
      .withMessage('reason must be one of: injured, sick, hospitalized, recovering')
  ],
  validate,
  staminaController.startRecovery
);

// End my recovery state
router.delete('/recovery', staminaController.endRecovery);

// Friends currently in recovery who can receive donations
router.get('/recovery/friends', staminaController.getRecoveringFriends);

// Donate stamina to a friend in recovery
router.post(
  '/donate',
  [
    body('toUserId').isString().notEmpty().withMessage('toUserId is required'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer')
  ],
  validate,
  staminaController.donate
);

module.exports = router;
