const express = require('express');
const { body, param } = require('express-validator');
const friendsController = require('./friends.controller');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get friends list
router.get('/', friendsController.getFriends);

// Get pending requests
router.get('/pending', friendsController.getPendingRequests);

// Send friend request
router.post(
  '/request',
  [
    body('addresseeId')
      .notEmpty()
      .withMessage('Addressee ID is required')
      .isMongoId()
      .withMessage('Invalid addressee ID')
  ],
  validate,
  friendsController.sendFriendRequest
);

// Accept friend request
router.put(
  '/accept/:friendshipId',
  [
    param('friendshipId')
      .isUUID()
      .withMessage('Invalid friendship ID')
  ],
  validate,
  friendsController.acceptFriendRequest
);

// Reject friend request
router.put(
  '/reject/:friendshipId',
  [
    param('friendshipId')
      .isUUID()
      .withMessage('Invalid friendship ID')
  ],
  validate,
  friendsController.rejectFriendRequest
);

// Remove friend
router.delete(
  '/:friendshipId',
  [
    param('friendshipId')
      .isUUID()
      .withMessage('Invalid friendship ID')
  ],
  validate,
  friendsController.removeFriend
);

module.exports = router;
