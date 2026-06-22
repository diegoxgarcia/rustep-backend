const User = require('../../../models/User');
const StepsLog = require('../../../models/StepsLog');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/:id
 * @access  Private
 */
exports.getUserProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-__v');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Get total steps
  const stepsStats = await StepsLog.getUserTotalSteps(user._id, 'valid');

  successResponse(res, {
    user,
    stats: {
      totalSteps: stepsStats.totalSteps,
      totalSessions: stepsStats.totalSessions
    }
  }, 'User profile retrieved successfully');
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
exports.updateProfile = catchAsync(async (req, res, next) => {
  const allowedFields = [
    'displayName',
    'age',
    'gender',
    'city',
    'country',
    'activityCategory',
    'spotifyPlaylistUrl',
    'showSpotifyPlaylist'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  ).select('-__v');

  successResponse(res, { user }, 'Profile updated successfully');
});

/**
 * @desc    Get user statistics
 * @route   GET /api/v1/users/stats
 * @access  Private
 */
exports.getUserStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // Total steps
  const totalStats = await StepsLog.getUserTotalSteps(userId);

  // Valid steps only
  const validStats = await StepsLog.getUserTotalSteps(userId, 'valid');

  // This week's steps
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekSteps = await StepsLog.getStepsByDateRange(userId, startOfWeek, today);
  const weekTotal = weekSteps.reduce((sum, log) => sum + log.stepsCount, 0);

  // Get user for weekly history
  const user = await User.findById(userId);

  successResponse(res, {
    totalSteps: totalStats.totalSteps,
    validSteps: validStats.totalSteps,
    totalSessions: totalStats.totalSessions,
    weeklySteps: weekTotal,
    weeklyHistory: user.weeklyStepsHistory || []
  }, 'User stats retrieved successfully');
});

/**
 * @desc    Search users
 * @route   GET /api/v1/users/search
 * @access  Private
 */
exports.searchUsers = catchAsync(async (req, res, next) => {
  const { query, limit = 20 } = req.query;

  if (!query || query.length < 2) {
    return next(new AppError('Search query must be at least 2 characters', 400));
  }

  const users = await User.find({
    $or: [
      { displayName: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } },
      { friendCode: query.toUpperCase() }
    ],
    accountStatus: 'active'
  })
    .select('displayName email photoUrl city country friendCode')
    .limit(parseInt(limit));

  successResponse(res, { users }, 'Users found');
});

/**
 * @desc    Delete user account
 * @route   DELETE /api/v1/users/account
 * @access  Private
 */
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  // In production, you might want to soft delete or anonymize data
  await User.findByIdAndUpdate(userId, {
    accountStatus: 'banned',
    email: `deleted_${userId}@deleted.com`,
    displayName: 'Deleted User'
  });

  successResponse(res, null, 'Account deleted successfully');
});
