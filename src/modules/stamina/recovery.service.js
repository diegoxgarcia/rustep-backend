const { prisma } = require('../../config/postgres.config');
const config = require('../../config/env.config');
const FraudFlag = require('../../../models/FraudFlag');
const logger = require('../../utils/logger');

// Shared logic for the donation & recovery mechanic (GDD 11.5, Backend doc 9.3/9.4).
// Single source of truth so the stamina controller and the steps sync agree on the rules.

const CAP = config.stamina.donationMonthlyCap;                    // 300
const DURATION_DAYS = config.stamina.recoveryDurationDays;        // 7
const STEP_THRESHOLD = config.stamina.recoveryStepsReviewThreshold; // 2000

/** First instant of the current calendar month, in UTC. */
function startOfMonthUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Returns the user's active recovery record, or null.
 * Lazily flips `active` to false when the record has expired.
 */
async function getActiveRecovery(userId) {
  const id = userId.toString();
  const rec = await prisma.recoveryState.findUnique({ where: { userId: id } });
  if (!rec || !rec.active) return null;
  if (rec.expiresAt <= new Date()) {
    await prisma.recoveryState.update({ where: { userId: id }, data: { active: false } });
    return null;
  }
  return rec;
}

/** Stamina received via donations in the current calendar month. */
async function receivedThisMonth(userId) {
  const r = await prisma.staminaLedger.aggregate({
    where: {
      userId: userId.toString(),
      type: 'DONATION_RECEIVED',
      createdAt: { gte: startOfMonthUTC() }
    },
    _sum: { amount: true }
  });
  return r._sum.amount || 0;
}

/** Current stamina balance (sum of the ledger). */
async function balanceOf(userId) {
  const r = await prisma.staminaLedger.aggregate({
    where: { userId: userId.toString() },
    _sum: { amount: true }
  });
  return r._sum.amount || 0;
}

/** Remaining monthly cap a recipient can still receive (0 when paused for review). */
function remainingCap(rec, received) {
  if (rec && rec.pausedForReview) return 0;
  return Math.max(0, CAP - received);
}

/** Serialized recovery status for the API responses. */
function recoveryPayload(rec, received) {
  return {
    active: !!rec,
    reason: rec ? rec.reason.toLowerCase() : null,
    startedAt: rec ? rec.startedAt : null,
    expiresAt: rec ? rec.expiresAt : null,
    pausedForReview: rec ? rec.pausedForReview : false,
    receivedThisMonth: received,
    monthlyCap: CAP,
    remainingCap: remainingCap(rec, received)
  };
}

/**
 * Called from the daily-steps sync. If the user is in active recovery and any day crosses
 * the step threshold, pause donations-received and raise a manual-review signal on fraudflags.
 * Progressive, not punitive: it never blocks the user's own stamina earning. Never throws.
 */
async function reviewRecoveryStepSpike(userId, maxDaySteps) {
  try {
    if (!Number.isFinite(maxDaySteps) || maxDaySteps < STEP_THRESHOLD) return;

    const rec = await getActiveRecovery(userId);
    if (!rec || rec.pausedForReview) return;

    await prisma.recoveryState.update({
      where: { userId: userId.toString() },
      data: { pausedForReview: true }
    });

    await FraudFlag.findOneAndUpdate(
      { userId },
      {
        $set: {
          lastSuspiciousAt: new Date(),
          reviewStatus: 'under_review',
          reviewNotes: `RECOVERY_STEPS_SPIKE: ${maxDaySteps} steps in a day while in recovery`
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    logger.info(`Recovery steps spike flagged for user ${userId}: ${maxDaySteps} steps/day`);
  } catch (err) {
    logger.error(`reviewRecoveryStepSpike failed for ${userId}: ${err.message}`);
  }
}

module.exports = {
  CAP,
  DURATION_DAYS,
  STEP_THRESHOLD,
  startOfMonthUTC,
  getActiveRecovery,
  receivedThisMonth,
  balanceOf,
  remainingCap,
  recoveryPayload,
  reviewRecoveryStepSpike
};
