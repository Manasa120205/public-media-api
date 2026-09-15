const crypto = require('crypto');

/**
 * Middleware to ensure every incoming request has a unique Request ID for tracing.
 * Accepts existing X-Request-Id header if valid alphanumeric/hyphen string,
 * otherwise generates a secure random UUIDv4.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];

  // Validate format to prevent header injection or malformed values
  if (existingId && typeof existingId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(existingId)) {
    req.id = existingId;
  } else {
    req.id = crypto.randomUUID();
  }

  // Set the header on outgoing response
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestIdMiddleware;
