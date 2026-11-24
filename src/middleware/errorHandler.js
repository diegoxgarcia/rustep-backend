const logger = require('../utils/logger');
const AppError = require('../utils/appError');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}. Please use another value`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    const message = `Invalid input data: ${errors.join('. ')}`;
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired. Please log in again';
    error = new AppError(message, 401);
  }

  // Prisma errors (Mongo uses numeric codes like 11000, so check the type first)
  if (typeof err.code === 'string' && err.code.startsWith('P')) {
    switch (err.code) {
      case 'P2002':
        const target = err.meta?.target || 'field';
        error = new AppError(`Duplicate value for ${target}`, 400);
        break;
      case 'P2025':
        error = new AppError('Record not found', 404);
        break;
      default:
        error = new AppError('Database error', 500);
    }
  }

  // Log: only real server failures (5xx) are errors, with stack. Client responses
  // (401 without token, 404, validation…) are normal traffic → one-line warn.
  if (error.statusCode >= 500) {
    logger.error(`Error: ${err.message}`, {
      statusCode: error.statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  } else {
    logger.warn(`${error.statusCode} ${req.method} ${req.path}: ${error.message}`);
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
