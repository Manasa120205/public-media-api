const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

class QuotaService {
  constructor() {
    this.quotaFile = config.quotaFilePath || path.resolve(config.dataStorageDir, 'quota.json');
    this.limit = config.monthlyDownloadLimit || 5000;
    this.enabled = config.monthlyQuotaEnabled;
    this.state = this.readDiskState();
  }

  /**
   * Calculates the current UTC month key (e.g., "2026-09")
   */
  getCurrentMonthKey(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Calculates the ISO string for the 1st day of the next calendar month at UTC 00:00:00
   */
  getNextResetDate(date = new Date()) {
    const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    return nextMonth.toISOString();
  }

  /**
   * Default fresh quota state
   */
  createFreshState(monthKey = this.getCurrentMonthKey()) {
    return {
      month: monthKey,
      limit: this.limit,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      used: 0,
      resetAt: this.getNextResetDate()
    };
  }

  /**
   * Reads persistent quota state directly from disk with automatic month rollover check
   */
  readDiskState() {
    const currentMonth = this.getCurrentMonthKey();
    const dir = path.dirname(this.quotaFile);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.quotaFile)) {
        const raw = fs.readFileSync(this.quotaFile, 'utf8');
        const data = JSON.parse(raw);

        // Check if file belongs to the current calendar month
        if (data && data.month === currentMonth) {
          data.limit = this.limit;
          this.state = data;
          return data;
        } else if (data && data.month && data.month !== currentMonth) {
          logger.info('Calendar month rolled over; resetting monthly development quota.', {
            previousMonth: data.month,
            newMonth: currentMonth
          });
        }
      }
    } catch (err) {
      logger.warn('Could not read persistent quota file, initializing fresh state', { error: err.message });
    }

    const fresh = this.createFreshState(currentMonth);
    this.state = fresh;
    this.persistState(fresh);
    return fresh;
  }

  /**
   * Atomically persists quota state to disk using a temporary file
   */
  persistState(state = this.state) {
    const dir = path.dirname(this.quotaFile);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tempFile = `${this.quotaFile}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tempFile, this.quotaFile);
    } catch (err) {
      logger.error('Failed to persist quota file to disk', { error: err.message, file: this.quotaFile });
    }
  }

  /**
   * Returns current quota status summary matching public API specifications
   */
  getQuotaStatus() {
    this.readDiskState();

    const used = Number(this.state.used) || 0;
    const limit = Number(this.limit) || 5000;
    const remaining = Math.max(0, limit - used);
    const percentageUsed = limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : 0;

    return {
      limit,
      used,
      remaining,
      percentageUsed,
      month: this.state.month || this.getCurrentMonthKey(),
      totalRequests: this.state.totalRequests || 0,
      successfulRequests: this.state.successfulRequests || 0,
      failedRequests: this.state.failedRequests || 0,
      resetAt: this.state.resetAt || this.getNextResetDate(),
      enabled: this.enabled
    };
  }

  /**
   * Validates if quota is available. Throws MONTHLY_LIMIT_REACHED if exhausted.
   */
  checkQuotaAvailable() {
    if (!this.enabled) return true;

    this.readDiskState();

    if (this.state.used >= this.limit) {
      throw createError(
        'MONTHLY_LIMIT_REACHED',
        'Monthly development download limit reached.'
      );
    }

    return true;
  }

  /**
   * Records a request attempt without charging download quota
   */
  recordAttempt() {
    this.readDiskState();
    this.state.totalRequests = (Number(this.state.totalRequests) || 0) + 1;
    this.persistState();
  }

  /**
   * Atomically increments download usage on successful download creation
   */
  recordSuccess() {
    this.readDiskState();
    this.state.used = (Number(this.state.used) || 0) + 1;
    this.state.successfulRequests = (Number(this.state.successfulRequests) || 0) + 1;
    this.state.totalRequests = (Number(this.state.totalRequests) || 0) + 1;
    this.persistState();
    return this.getQuotaStatus();
  }

  /**
   * Records a failed download attempt without charging against download quota
   */
  recordFailure() {
    this.readDiskState();
    this.state.failedRequests = (Number(this.state.failedRequests) || 0) + 1;
    this.state.totalRequests = (Number(this.state.totalRequests) || 0) + 1;
    this.persistState();
    return this.getQuotaStatus();
  }

  /**
   * Resets quota (used for automated testing or administrative triggers)
   */
  resetQuota(newLimit = this.limit) {
    this.limit = newLimit;
    this.state = this.createFreshState();
    this.persistState();
    return this.getQuotaStatus();
  }
}

module.exports = new QuotaService();
