const StepsLog = require('../../../models/StepsLog');
const User = require('../../../models/User');
const FraudFlag = require('../../../models/FraudFlag');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');
const stepsService = require('./steps.service');

// ─────────────────────────────────────────────────────────────
// Internal helper: process a single session and return result
// ─────────────────────────────────────────────────────────────
async function processSession(userId, sessionData) {
  const {
    stepsCount,
    startTime,
    endTime,
    gpsVarianceMeters,
    avgSpeedKmh,
    stepsDistribution,
    gpsPoints, // from mobile Health Connect — optional
  } = sessionData;

  const start = new Date(startTime);
  const end   = new Date(endTime);

  // Basic timestamp sanity checks
  if (isNaN(start) || isNaN(end))    return { skipped: true, reason: 'INVALID_TIMESTAMPS' };
  if (start >= end)                  return { skipped: true, reason: 'START_AFTER_END' };
  if (end > new Date())              return { skipped: true, reason: 'FUTURE_SESSION' };

  // Derive GPS metrics from gpsPoints if not pre-computed
  let resolvedVariance = gpsVarianceMeters;
  let resolvedSpeed    = avgSpeedKmh;
  if (gpsPoints && gpsPoints.length >= 2 && (resolvedVariance == null || resolvedSpeed == null)) {
    const derived = stepsService.deriveGpsMetrics(gpsPoints, start, end);
    if (resolvedVariance == null) resolvedVariance = derived.gpsVarianceMeters;
    if (resolvedSpeed    == null) resolvedSpeed    = derived.avgSpeedKmh;
  }

  // Fraud scoring
  const confidenceScore  = stepsService.calculateConfidenceScore({
    stepsCount, startTime: start, endTime: end,
    gpsVarianceMeters: resolvedVariance, avgSpeedKmh: resolvedSpeed, stepsDistribution
  });
  const confidenceStatus = stepsService.determineConfidenceStatus(confidenceScore);

  // Blocked → hard reject, notify user
  if (confidenceStatus === 'blocked') {
    await FraudFlag.updateFraudStats(userId, { confidenceScore, confidenceStatus });
    return { stepsCount, staminaCredited: 0, confidenceStatus, warning: 'SESSION_VALIDATION_FAILED' };
  }

  // Persist session
  const stepsLog = await StepsLog.create({
    userId, stepsCount, startTime: start, endTime: end,
    confidenceScore, confidenceStatus,
    gpsVarianceMeters: resolvedVariance, avgSpeedKmh: resolvedSpeed, stepsDistribution
  });

  // Update fraud stats
  await FraudFlag.updateFraudStats(userId, { confidenceScore, confidenceStatus });

  // Update user weekly history
  const weekNumber = stepsService.getWeekNumber(start);
  const user = await User.findById(userId);
  if (user) await user.addWeeklySteps(weekNumber, start.getFullYear(), stepsCount);

  // Credit stamina (only for valid sessions)
  let staminaCredited = 0;
  if (confidenceStatus === 'valid') {
    staminaCredited = await stepsService.creditStamina(userId, stepsCount, stepsLog._id);
    stepsLog.staminaCredited   = staminaCredited;
    stepsLog.staminaCreditedAt = new Date();
    await stepsLog.save();
  }

  return { stepsCount, staminaCredited, confidenceStatus };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/steps/sync  (batch — used by mobile app)
// Body: { sessions: [{ stepsCount, startTime, endTime, gpsPoints?, gpsVarianceMeters?, avgSpeedKmh?, stepsDistribution? }] }
// ─────────────────────────────────────────────────────────────
exports.syncSteps = catchAsync(async (req, res, next) => {
  const userId   = req.user._id;
  const sessions = req.body.sessions;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return next(new AppError('sessions must be a non-empty array', 400));
  }
  if (sessions.length > 50) {
    return next(new AppError('Maximum 50 sessions per sync request', 400));
  }

  let sessionsProcessed = 0;
  let stepsAccepted     = 0;
  let staminaCredited   = 0;
  const warnings        = [];

  for (const session of sessions) {
    const result = await processSession(userId, session);
    if (result.skipped) continue; // malformed — silently skip

    sessionsProcessed++;
    if (result.warning) {
      warnings.push(result.warning);
    } else {
      stepsAccepted  += result.stepsCount || 0;
      staminaCredited += result.staminaCredited || 0;
    }
  }

  successResponse(res, {
    sessionsProcessed,
    stepsAccepted,
    staminaCredited,
    staminaInQuarantine: 0, // quarantine implemented in Fase 2
    warnings
  }, 'Steps sync completed', 200);
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/steps/daily  (per-day step totals — primary path for the mobile app)
// Body: { days: [{ date: "YYYY-MM-DD", steps: 12546 }] }
// Upserts ONE steps_log per (user, day) and credits stamina only on the positive delta,
// so re-syncing a day as its total grows never duplicates steps or stamina.
// ─────────────────────────────────────────────────────────────
exports.syncDailySteps = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const days = req.body.days;

  if (!Array.isArray(days) || days.length === 0) {
    return next(new AppError('days must be a non-empty array', 400));
  }
  if (days.length > 31) {
    return next(new AppError('Maximum 31 days per request', 400));
  }

  let daysProcessed = 0;
  let stepsAccepted = 0;
  let staminaCredited = 0;
  const warnings = [];

  for (const day of days) {
    const steps = Number(day.steps);
    const dayStart = new Date(`${day.date}T00:00:00.000Z`);

    if (isNaN(dayStart.getTime())) { warnings.push('INVALID_DATE'); continue; }
    if (!Number.isFinite(steps) || steps < 0 || steps > 100000) {
      warnings.push('IMPLAUSIBLE_DAILY_STEPS');
      continue;
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    let log = await StepsLog.findOne({ userId, source: 'daily', startTime: dayStart });
    const oldTotal = log ? log.stepsCount : 0;
    const delta = steps - oldTotal;

    daysProcessed++;
    if (delta <= 0) continue; // nothing new for this day

    if (!log) {
      log = await StepsLog.create({
        userId,
        stepsCount: steps,
        startTime: dayStart,
        endTime: dayEnd,
        confidenceScore: 1,
        confidenceStatus: 'valid',
        source: 'daily'
      });
    } else {
      log.stepsCount = steps;
      await log.save();
    }

    const credited = await stepsService.creditStaminaForDailyDelta(userId, oldTotal, steps, log._id);
    if (credited > 0) {
      log.staminaCredited = (log.staminaCredited || 0) + credited;
      log.staminaCreditedAt = new Date();
      await log.save();
    }

    stepsAccepted += delta;
    staminaCredited += credited;
  }

  successResponse(res, {
    sessionsProcessed: daysProcessed,
    stepsAccepted,
    staminaCredited,
    staminaInQuarantine: 0,
    warnings
  }, 'Daily steps synced', 200);
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/steps  (single session — legacy, kept for compatibility)
// ─────────────────────────────────────────────────────────────
exports.submitSteps = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const result = await processSession(userId, req.body);

  if (result.skipped) {
    return next(new AppError(`Invalid session data: ${result.reason}`, 400));
  }

  successResponse(res, {
    sessionsProcessed: 1,
    stepsAccepted:     result.warning ? 0 : (result.stepsCount || 0),
    staminaCredited:   result.staminaCredited,
    staminaInQuarantine: 0,
    warnings:          result.warning ? [result.warning] : []
  }, 'Steps submitted successfully', 201);
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/steps/weekly-summary
// ─────────────────────────────────────────────────────────────
exports.getWeeklySummary = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const now          = new Date();
  const weekNumber   = stepsService.getWeekNumber(now);
  const year         = now.getFullYear();

  // ISO week: Monday → Sunday
  const dayOfWeek    = now.getUTCDay() || 7; // 1=Mon … 7=Sun
  const weekStart    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1));
  const weekEnd      = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // All non-blocked sessions this week
  const weekLogs = await StepsLog.find({
    userId,
    startTime:        { $gte: weekStart, $lt: weekEnd },
    confidenceStatus: { $ne: 'blocked' }
  }).select('stepsCount staminaCredited startTime confidenceStatus').lean();

  const totalSteps     = weekLogs.reduce((s, l) => s + l.stepsCount, 0);
  const staminaEarned  = weekLogs.reduce((s, l) => s + (l.staminaCredited || 0), 0);
  const sessionsCount  = weekLogs.length;

  // Tournament threshold (configurable via env, default 14 000)
  const tournamentThreshold = parseInt(process.env.WEEKLY_STEPS_THRESHOLD, 10) || 14000;
  const thresholdProgress   = Math.min(1, totalSteps / tournamentThreshold);

  // Consecutive active days (streak) — check last 7 days
  const activeDaysSet = new Set(
    weekLogs.map(l => l.startTime.toISOString().slice(0, 10))
  );
  let consecutiveActiveDays = 0;
  for (let i = dayOfWeek - 1; i >= 0; i--) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    if (activeDaysSet.has(d.toISOString().slice(0, 10))) {
      consecutiveActiveDays++;
    } else {
      break; // streak broken
    }
  }

  // Grace period: if user completed threshold last week, they get 1 extra day
  const gracePeriodActive = false; // TODO: implement in Fase 2

  successResponse(res, {
    weekNumber,
    year,
    totalSteps,
    tournamentThreshold,
    thresholdProgress,
    staminaEarned,
    sessionsCount,
    consecutiveActiveDays,
    gracePeriodActive
  }, 'Weekly summary retrieved successfully');
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/steps/today
// ─────────────────────────────────────────────────────────────
exports.getTodaySteps = catchAsync(async (req, res, next) => {
  const userId  = req.user._id;
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLogs = await StepsLog.find({ userId, startTime: { $gte: today, $lt: tomorrow } }).lean();

  const totalSteps  = todayLogs.reduce((s, l) => s + l.stepsCount, 0);
  const validSteps  = todayLogs.filter(l => l.confidenceStatus === 'valid').reduce((s, l) => s + l.stepsCount, 0);
  const totalStamina = todayLogs.reduce((s, l) => s + (l.staminaCredited || 0), 0);

  successResponse(res, {
    totalSteps, validSteps, totalStamina,
    sessionsCount: todayLogs.length,
    sessions: todayLogs
  }, 'Today steps retrieved successfully');
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/steps/history
// ─────────────────────────────────────────────────────────────
exports.getStepsHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { startDate, endDate, limit = 50, page = 1 } = req.query;

  const query = { userId };
  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate)   query.startTime.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [stepsLogs, total] = await Promise.all([
    StepsLog.find(query).sort({ startTime: -1 }).limit(parseInt(limit)).skip(skip).lean(),
    StepsLog.countDocuments(query)
  ]);

  successResponse(res, {
    stepsLogs,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
  }, 'Steps history retrieved successfully');
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/steps/stats
// ─────────────────────────────────────────────────────────────
exports.getStepsStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const stats = await StepsLog.aggregate([
    { $match: { userId } },
    { $group: { _id: '$confidenceStatus', count: { $sum: 1 }, totalSteps: { $sum: '$stepsCount' } } }
  ]);

  const formattedStats = {
    valid:      { count: 0, totalSteps: 0 },
    suspicious: { count: 0, totalSteps: 0 },
    blocked:    { count: 0, totalSteps: 0 }
  };
  stats.forEach(s => { formattedStats[s._id] = { count: s.count, totalSteps: s.totalSteps }; });

  successResponse(res, { stats: formattedStats }, 'Steps stats retrieved successfully');
});
