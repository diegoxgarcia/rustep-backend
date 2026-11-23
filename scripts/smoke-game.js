// Dev-only smoke test for the Rustep Run endpoints (POST /game/races, GET /game/leaderboard).
// Runs the real controllers against DATABASE_URL with fake req/res objects (no HTTP, no Mongo:
// User lookups are stubbed). Seeds throwaway users, checks debit/clamp/idempotency/concurrency
// and leaderboard ranking, then removes every row it created.
//
//   Prereq: npx prisma db push && npx prisma generate   (so game_races + RACE_DEBIT exist)
//   Run:    node scripts/smoke-game.js
//
// Safe to delete.

require('dotenv').config();
const { prisma } = require('../src/config/postgres.config');
const User = require('../models/User');

// Stub Mongo: leaderboard only needs displayName/photoUrl.
User.find = () => ({ select: () => ({ lean: async () => [] }) });

const game = require('../src/modules/game/game.controller');

const stamp = Date.now();
const A = `smoke-game-a-${stamp}`;
const B = `smoke-game-b-${stamp}`;
const C = `smoke-game-c-${stamp}`;
const USERS = [A, B, C];
const rid = (n) => `smoke-${stamp}-${n}`;

async function cleanup() {
  await prisma.gameRace.deleteMany({ where: { userId: { in: USERS } } });
  await prisma.staminaLedger.deleteMany({ where: { userId: { in: USERS } } });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: { in: USERS } }, { addresseeId: { in: USERS } }] }
  });
}

/** Call an Express handler and resolve with { status, body }. */
function call(handler, userId, { body = {}, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = { user: { _id: userId }, body, query };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; }
    };
    handler(req, res, (err) => (err ? resolve({ status: err.statusCode || 500, body: { message: err.message } }) : reject(new Error('next() without error'))));
  });
}

const race = (userId, n, extra) => call(game.submitRace, userId, {
  body: { raceId: rid(n), distance: 'D3K', finished: true, timeSec: 100, coins: 5, staminaUsed: 0, ...extra }
});

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`  ok - ${msg}`);
}

async function main() {
  await cleanup();
  await prisma.staminaLedger.create({ data: { userId: A, amount: 100, type: 'ADMIN_ADJUSTMENT', description: 'smoke' } });

  console.log('Carreras');
  let r = await race(A, 1, { timeSec: 120.5, staminaUsed: 30 });
  assert(r.status === 201 && r.body.data.staminaDebited === 30, 'carrera terminada descuenta 30');
  assert(r.body.data.balance === 70, 'balance queda en 70');
  assert(r.body.data.isPersonalBest === true && r.body.data.bestTimeSec === 120.5, 'primera carrera = récord personal');

  r = await race(A, 1, { timeSec: 120.5, staminaUsed: 30 });
  assert(r.status === 200 && r.body.data.duplicate === true, 'reenviar el mismo raceId = duplicado');
  assert(r.body.data.staminaDebited === 30 && r.body.data.balance === 70, 'el reenvío NO descuenta otra vez');

  r = await race(A, 2, { finished: false, timeSec: 0, staminaUsed: 200 });
  assert(r.status === 201 && r.body.data.staminaDebited === 70, 'muerte con 200 usados se recorta al balance (70)');
  assert(r.body.data.balance === 0 && r.body.data.isPersonalBest === false, 'balance 0, muerte no es récord');

  r = await race(A, 3, { timeSec: 130, staminaUsed: 10 });
  assert(r.body.data.staminaDebited === 0 && r.body.data.balance === 0, 'sin balance no descuenta (nunca negativo)');
  assert(r.body.data.isPersonalBest === false && r.body.data.bestTimeSec === 120.5, 'tiempo peor no es récord; mejor sigue 120.5');

  r = await race(B, 1, { timeSec: 99 });
  assert(r.status === 409, 'otro usuario no puede reusar un raceId ajeno');

  r = await call(game.submitRace, A, { body: { raceId: rid(9), distance: 'D3K', finished: true, timeSec: 0, staminaUsed: 0 } });
  assert(r.status === 400, 'terminada con timeSec 0 = 400');

  console.log('Concurrencia');
  await prisma.staminaLedger.create({ data: { userId: A, amount: 50, type: 'ADMIN_ADJUSTMENT', description: 'smoke' } });
  const [p, q] = await Promise.all([race(A, 4, { timeSec: 140, staminaUsed: 40 }), race(A, 5, { timeSec: 150, staminaUsed: 40 })]);
  const totalDebited = p.body.data.staminaDebited + q.body.data.staminaDebited;
  const bal = (await prisma.staminaLedger.aggregate({ where: { userId: A }, _sum: { amount: true } }))._sum.amount;
  assert(totalDebited === 50 && bal === 0, `dos carreras simultáneas de 40 con 50 de balance descuentan 50 en total (${p.body.data.staminaDebited}+${q.body.data.staminaDebited})`);

  console.log('Tablas');
  await race(B, 10, { timeSec: 110, coins: 7 });
  await race(B, 11, { timeSec: 115 });
  await race(C, 20, { timeSec: 90 });
  await race(C, 21, { distance: 'D5K', timeSec: 50 });
  await prisma.friendship.create({ data: { requesterId: A, addresseeId: B, status: 'ACCEPTED' } });

  // Global includes real players too, so only check relative order of the smoke users.
  r = await call(game.getLeaderboard, A, { query: { distance: 'D3K', scope: 'global', limit: '100' } });
  const g = r.body.data.entries.filter(e => USERS.includes(e.userId));
  assert(g.map(e => e.userId).join() === [C, B, A].join(), 'global D3K ordena C(90) < B(110) < A(120.5)');
  assert(g[1].bestTimeSec === 110 && g[1].coins === 7, 'cada jugador aparece una vez, con su mejor tiempo y sus monedas');
  assert(r.body.data.me && r.body.data.me.bestTimeSec === 120.5, '"me" trae mi mejor tiempo');

  r = await call(game.getLeaderboard, A, { query: { distance: 'D3K', scope: 'friends' } });
  const f = r.body.data.entries;
  assert(f.map(e => e.userId).join() === [B, A].join() && f[0].rank === 1 && f[1].rank === 2, 'amigos: B #1, A #2, C (no amigo) afuera');
  assert(f[1].isMe === true && f[0].isMe === false, 'isMe marca mi fila');

  r = await call(game.getLeaderboard, A, { query: { distance: 'D3K', scope: 'friends', limit: '1' } });
  assert(r.body.data.entries.length === 1 && r.body.data.me.rank === 2, 'con limit=1 igual devuelve mi posición en "me"');

  r = await call(game.getLeaderboard, B, { query: { distance: 'D5K', scope: 'friends' } });
  assert(r.body.data.entries.length === 0 && r.body.data.me === null, 'distancia sin carreras = tabla vacía, me null');

  const ledgerTypes = await prisma.staminaLedger.findMany({ where: { userId: A, type: 'RACE_DEBIT' } });
  assert(ledgerTypes.every(t => t.referenceId.startsWith(`smoke-${stamp}`)), 'cada RACE_DEBIT apunta a su raceId');

  console.log(`\n${passed} checks OK`);
}

main()
  .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
