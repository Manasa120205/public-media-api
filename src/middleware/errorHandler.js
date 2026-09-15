const { AppError, ERROR_DEFINITIONS } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Global standardized error handling middleware
 */
function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected internal error occurred.';

  // Handle JSON body parser syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_URL';
    message = 'Malformed JSON request body.';
  } else if (err instanceof AppError) {
    statusCode = err.statusCode || 400;
    errorCode = err.code || 'INTERNAL_ERROR';
    message = err.message;
  } else if (err && err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_URL';
    message = 'Invalid data format provided.';
  } else if (err) {
    // Unexpected error
    statusCode = err.statusCode || err.status || 500;
    errorCode = err.code && ERROR_DEFINITIONS[err.code] ? err.code : 'INTERNAL_ERROR';

    if (!config.isProduction) {
      message = err.message || message;
    }
  }

  res.errorCode = errorCode;

  // Log error with context
  logger.error('Request processing error', {
    requestId,
    errorCode,
    statusCode,
    message,
    stack: config.isProduction ? undefined : err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Guard against sending headers twice
  if (res.headersSent) {
    return next(err);
  }

  return res.status(statusCode).json({
    success: false,
    requestId,
    error: {
      code: errorCode,
      message
    }
  });
}

/**
 * 404 Route Not Found middleware
 */
function notFoundHandler(req, res, next) {
  res.errorCode = 'MEDIA_NOT_FOUND';
  res.status(404).json({
    success: false,
    requestId: req.id || 'unknown',
    error: {
      code: 'MEDIA_NOT_FOUND',
      message: `The endpoint "${req.method} ${req.originalUrl}" was not found on this server.`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
