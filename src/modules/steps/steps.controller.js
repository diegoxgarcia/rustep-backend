const StepsLog = require('../../../models/StepsLog');
const User = require('../../../models/User');
const FraudFlag = require('../../../models/FraudFlag');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');
const stepsService = require('./steps.service');

/**
 * @desc    Submit steps session
 * @route   POST /api/v1/steps
 * @access  Private
 */
exports.submitSteps = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const {
    stepsCount,
    startTime,
    endTime,
    gpsVarianceMeters,
    avgSpeedKmh,
    stepsDistribution
  } = req.body;

  // Validate timestamps
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return next(new AppError('End time must be after start time', 400));
  }

  if (end > new Date()) {
    return next(new AppError('End time cannot be in the future', 400));
  }

  // Calculate fraud detection metrics
  const confidenceScore = stepsService.calculateConfidenceScore({
    stepsCount,
    startTime: start,
    endTime: end,
    gpsVarianceMeters,
    avgSpeedKmh,
    stepsDistribution
  });

  const confidenceStatus = stepsService.determineConfidenceStatus(confidenceScore);

  // Create steps log
  const stepsLog = await StepsLog.create({
    userId,
    stepsCount,
    startTime: start,
    endTime: end,
    confidenceScore,
    confidenceStatus,
    gpsVarianceMeters,
    avgSpeedKmh,
    stepsDistribution
  });

  // Update fraud flag stats
  await FraudFlag.updateFraudStats(userId, {
    confidenceScore,
    confidenceStatus
  });

  // Update user's weekly steps
  const weekNumber = stepsService.getWeekNumber(start);
  const year = start.getFullYear();

  await User.findById(userId).then(user => {
    if (user) {
      user.addWeeklySteps(weekNumber, year, stepsCount);
    }
  });

  // Credit stamina if valid
  let staminaCredited = 0;
  if (confidenceStatus === 'valid') {
    staminaCredited = await stepsService.creditStamina(userId, stepsCount, stepsLog._id);
    stepsLog.staminaCredited = staminaCredited;
    stepsLog.staminaCreditedAt = new Date();
    await stepsLog.save();
  }

  successResponse(res, {
    stepsLog: {
      id: stepsLog._id,
      stepsCount: stepsLog.stepsCount,
      confidenceScore: stepsLog.confidenceScore,
      confidenceStatus: stepsLog.confidenceStatus,
      staminaCredited
    }
  }, 'Steps submitted successfully', 201);
});

/**
 * @desc    Get user's steps history
 * @route   GET /api/v1/steps/history
 * @access  Private
 */
exports.getStepsHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { startDate, endDate, limit = 50, page = 1 } = req.query;

  const query = { userId };

  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [stepsLogs, total] = await Promise.all([
    StepsLog.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(skip),
    StepsLog.countDocuments(query)
  ]);

  successResponse(res, {
    stepsLogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  }, 'Steps history retrieved successfully');
});

/**
 * @desc    Get today's steps summary
 * @route   GET /api/v1/steps/today
 * @access  Private
 */
exports.getTodaySteps = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLogs = await StepsLog.find({
    userId,
    startTime: { $gte: today, $lt: tomorrow }
  });

  const totalSteps = todayLogs.reduce((sum, log) => sum + log.stepsCount, 0);
  const validSteps = todayLogs
    .filter(log => log.confidenceStatus === 'valid')
    .reduce((sum, log) => sum + log.stepsCount, 0);

  const totalStamina = todayLogs.reduce((sum, log) => sum + (log.staminaCredited || 0), 0);

  successResponse(res, {
    totalSteps,
    validSteps,
    totalStamina,
    sessionsCount: todayLogs.length,
    sessions: todayLogs
  }, 'Today steps retrieved successfully');
});

/**
 * @desc    Get steps statistics
 * @route   GET /api/v1/steps/stats
 * @access  Private
 */
exports.getStepsStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const stats = await StepsLog.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$confidenceStatus',
        count: { $sum: 1 },
        totalSteps: { $sum: '$stepsCount' }
      }
    }
  ]);

  const formattedStats = {
    valid: { count: 0, totalSteps: 0 },
    suspicious: { count: 0, totalSteps: 0 },
    blocked: { count: 0, totalSteps: 0 }
  };

  stats.forEach(stat => {
    formattedStats[stat._id] = {
      count: stat.count,
      totalSteps: stat.totalSteps
    };
  });

  successResponse(res, { stats: formattedStats }, 'Steps stats retrieved successfully');
});
