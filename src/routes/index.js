const express = require('express');
const router = express.Router();

const healthRoutes = require('./health.routes');
const mediaRoutes = require('./media.routes');
const healthController = require('../controllers/health.controller');
const mediaController = require('../controllers/media.controller');
const authMiddleware = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const docsController = require('../controllers/docs.controller');

// GET / - Root API info endpoint
router.get('/', healthController.getRootStatus);

// Mount health check endpoint
router.use('/api/health', healthRoutes);

// GET /api/quota - Direct quota status endpoint
router.get('/api/quota', mediaController.getQuota);

// Interactive OpenAPI 3.0 Documentation
router.get('/docs', docsController.getDocsUi);
router.get('/api/docs', docsController.getDocsUi);
router.get('/docs/openapi.json', docsController.getOpenApiSpec);
router.get('/api/docs/openapi.json', docsController.getOpenApiSpec);

// Mount media endpoints with optional authentication and global API rate limiter
router.use('/api/media', apiLimiter, authMiddleware, mediaRoutes);

module.exports = router;
