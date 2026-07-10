const { prisma } = require('../../config/postgres.config');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');
const User = require('../../../models/User');
const recovery = require('./recovery.service');
const { randomUUID } = require('crypto');

const RECOVERY_REASONS = ['injured', 'sick', 'hospitalized', 'recovering'];

/**
 * @desc    Get user's stamina balance
 * @route   GET /api/v1/stamina/balance
 * @access  Private
 */
exports.getBalance = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  const result = await prisma.staminaLedger.aggregate({
    where: { userId },
    _sum: {
      amount: true
    }
  });

  const balance = result._sum.amount || 0;

  successResponse(res, { balance }, 'Stamina balance retrieved successfully');
});

/**
 * @desc    Get stamina transaction history
 * @route   GET /api/v1/stamina/transactions
 * @access  Private
 */
exports.getTransactions = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { limit = 50, page = 1, type } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = { userId };
  if (type) {
    where.type = type;
  }

  const [transactions, total] = await Promise.all([
    prisma.staminaLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip
    }),
    prisma.staminaLedger.count({ where })
  ]);

  successResponse(res, {
    transactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  }, 'Stamina transactions retrieved successfully');
});

/**
 * @desc    Get daily stamina summary
 * @route   GET /api/v1/stamina/daily
 * @access  Private
 */
exports.getDailySummary = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTransactions = await prisma.staminaLedger.findMany({
    where: {
      userId,
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  const earned = todayTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const spent = todayTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  successResponse(res, {
    today: {
      earned,
      spent,
      net: earned - spent,
      transactionsCount: todayTransactions.length
    }
  }, 'Daily stamina summary retrieved successfully');
});

/**
 * @desc    Spend stamina (for rewards, etc)
 * @route   POST /api/v1/stamina/spend
 * @access  Private
 */
exports.spendStamina = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { amount, description, referenceId } = req.body;

  if (amount <= 0) {
    return next(new AppError('Amount must be positive', 400));
  }

  // Check balance
  const balanceResult = await prisma.staminaLedger.aggregate({
    where: { userId },
    _sum: {
      amount: true
    }
  });

  const currentBalance = balanceResult._sum.amount || 0;

  if (currentBalance < amount) {
    return next(new AppError('Insufficient stamina balance', 400));
  }

  // Create debit transaction
  const transaction = await prisma.staminaLedger.create({
    data: {
      userId,
      amount: -amount,
      type: 'REWARD_DEBIT',
      description,
      referenceId
    }
  });

  const newBalance = currentBalance - amount;

  successResponse(res, {
    transaction,
    newBalance
  }, 'Stamina spent successfully');
});

/**
 * @desc    Get stamina statistics
 * @route   GET /api/v1/stamina/stats
 * @access  Private
 */
exports.getStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  const transactions = await prisma.staminaLedger.findMany({
    where: { userId }
  });

  const totalEarned = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const currentBalance = totalEarned - totalSpent;

  // Group by type
  const byType = transactions.reduce((acc, t) => {
    const type = t.type;
    if (!acc[type]) {
      acc[type] = { count: 0, amount: 0 };
    }
    acc[type].count += 1;
    acc[type].amount += t.amount;
    return acc;
  }, {});

  successResponse(res, {
    currentBalance,
    totalEarned,
    totalSpent,
    transactionsCount: transactions.length,
    byType
  }, 'Stamina statistics retrieved successfully');
});

// ─────────────────────────────────────────────────────────────
// Donation & recovery (feature: Donación de Stamina — GDD 11.5)
// ─────────────────────────────────────────────────────────────

/**
 * @desc    Get my recovery state + monthly donation cap usage
 * @route   GET /api/v1/stamina/recovery
 * @access  Private
 */
exports.getRecovery = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const rec = await recovery.getActiveRecovery(userId);
  const received = await recovery.receivedThisMonth(userId);
  successResponse(res, recovery.recoveryPayload(rec, received), 'Recovery state retrieved successfully');
});

/**
 * @desc    Activate or renew my recovery state (self-declared, no medical proof)
 * @route   POST /api/v1/stamina/recovery
 * @access  Private
 */
exports.startRecovery = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const reason = String(req.body.reason || '').toLowerCase();

  if (!RECOVERY_REASONS.includes(reason)) {
    return next(new AppError('Invalid recovery reason', 400));
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + recovery.DURATION_DAYS * 24 * 60 * 60 * 1000);
  const reasonEnum = reason.toUpperCase();

  const existing = await prisma.recoveryState.findUnique({ where: { userId } });
  const isActiveNow = existing && existing.active && existing.expiresAt > now;

  // Renewing an active state only extends expiry; a fresh (re)activation resets the clock
  // and clears any previous review pause. Renewing does NOT clear a pending review.
  const data = { reason: reasonEnum, active: true, expiresAt };
  if (!isActiveNow) {
    data.startedAt = now;
    data.pausedForReview = false;
  }

  const rec = existing
    ? await prisma.recoveryState.update({ where: { userId }, data })
    : await prisma.recoveryState.create({ data: { userId, startedAt: now, pausedForReview: false, ...data } });

  const received = await recovery.receivedThisMonth(userId);
  successResponse(res, recovery.recoveryPayload(rec, received), 'Recovery state activated', existing ? 200 : 201);
});

/**
 * @desc    End my recovery state (declare recovered)
 * @route   DELETE /api/v1/stamina/recovery
 * @access  Private
 */
exports.endRecovery = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  await prisma.recoveryState.updateMany({ where: { userId }, data: { active: false } });
  successResponse(res, { active: false }, 'Recovery state ended');
});

/**
 * @desc    List my friends currently in recovery who can still receive donations
 * @route   GET /api/v1/stamina/recovery/friends
 * @access  Private
 */
exports.getRecoveringFriends = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { addresseeId: userId, status: 'ACCEPTED' }
      ]
    }
  });
  const friendIds = friendships.map(f => (f.requesterId === userId ? f.addresseeId : f.requesterId));
  if (friendIds.length === 0) {
    return successResponse(res, { friends: [] }, 'Recovering friends retrieved successfully');
  }

  // Active, non-expired, not paused recovery states among my friends
  const states = await prisma.recoveryState.findMany({
    where: {
      userId: { in: friendIds },
      active: true,
      pausedForReview: false,
      expiresAt: { gt: new Date() }
    }
  });
  if (states.length === 0) {
    return successResponse(res, { friends: [] }, 'Recovering friends retrieved successfully');
  }

  const recoveringIds = states.map(s => s.userId);

  // Received-this-month per recovering friend (one grouped query)
  const grouped = await prisma.staminaLedger.groupBy({
    by: ['userId'],
    where: {
      userId: { in: recoveringIds },
      type: 'DONATION_RECEIVED',
      createdAt: { gte: recovery.startOfMonthUTC() }
    },
    _sum: { amount: true }
  });
  const receivedByUser = Object.fromEntries(grouped.map(g => [g.userId, g._sum.amount || 0]));

  const users = await User.find({ _id: { $in: recoveringIds } })
    .select('displayName photoUrl');
  const userById = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  const friends = states
    .map(s => {
      const cap = recovery.remainingCap(s, receivedByUser[s.userId] || 0);
      const u = userById[s.userId];
      if (cap <= 0 || !u) return null;
      return {
        userId: s.userId,
        displayName: u.displayName,
        photoUrl: u.photoUrl || null,
        remainingCap: cap
      };
    })
    .filter(Boolean);

  successResponse(res, { friends }, 'Recovering friends retrieved successfully');
});

/**
 * @desc    Donate stamina to a friend in recovery (clamped to the receiver's remaining cap)
 * @route   POST /api/v1/stamina/donate
 * @access  Private
 */
exports.donate = catchAsync(async (req, res, next) => {
  const donorId = req.user._id.toString();
  const toUserId = String(req.body.toUserId || '');
  const requested = Number(req.body.amount);

  if (!toUserId || toUserId === donorId) {
    return next(new AppError('Invalid recipient', 400));
  }
  if (!Number.isInteger(requested) || requested <= 0) {
    return next(new AppError('Amount must be a positive integer', 400)); // INVALID_AMOUNT
  }

  // Must be friends (ACCEPTED)
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: donorId, addresseeId: toUserId },
        { requesterId: toUserId, addresseeId: donorId }
      ]
    }
  });
  if (!friendship) {
    return next(new AppError('You can only donate to friends', 403)); // NOT_FRIENDS
  }

  // Recipient must be in active recovery and not paused for review
  const rec = await recovery.getActiveRecovery(toUserId);
  if (!rec || rec.pausedForReview) {
    return next(new AppError('Recipient is not accepting donations right now', 409)); // RECOVERY_NOT_ACTIVE
  }

  const received = await recovery.receivedThisMonth(toUserId);
  const remaining = recovery.remainingCap(rec, received);
  if (remaining <= 0) {
    return next(new AppError('Recipient has reached the monthly donation cap', 409)); // RECOVERY_CAP_REACHED
  }

  const donorBalance = await recovery.balanceOf(donorId);
  if (donorBalance <= 0) {
    return next(new AppError('Insufficient stamina balance', 400)); // INSUFFICIENT_BALANCE
  }

  // Clamp to the smallest binding limit; the donor is debited exactly what transfers.
  const transferred = Math.min(requested, remaining, donorBalance);
  if (transferred <= 0) {
    return next(new AppError('Insufficient stamina balance', 400)); // INSUFFICIENT_BALANCE
  }

  const donationId = randomUUID();
  await prisma.$transaction([
    prisma.staminaLedger.create({
      data: {
        userId: donorId,
        amount: -transferred,
        type: 'DONATION_SENT',
        referenceId: donationId,
        description: `Donation to ${toUserId}`
      }
    }),
    prisma.staminaLedger.create({
      data: {
        userId: toUserId,
        amount: transferred,
        type: 'DONATION_RECEIVED',
        referenceId: donationId,
        description: `Donation from ${donorId}`
      }
    })
  ]);

  const receiverReceivedThisMonth = received + transferred;
  successResponse(res, {
    transferred,
    requested,
    donorNewBalance: donorBalance - transferred,
    receiverReceivedThisMonth,
    receiverRemainingCap: recovery.remainingCap(rec, receiverReceivedThisMonth)
  }, 'Stamina donated successfully');
});
