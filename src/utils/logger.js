const winston = require('winston');
const config = require('../config/env.config');

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transport in production
if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: config.logging.filePath,
      format: logFormat,
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels,
  format: logFormat,
  transports,
  exitOnError: false,
});

module.exports = logger;
