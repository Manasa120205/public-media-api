const express = require('express');
const router = express.Router();

const healthRoutes = require('./health.routes');
const mediaRoutes = require('./media.routes');
const healthController = require('../controllers/health.controller');
const authMiddleware = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

// GET / - Root API info endpoint
router.get('/', healthController.getRootStatus);

// Mount health check endpoint
router.use('/api/health', healthRoutes);

// Mount media endpoints with optional authentication and global API rate limiter
router.use('/api/media', apiLimiter, authMiddleware, mediaRoutes);

module.exports = router;
