const express = require('express');
const { body } = require('express-validator');
const groupsController = require('./groups.controller');
const { protect } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', groupsController.listGroups);
router.get('/mine', groupsController.myGroups);

router.post(
  '/',
  [
    body('name').isString().trim().isLength({ min: 3, max: 100 })
      .withMessage('name must be 3–100 characters'),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('privacy').optional().isIn(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']),
    body('maxMembers').optional().isInt({ min: 2, max: 500 }),
    body('imageUrl').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  groupsController.createGroup,
);

router.post('/:id/join', groupsController.joinGroup);
router.delete('/:id/leave', groupsController.leaveGroup);
router.get('/:id', groupsController.getGroup);

module.exports = router;
