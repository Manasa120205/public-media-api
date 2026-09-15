const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');

/**
 * Standard rate-limit error response handler
 */
function createRateLimitHandler(customMessage) {
  return (req, res, _next, options) => {
    res.errorCode = 'RATE_LIMITED';
    res.status(429).json({
      success: false,
      requestId: req.id,
      error: {
        code: 'RATE_LIMITED',
        message: customMessage || options.message || 'Too many requests from this IP. Please try again later.'
      }
    });
  };
}

/**
 * Global API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.apiRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('API request rate limit exceeded for this IP.')
});

/**
 * Specific limiter for analyze requests
 */
const analyzeLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.analyzeRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Analyze request rate limit exceeded for this IP.')
});

/**
 * Specific limiter for download requests
 */
const downloadLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.downloadRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Download request rate limit exceeded for this IP.')
});

module.exports = {
  apiLimiter,
  analyzeLimiter,
  downloadLimiter,
  createRateLimitHandler
};
