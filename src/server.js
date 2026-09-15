const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const storageService = require('./services/storage.service');
const quotaService = require('./services/quota.service');

// Start the HTTP server only if not in serverless runtime or test mode
let server;
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server = app.listen(config.port, () => {
    const quota = quotaService.getQuotaStatus();
    logger.info(`PublicMedia API started successfully`, {
      port: config.port,
      environment: config.nodeEnv,
      mediaProvider: config.mediaProvider,
      authEnabled: config.apiAuthEnabled,
      quotaEnabled: config.monthlyQuotaEnabled,
      monthlyLimit: quota.limit,
      quotaRemaining: quota.remaining
    });
  });

  // Graceful shutdown handling
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    storageService.stopCleanup();

    if (server) {
      server.close(() => {
        logger.info('HTTP server closed. Exiting process.');
        process.exit(0);
      });

      // Force exit if graceful shutdown hangs
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout.');
        process.exit(1);
      }, 5000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
