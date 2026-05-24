const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Event listeners for logging
prisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

prisma.$on('error', (e) => {
  logger.error('Prisma error:', e);
});

const connectPostgres = async () => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected via Prisma');
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    throw error;
  }
};

const disconnectPostgres = async () => {
  try {
    await prisma.$disconnect();
    logger.info('PostgreSQL disconnected');
  } catch (error) {
    logger.error('PostgreSQL disconnect error:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectPostgres();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPostgres();
  process.exit(0);
});

module.exports = {
  prisma,
  connectPostgres,
  disconnectPostgres
};
