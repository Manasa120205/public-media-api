const { createError } = require('../utils/errors');

/**
 * Middleware to validate media request payload
 */
function validateMediaRequest(req, res, next) {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return next(
      createError(
        'INVALID_URL',
        'Request body must contain a valid, non-empty "url" property.',
        400
      )
    );
  }

  // Normalize trimmed URL
  req.body.url = url.trim();
  next();
}

module.exports = {
  validateMediaRequest
};
