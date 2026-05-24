const { prisma } = require('../../config/postgres.config');
const User = require('../../../models/User');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

/**
 * @desc    Get weekly rankings
 * @route   GET /api/v1/rankings/weekly/:category
 * @access  Private
 */
exports.getWeeklyRankings = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const { weekNumber, year, limit = 100 } = req.query;

  const now = new Date();
  const currentWeekNumber = weekNumber ? parseInt(weekNumber) : getWeekNumber(now);
  const currentYear = year ? parseInt(year) : now.getFullYear();

  const validCategories = ['WEEKLY_STEPS', 'WEEKLY_STAMINA', 'WEEKLY_SESSIONS', 'ALL_TIME_STEPS'];

  if (!validCategories.includes(category)) {
    return next(new AppError('Invalid ranking category', 400));
  }

  const rankings = await prisma.ranking.findMany({
    where: {
      category,
      weekNumber: currentWeekNumber,
      year: currentYear
    },
    orderBy: {
      score: 'desc'
    },
    take: parseInt(limit)
  });

  // Add rank numbers
  const rankedResults = rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }));

  // Get user details
  const userIds = rankedResults.map(r => r.userId);
  const users = await User.find({
    _id: { $in: userIds }
  }).select('displayName photoUrl city country');

  const rankingsWithUsers = rankedResults.map(ranking => {
    const user = users.find(u => u._id.toString() === ranking.userId);
    return {
      ...ranking,
      user
    };
  });

  successResponse(res, {
    rankings: rankingsWithUsers,
    metadata: {
      category,
      weekNumber: currentWeekNumber,
      year: currentYear
    }
  }, 'Rankings retrieved successfully');
});

/**
 * @desc    Get user's ranking position
 * @route   GET /api/v1/rankings/my-position/:category
 * @access  Private
 */
exports.getMyPosition = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { category } = req.params;
  const { weekNumber, year } = req.query;

  const now = new Date();
  const currentWeekNumber = weekNumber ? parseInt(weekNumber) : getWeekNumber(now);
  const currentYear = year ? parseInt(year) : now.getFullYear();

  const myRanking = await prisma.ranking.findFirst({
    where: {
      userId,
      category,
      weekNumber: currentWeekNumber,
      year: currentYear
    }
  });

  if (!myRanking) {
    return successResponse(res, {
      position: null,
      score: 0,
      message: 'No ranking data for this period'
    }, 'User not ranked yet');
  }

  // Calculate position
  const betterScores = await prisma.ranking.count({
    where: {
      category,
      weekNumber: currentWeekNumber,
      year: currentYear,
      score: {
        gt: myRanking.score
      }
    }
  });

  const position = betterScores + 1;

  successResponse(res, {
    position,
    score: myRanking.score,
    category,
    weekNumber: currentWeekNumber,
    year: currentYear
  }, 'User position retrieved successfully');
});

/**
 * @desc    Get friends rankings
 * @route   GET /api/v1/rankings/friends/:category
 * @access  Private
 */
exports.getFriendsRankings = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { category } = req.params;
  const { weekNumber, year } = req.query;

  const now = new Date();
  const currentWeekNumber = weekNumber ? parseInt(weekNumber) : getWeekNumber(now);
  const currentYear = year ? parseInt(year) : now.getFullYear();

  // Get user's friends
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { addresseeId: userId, status: 'ACCEPTED' }
      ]
    }
  });

  const friendIds = friendships.map(f =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  );

  // Include self
  friendIds.push(userId);

  // Get rankings for friends
  const rankings = await prisma.ranking.findMany({
    where: {
      userId: { in: friendIds },
      category,
      weekNumber: currentWeekNumber,
      year: currentYear
    },
    orderBy: {
      score: 'desc'
    }
  });

  // Get user details
  const users = await User.find({
    _id: { $in: friendIds }
  }).select('displayName photoUrl city');

  const rankingsWithUsers = rankings.map((ranking, index) => {
    const user = users.find(u => u._id.toString() === ranking.userId);
    return {
      ...ranking,
      rank: index + 1,
      user,
      isCurrentUser: ranking.userId === userId
    };
  });

  successResponse(res, {
    rankings: rankingsWithUsers,
    metadata: {
      category,
      weekNumber: currentWeekNumber,
      year: currentYear
    }
  }, 'Friends rankings retrieved successfully');
});

/**
 * Helper function to get ISO week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
