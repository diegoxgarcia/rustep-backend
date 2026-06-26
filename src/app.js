const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const config = require('./config/env.config');
const logger = require('./utils/logger');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const stepsRoutes = require('./modules/steps/steps.routes');
const staminaRoutes = require('./modules/stamina/stamina.routes');
const friendsRoutes = require('./modules/friends/friends.routes');
const rankingsRoutes = require('./modules/rankings/rankings.routes');
const groupsRoutes = require('./modules/groups/groups.routes');

const app = express();

// Security middleware
app.use(helmet());

// CORS
// Mobile apps (Android/iOS) don't send an Origin header — allow them through.
// Browser clients are checked against the allowedOrigins whitelist.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile app or server-to-server
    if (config.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// API Routes
const API_PREFIX = `/api/${config.apiVersion}`;

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/steps`, stepsRoutes);
app.use(`${API_PREFIX}/stamina`, staminaRoutes);
app.use(`${API_PREFIX}/friends`, friendsRoutes);
app.use(`${API_PREFIX}/rankings`, rankingsRoutes);
app.use(`${API_PREFIX}/groups`, groupsRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Rustep API',
    version: config.apiVersion,
    documentation: `${API_PREFIX}/docs`
  });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
