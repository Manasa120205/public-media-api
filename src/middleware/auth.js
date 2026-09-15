const config = require('../config/env');
const planService = require('../services/plan.service');
const { createError } = require('../utils/errors');

/**
 * API Key / Bearer Token Authentication Middleware
 * When API_AUTH_ENABLED=true, verifies incoming Authorization header or x-api-key header.
 * Supports primary API_KEY as well as multi-tier keys from planService.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  // If a token is provided, resolve key info and plan
  if (token) {
    const keyInfo = planService.getKeyInfo(token);
    if (keyInfo) {
      req.apiKey = token;
      req.userPlan = keyInfo.plan;
      req.userId = keyInfo.userId;
    }
  }

  // If auth is not strictly required, proceed
  if (!config.apiAuthEnabled) {
    return next();
  }

  // If auth is enabled, verify token matches primary key or a valid registered plan key
  if (!token || (!req.apiKey && token !== config.apiKey)) {
    return next(
      createError(
        'AUTH_REQUIRED',
        'Valid API key or Bearer token is required to access this endpoint.',
        401
      )
    );
  }

  next();
}

module.exports = authMiddleware;
