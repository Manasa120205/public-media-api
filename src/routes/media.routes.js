const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { validateMediaRequest } = require('../middleware/validation');
const { analyzeLimiter, downloadLimiter } = require('../middleware/rateLimit');
const { verifyMonthlyQuota } = require('../middleware/quota');
const requestTimeout = require('../middleware/timeout');

// POST /api/media/analyze
router.post(
  '/analyze',
  analyzeLimiter,
  validateMediaRequest,
  requestTimeout,
  mediaController.analyze
);

// POST /api/media/download
router.post(
  '/download',
  downloadLimiter,
  validateMediaRequest,
  verifyMonthlyQuota,
  requestTimeout,
  mediaController.download
);

// GET /api/media/quota
router.get('/quota', mediaController.getQuota);

module.exports = router;
