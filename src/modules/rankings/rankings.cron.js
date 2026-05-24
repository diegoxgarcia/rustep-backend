const cron = require('node-cron');
const { prisma } = require('../../config/postgres.config');
const User = require('../../../models/User');
const StepsLog = require('../../../models/StepsLog');
const logger = require('../../utils/logger');
const config = require('../../config/env.config');

/**
 * Update weekly rankings
 * Runs every Monday at midnight
 */
const updateWeeklyRankings = async () => {
  try {
    logger.info('Starting weekly rankings update...');

    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    // Get all active users
    const users = await User.find({ accountStatus: 'active' }).select('_id');

    for (const user of users) {
      const userId = user._id.toString();

      // Calculate weekly steps
      const startOfWeek = getStartOfWeek(now);
      const endOfWeek = getEndOfWeek(now);

      const weeklySteps = await StepsLog.find({
        userId: user._id,
        startTime: { $gte: startOfWeek, $lte: endOfWeek },
        confidenceStatus: 'valid'
      });

      const totalSteps = weeklySteps.reduce((sum, log) => sum + log.stepsCount, 0);
      const totalSessions = weeklySteps.length;
      const totalStamina = weeklySteps.reduce((sum, log) => sum + (log.staminaCredited || 0), 0);

      // Update or create WEEKLY_STEPS ranking
      await prisma.ranking.upsert({
        where: {
          userId_category_weekNumber_year: {
            userId,
            category: 'WEEKLY_STEPS',
            weekNumber,
            year
          }
        },
        update: {
          score: totalSteps
        },
        create: {
          userId,
          category: 'WEEKLY_STEPS',
          score: totalSteps,
          weekNumber,
          year
        }
      });

      // Update WEEKLY_SESSIONS ranking
      await prisma.ranking.upsert({
        where: {
          userId_category_weekNumber_year: {
            userId,
            category: 'WEEKLY_SESSIONS',
            weekNumber,
            year
          }
        },
        update: {
          score: totalSessions
        },
        create: {
          userId,
          category: 'WEEKLY_SESSIONS',
          score: totalSessions,
          weekNumber,
          year
        }
      });

      // Update WEEKLY_STAMINA ranking
      await prisma.ranking.upsert({
        where: {
          userId_category_weekNumber_year: {
            userId,
            category: 'WEEKLY_STAMINA',
            weekNumber,
            year
          }
        },
        update: {
          score: totalStamina
        },
        create: {
          userId,
          category: 'WEEKLY_STAMINA',
          score: totalStamina,
          weekNumber,
          year
        }
      });

      // Update ALL_TIME_STEPS ranking
      const allTimeStats = await StepsLog.getUserTotalSteps(user._id, 'valid');

      await prisma.ranking.upsert({
        where: {
          userId_category_weekNumber_year: {
            userId,
            category: 'ALL_TIME_STEPS',
            weekNumber,
            year
          }
        },
        update: {
          score: allTimeStats.totalSteps
        },
        create: {
          userId,
          category: 'ALL_TIME_STEPS',
          score: allTimeStats.totalSteps,
          weekNumber,
          year
        }
      });
    }

    logger.info(`Weekly rankings updated successfully for ${users.length} users`);
  } catch (error) {
    logger.error('Error updating weekly rankings:', error);
  }
};

/**
 * Schedule cron jobs
 */
const scheduleRankingsJobs = () => {
  // Run every Monday at midnight (configurable via env)
  cron.schedule(config.cron.weeklyRankings, updateWeeklyRankings, {
    timezone: 'UTC'
  });

  logger.info('Rankings cron jobs scheduled');
};

/**
 * Helper functions
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(d.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

function getEndOfWeek(date) {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

module.exports = {
  scheduleRankingsJobs,
  updateWeeklyRankings
};
