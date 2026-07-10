require('dotenv').config();

module.exports = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiVersion: process.env.API_VERSION || 'v1',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rustep',
  mongodbTestUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/rustep_test',

  // PostgreSQL
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || ''
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },

  // Stamina Configuration
  stamina: {
    perThousandSteps: parseInt(process.env.STAMINA_PER_1K_STEPS, 10) || 10,
    maxPerDay: parseInt(process.env.MAX_STAMINA_PER_DAY, 10) || 100,
    fraudThresholdConfidence: parseFloat(process.env.FRAUD_THRESHOLD_CONFIDENCE) || 0.4,
    fraudSuspensionDays: parseInt(process.env.FRAUD_SUSPENSION_DAYS, 10) || 7,
    // Donation & recovery (see GDD 11.5)
    donationMonthlyCap: parseInt(process.env.STAMINA_DONATION_MONTHLY_CAP, 10) || 300,
    recoveryDurationDays: parseInt(process.env.RECOVERY_DURATION_DAYS, 10) || 7,
    recoveryStepsReviewThreshold: parseInt(process.env.RECOVERY_STEPS_REVIEW_THRESHOLD, 10) || 2000
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log'
  },

  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:19006'],

  // Cron Jobs
  cron: {
    weeklyRankings: process.env.CRON_WEEKLY_RANKINGS || '0 0 * * 1' // Every Monday at midnight
  }
};
