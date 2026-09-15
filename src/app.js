const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const requestIdMiddleware = require('./utils/requestId');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Trust reverse proxies (Render, Vercel, Nginx, Cloudflare) for accurate client IPs in rate limiting
app.set('trust proxy', 1);

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
  })
);

// Serve interactive developer console UI
app.use('/demo', express.static(path.resolve(__dirname, '../public')));
app.get('/demo', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

// CORS configuration
const corsOptions = {
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
  maxAge: 86400 // 24 hours preflight cache
};
app.use(cors(corsOptions));

// Body size limit to protect against payload DOS attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Attach unique tracing request ID to every request
app.use(requestIdMiddleware);

// HTTP structured request/response logging
app.use(logger.httpMiddleware);

// Mount application routes
app.use('/', routes);

// 404 Not Found handler
app.use(notFoundHandler);

// Global centralized error handler
app.use(errorHandler);

module.exports = app;
