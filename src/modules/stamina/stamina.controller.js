const { prisma } = require('../../config/postgres.config');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

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
