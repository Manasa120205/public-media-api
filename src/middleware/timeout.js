const config = require('../config/env');
const { createError } = require('../utils/errors');

/**
 * Request timeout middleware
 */
function requestTimeout(req, res, next) {
  // Can be customized per route or default to config
  const timeoutMs = req.timeoutMs || config.requestTimeoutMs;

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.errorCode = 'TIMEOUT';
      const timeoutError = createError(
        'TIMEOUT',
        `The request exceeded the processing timeout of ${timeoutMs}ms.`,
        504
      );
      next(timeoutError);
    }
  }, timeoutMs);

  // Clear timeout on response finish or close
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));

  next();
}

module.exports = requestTimeout;
