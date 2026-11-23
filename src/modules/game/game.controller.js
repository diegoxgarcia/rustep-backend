const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/postgres.config');
const gameConfig = require('./game.config');
const User = require('../../../models/User');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const { successResponse } = require('../../utils/response');

/**
 * Rustep Run (Unreal) — ranked races and leaderboards.
 * Only adds rows (game_races + RACE_DEBIT ledger entries); never edits existing data.
 */

const balanceOf = async (client, userId) => {
  const r = await client.staminaLedger.aggregate({ where: { userId }, _sum: { amount: true } });
  return r._sum.amount || 0;
};

/** Best finished time for a user on a distance (null if none yet). */
const bestTimeOf = async (userId, distance) => {
  const r = await prisma.gameRace.aggregate({
    where: { userId, distance, finished: true },
    _min: { timeSec: true }
  });
  return r._min.timeSec;
};

/** True if no earlier finished race of this user/distance was as fast or faster. */
const wasPersonalBest = async (race) => {
  if (!race.finished || race.timeSec == null) return false;
  const better = await prisma.gameRace.count({
    where: {
      userId: race.userId,
      distance: race.distance,
      finished: true,
      id: { not: race.id },
      createdAt: { lte: race.createdAt },
      timeSec: { lte: race.timeSec }
    }
  });
  return better === 0;
};

/**
 * @desc    Report the end of a ranked race: store it and debit the stamina used.
 *          Idempotent by raceId — resending the same race returns the original
 *          result and never debits twice.
 * @route   POST /api/v1/game/races
 * @access  Private
 */
exports.submitRace = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();
  const { raceId, distance } = req.body;
  const finished = req.body.finished === true || req.body.finished === 'true';
  const timeSec = finished ? Number(req.body.timeSec) : null;
  const coins = Number(req.body.coins) || 0;
  const staminaUsed = Number(req.body.staminaUsed) || 0;

  if (finished && !(timeSec > 0)) {
    return next(new AppError('timeSec must be greater than 0 for a finished race', 400));
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Serialize this user's debits so two races can't both spend the same balance.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;

      const existing = await tx.gameRace.findUnique({ where: { raceId } });
      if (existing) {
        if (existing.userId !== userId) throw new AppError('raceId already used', 409);
        return { race: existing, duplicate: true };
      }

      const balance = await balanceOf(tx, userId);
      const debit = Math.max(0, Math.min(staminaUsed, balance)); // never below zero

      const race = await tx.gameRace.create({
        data: {
          raceId,
          userId,
          distance,
          finished,
          timeSec,
          coins,
          staminaRequested: staminaUsed,
          staminaDebited: debit
        }
      });

      if (debit > 0) {
        await tx.staminaLedger.create({
          data: {
            userId,
            amount: -debit,
            type: 'RACE_DEBIT',
            referenceId: raceId,
            description: `Rustep Run ${distance}${finished ? '' : ' (no terminada)'}`
          }
        });
      }

      return { race, duplicate: false };
    }, { maxWait: 10000, timeout: 15000 });
  } catch (err) {
    // Same raceId sent concurrently by another account.
    if (err.code === 'P2002') return next(new AppError('raceId already used', 409));
    throw err;
  }

  const { race, duplicate } = result;
  const [balance, bestTimeSec, isPersonalBest] = await Promise.all([
    balanceOf(prisma, userId),
    bestTimeOf(userId, race.distance),
    wasPersonalBest(race)
  ]);

  successResponse(res, {
    raceId: race.raceId,
    duplicate,
    staminaDebited: race.staminaDebited,
    balance,
    isPersonalBest,
    bestTimeSec
  }, duplicate ? 'Race already recorded' : 'Race recorded', duplicate ? 200 : 201);
});

/**
 * @desc    Leaderboard: best finished time per player on a distance.
 * @route   GET /api/v1/game/leaderboard?distance=D3K&scope=global|friends&limit=50
 * @access  Private
 */
exports.getLeaderboard = catchAsync(async (req, res) => {
  const me = req.user._id.toString();
  const distance = req.query.distance;
  const scope = req.query.scope || 'global';
  const limit = Math.min(
    parseInt(req.query.limit, 10) || gameConfig.leaderboardDefaultLimit,
    gameConfig.leaderboardMaxLimit
  );

  let scopeFilter = Prisma.empty;
  if (scope === 'friends') {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: me }, { addresseeId: me }]
      },
      select: { requesterId: true, addresseeId: true }
    });
    const ids = [me, ...friendships.map(f => (f.requesterId === me ? f.addresseeId : f.requesterId))];
    scopeFilter = Prisma.sql`AND user_id IN (${Prisma.join(ids)})`;
  }

  // One row per player (their best time; ties broken by who did it first),
  // ranked, returning the top N plus the caller's own row.
  const rows = await prisma.$queryRaw`
    WITH best AS (
      SELECT DISTINCT ON (user_id) user_id, time_sec, coins, created_at
      FROM game_races
      WHERE distance = ${distance} AND finished = true AND time_sec IS NOT NULL ${scopeFilter}
      ORDER BY user_id, time_sec ASC, created_at ASC
    ), ranked AS (
      SELECT user_id, time_sec, coins,
             ROW_NUMBER() OVER (ORDER BY time_sec ASC, created_at ASC) AS rank
      FROM best
    )
    SELECT user_id, time_sec, coins, rank
    FROM ranked
    WHERE rank <= ${limit} OR user_id = ${me}
    ORDER BY rank`;

  const users = await User.find({ _id: { $in: rows.map(r => r.user_id) } })
    .select('displayName photoUrl')
    .lean();
  const byId = new Map(users.map(u => [u._id.toString(), u]));

  const toEntry = (r) => {
    const u = byId.get(r.user_id);
    return {
      rank: Number(r.rank),
      userId: r.user_id,
      displayName: u ? u.displayName : 'Runner',
      photoUrl: u ? u.photoUrl || null : null,
      bestTimeSec: r.time_sec,
      coins: r.coins,
      isMe: r.user_id === me
    };
  };

  const entries = rows.filter(r => Number(r.rank) <= limit).map(toEntry);
  const mine = rows.find(r => r.user_id === me);

  successResponse(res, {
    distance,
    scope,
    entries,
    me: mine ? { rank: Number(mine.rank), bestTimeSec: mine.time_sec, coins: mine.coins } : null
  }, 'Leaderboard retrieved successfully');
});
