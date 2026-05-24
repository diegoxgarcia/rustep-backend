const app = require('./app');
const config = require('./config/env.config');
const { connectMongoDB } = require('./config/mongodb.config');
const { connectPostgres } = require('./config/postgres.config');
const { scheduleRankingsJobs } = require('./modules/rankings/rankings.cron');
const logger = require('./utils/logger');

const PORT = config.port || 3000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectMongoDB();
    logger.info('MongoDB connected successfully');

    // Connect to PostgreSQL (Prisma)
    await connectPostgres();
    logger.info('PostgreSQL connected successfully');

    // Schedule cron jobs
    scheduleRankingsJobs();
    logger.info('Cron jobs scheduled successfully');

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
      logger.info(`API available at http://localhost:${PORT}/api/${config.apiVersion}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
