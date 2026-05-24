const mongoose = require('mongoose');
const config = require('./env.config');
const logger = require('../utils/logger');

const MONGODB_URI = config.nodeEnv === 'test' ? config.mongodbTestUri : config.mongodbUri;

const connectMongoDB = async () => {
  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, options);

    mongoose.connection.on('connected', () => {
      logger.info(`MongoDB connected to ${MONGODB_URI}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};

module.exports = { connectMongoDB };
