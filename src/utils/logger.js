const config = require('../config/env');

const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'api_key',
  'apikey',
  'secret',
  'cookie',
  'access_token'
];

/**
 * Recursively sanitize objects to redact sensitive keys before logging
 */
function sanitize(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Format and write structured log entry
 */
function logMessage(level, message, meta = {}) {
  // Silence regular logs in test mode unless specifically debugging
  if (config.isTest && process.env.TEST_LOGS !== 'true') return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...sanitize(meta)
  };

  const formatted = JSON.stringify(logEntry);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

const logger = {
  info: (msg, meta) => logMessage('info', msg, meta),
  warn: (msg, meta) => logMessage('warn', msg, meta),
  error: (msg, meta) => logMessage('error', msg, meta),
  debug: (msg, meta) => {
    if (!config.isProduction) logMessage('debug', msg, meta);
  },
  /**
   * Express middleware to log incoming HTTP requests and response performance
   */
  httpMiddleware: (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const meta = {
        requestId: req.id,
        method: req.method,
        endpoint: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTimeMs: durationMs,
        ip: req.ip || req.connection.remoteAddress,
        mediaType: req.detectedMediaType || undefined,
        errorCode: res.errorCode || undefined
      };

      if (res.statusCode >= 500) {
        logger.error('HTTP Request failed', meta);
      } else if (res.statusCode >= 400) {
        logger.warn('HTTP Request client error', meta);
      } else {
        logger.info('HTTP Request completed', meta);
      }
    });

    next();
  }
};

module.exports = logger;
