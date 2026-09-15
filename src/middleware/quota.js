const quotaService = require('../services/quota.service');

/**
 * Middleware that verifies monthly download quota availability
 */
function verifyMonthlyQuota(req, res, next) {
  try {
    quotaService.checkQuotaAvailable();
    req.quota = quotaService.getQuotaStatus();
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verifyMonthlyQuota
};
