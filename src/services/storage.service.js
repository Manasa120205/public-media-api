const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

class StorageService {
  constructor() {
    this.storageDir = config.tempStorageDir;
    this.maxAgeMs = config.storageFileMaxAgeMs;
    this.cleanupIntervalMs = config.storageCleanupIntervalMs;
    this.cleanupTimer = null;

    this.ensureStorageDir();
    if (!config.isTest) {
      this.startPeriodicCleanup();
    }
  }

  /**
   * Ensure the temporary directory exists
   */
  ensureStorageDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (err) {
      logger.error('Failed to create temporary storage directory', { error: err.message, dir: this.storageDir });
    }
  }

  /**
   * Generates a safe, randomized temporary file path with extension
   */
  generateTempFilePath(extension = '.tmp') {
    // Sanitize extension
    const cleanExt = extension.replace(/[^a-zA-Z0-9.]/g, '') || '.tmp';
    const randomName = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${cleanExt}`;
    const filePath = path.resolve(this.storageDir, randomName);

    // Verify against directory traversal
    if (!filePath.startsWith(this.storageDir)) {
      throw createError('INTERNAL_ERROR', 'Path traversal attempt detected during temporary file generation.');
    }

    return filePath;
  }

  /**
   * Safely deletes a file in the temp directory
   */
  deleteFile(filePath) {
    try {
      if (!filePath) return;
      const normalizedPath = path.resolve(filePath);

      // Guard against deleting anything outside storage directory
      if (!normalizedPath.startsWith(this.storageDir)) {
        logger.warn('Attempted to delete file outside storage dir', { path: filePath });
        return;
      }

      if (fs.existsSync(normalizedPath)) {
        fs.unlinkSync(normalizedPath);
      }
    } catch (err) {
      logger.error('Failed to delete temporary file', { path: filePath, error: err.message });
    }
  }

  /**
   * Cleans up expired files
   */
  cleanupExpiredFiles() {
    try {
      if (!fs.existsSync(this.storageDir)) return;

      const files = fs.readdirSync(this.storageDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        if (file === '.gitkeep') continue;

        const filePath = path.join(this.storageDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > this.maxAgeMs) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch {
          // File might have already been removed by another process
        }
      }

      if (deletedCount > 0) {
        logger.info('Cleaned up expired temporary files', { deletedCount });
      }
    } catch (err) {
      logger.error('Error during temporary file cleanup', { error: err.message });
    }
  }

  /**
   * Starts periodic background cleanup
   */
  startPeriodicCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredFiles();
    }, this.cleanupIntervalMs);

    // Allow Node.js process to exit cleanly if timer is active
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stops periodic cleanup (used for tests or shutdown)
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

module.exports = new StorageService();
