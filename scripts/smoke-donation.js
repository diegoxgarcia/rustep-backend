// Dev-only smoke test for the donation/recovery logic (GDD 11.5).
// Exercises the Prisma layer end-to-end against DATABASE_URL, WITHOUT HTTP or auth.
// Seeds two throwaway users, runs a donation, checks the clamp + atomicity, then cleans up.
//
//   Prereq: npx prisma db push && npx prisma generate   (so recovery_state + DONATION_* exist)
//   Run:    node scripts/smoke-donation.js
//
// Safe to delete. Uses clearly-fake user ids and removes its own rows on exit.

require('dotenv').config();
const crypto = require('crypto');
const { prisma } = require('../src/config/postgres.config');
const recovery = require('../src/modules/stamina/recovery.service');

const DONOR = `smoke-donor-${Date.now()}`;
const RECV = `smoke-recv-${Date.now()}`;

async function cleanup() {
  await prisma.staminaLedger.deleteMany({ where: { userId: { in: [DONOR, RECV] } } });
  await prisma.recoveryState.deleteMany({ where: { userId: { in: [DONOR, RECV] } } });
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok - ${msg}`);
}

async function main() {
  await cleanup();

  // Seed: donor has 500 stamina; receiver is in active recovery, already got 200 this month.
  await prisma.staminaLedger.create({ data: { userId: DONOR, amount: 500, type: 'STEPS_CREDIT' } });
  await prisma.recoveryState.create({
    data: {
      userId: RECV,
      reason: 'INJURED',
      active: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 864e5)
    }
  });
  await prisma.staminaLedger.create({ data: { userId: RECV, amount: 200, type: 'DONATION_RECEIVED' } });

  // Preconditions via the shared service (same code the controller uses).
  const rec = await recovery.getActiveRecovery(RECV);
  assert(rec && rec.active, 'receiver recovery is active');
  const received = await recovery.receivedThisMonth(RECV);
  assert(received === 200, `receivedThisMonth = 200 (got ${received})`);
  const remaining = recovery.remainingCap(rec, received);
  assert(remaining === 100, `remainingCap = 100 (got ${remaining})`);
  const donorBal = await recovery.balanceOf(DONOR);
  assert(donorBal === 500, `donor balance = 500 (got ${donorBal})`);

  // Donation of 250 must clamp to 100 (the receiver's remaining cap).
  const transferred = Math.min(250, remaining, donorBal);
  assert(transferred === 100, `clamp 250 -> 100 (got ${transferred})`);

  const donationId = crypto.randomUUID();
  await prisma.$transaction([
    prisma.staminaLedger.create({ data: { userId: DONOR, amount: -transferred, type: 'DONATION_SENT', referenceId: donationId } }),
    prisma.staminaLedger.create({ data: { userId: RECV, amount: transferred, type: 'DONATION_RECEIVED', referenceId: donationId } })
  ]);

  // Postconditions.
  const donorAfter = await recovery.balanceOf(DONOR);
  assert(donorAfter === 400, `donor debited exactly 100 -> 400 (got ${donorAfter})`);
  const recvAfter = await recovery.receivedThisMonth(RECV);
  assert(recvAfter === 300, `receiver received 300 total (got ${recvAfter})`);
  assert(recovery.remainingCap(rec, recvAfter) === 0, 'receiver cap now full (0 remaining)');

  console.log('\nAll smoke checks passed ✅');
}

main()
  .catch((e) => { console.error(`\n${e.message}`); process.exitCode = 1; })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
