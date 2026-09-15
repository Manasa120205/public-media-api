const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

class QuotaService {
  constructor() {
    this.quotaFile = path.resolve(config.dataStorageDir, 'quota.json');
    this.limit = config.monthlyDownloadLimit;
    this.enabled = config.monthlyQuotaEnabled;
    this.state = this.loadInitialState();
  }

  /**
   * Calculates the current month key (e.g., "2026-09")
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
   * Loads state from disk or initializes fresh state if missing or corrupted
   */
  loadInitialState() {
    const currentMonth = this.getCurrentMonthKey();

    try {
      if (!fs.existsSync(config.dataStorageDir)) {
        fs.mkdirSync(config.dataStorageDir, { recursive: true });
      }

      if (fs.existsSync(this.quotaFile)) {
        const raw = fs.readFileSync(this.quotaFile, 'utf8');
        const data = JSON.parse(raw);

        // Check for month rollover
        if (data && data.month === currentMonth) {
          // Sync with possibly updated environment limit
          data.limit = this.limit;
          return data;
        } else {
          logger.info('Calendar month rolled over; resetting monthly development quota.', {
            previousMonth: data?.month,
            newMonth: currentMonth
          });
        }
      }
    } catch (err) {
      logger.warn('Could not read persistent quota file, initializing fresh state', { error: err.message });
    }

    const fresh = this.createFreshState(currentMonth);
    this.persistState(fresh);
    return fresh;
  }

  /**
   * Atomically persists quota state to data/quota.json
   */
  persistState(state = this.state) {
    try {
      if (!fs.existsSync(config.dataStorageDir)) {
        fs.mkdirSync(config.dataStorageDir, { recursive: true });
      }

      const tempFile = `${this.quotaFile}.tmp-${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tempFile, this.quotaFile);
    } catch (err) {
      logger.error('Failed to persist quota file to disk', { error: err.message });
    }
  }

  /**
   * Checks month rollover before any check or increment
   */
  ensureCurrentMonth() {
    const currentMonth = this.getCurrentMonthKey();
    if (this.state.month !== currentMonth) {
      this.state = this.createFreshState(currentMonth);
      this.persistState();
    }
  }

  /**
   * Gets current quota status summary
   */
  getQuotaStatus() {
    this.ensureCurrentMonth();

    const used = this.state.used;
    const remaining = Math.max(0, this.limit - used);

    return {
      limit: this.limit,
      used,
      remaining,
      totalRequests: this.state.totalRequests,
      successfulRequests: this.state.successfulRequests,
      failedRequests: this.state.failedRequests,
      resetAt: this.state.resetAt,
      enabled: this.enabled
    };
  }

  /**
   * Validates if quota is available. Throws MONTHLY_LIMIT_REACHED if exceeded.
   */
  checkQuotaAvailable() {
    if (!this.enabled) return true;

    this.ensureCurrentMonth();

    if (this.state.used >= this.limit) {
      throw createError(
        'MONTHLY_LIMIT_REACHED',
        'Monthly development download limit reached.'
      );
    }

    return true;
  }

  /**
   * Records a request attempt
   */
  recordAttempt() {
    this.ensureCurrentMonth();
    this.state.totalRequests += 1;
    this.persistState();
  }

  /**
   * Increments successful download usage and updates counts
   */
  recordSuccess() {
    this.ensureCurrentMonth();
    this.state.used += 1;
    this.state.successfulRequests += 1;
    this.persistState();
    return this.getQuotaStatus();
  }

  /**
   * Records a failed download attempt without charging against download usage
   */
  recordFailure() {
    this.ensureCurrentMonth();
    this.state.failedRequests += 1;
    this.persistState();
    return this.getQuotaStatus();
  }

  /**
   * Resets quota (useful for testing or administrative triggers)
   */
  resetQuota(newLimit = this.limit) {
    this.limit = newLimit;
    this.state = this.createFreshState();
    this.persistState();
    return this.getQuotaStatus();
  }
}

module.exports = new QuotaService();
