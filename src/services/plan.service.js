const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free Tier',
    monthlyDownloads: 50,
    priceCents: 0
  },
  BASIC: {
    id: 'basic',
    name: 'Basic Plan',
    monthlyDownloads: 1000,
    priceCents: null // Ready for Stripe / Razorpay
  },
  PRO: {
    id: 'pro',
    name: 'Pro Plan',
    monthlyDownloads: 5000,
    priceCents: null
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium Plan',
    monthlyDownloads: 25000,
    priceCents: null
  }
};

class PlanService {
  constructor() {
    this.plans = PLANS;
    this.keysFile = path.resolve(config.dataStorageDir, 'keys.json');
    this.keys = this.loadKeys();
  }

  /**
   * Loads API keys and plan associations from data/keys.json
   */
  loadKeys() {
    try {
      if (!fs.existsSync(config.dataStorageDir)) {
        fs.mkdirSync(config.dataStorageDir, { recursive: true });
      }

      if (fs.existsSync(this.keysFile)) {
        const raw = fs.readFileSync(this.keysFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.warn('Could not read keys.json, initializing defaults', { error: err.message });
    }

    // Default pre-seeded keys for local testing
    const defaultKeys = {
      [config.apiKey]: {
        key: config.apiKey,
        userId: 'dev_admin',
        plan: 'pro',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      'free-demo-key-123': {
        key: 'free-demo-key-123',
        userId: 'demo_free_user',
        plan: 'free',
        enabled: true,
        createdAt: new Date().toISOString()
      }
    };

    this.persistKeys(defaultKeys);
    return defaultKeys;
  }

  /**
   * Persists keys atomically
   */
  persistKeys(keys = this.keys) {
    try {
      if (!fs.existsSync(config.dataStorageDir)) {
        fs.mkdirSync(config.dataStorageDir, { recursive: true });
      }
      const tmp = `${this.keysFile}.tmp-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), 'utf8');
      fs.renameSync(tmp, this.keysFile);
    } catch (err) {
      logger.error('Failed to persist keys to disk', { error: err.message });
    }
  }

  /**
   * Retrieves key info including assigned subscription plan
   */
  getKeyInfo(apiKey) {
    if (!apiKey) return null;

    // Check pre-configured primary key
    if (apiKey === config.apiKey) {
      return {
        key: apiKey,
        userId: 'dev_admin',
        plan: 'pro',
        enabled: true
      };
    }

    return this.keys[apiKey] || null;
  }

  /**
   * Creates a new API key with an assigned plan tier
   */
  createApiKey(userId, planName = 'free') {
    const cleanPlan = (planName || 'free').toUpperCase();
    if (!this.plans[cleanPlan]) {
      throw createError('INTERNAL_ERROR', `Invalid plan name: ${planName}`);
    }

    const newKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
    this.keys[newKey] = {
      key: newKey,
      userId: userId || `user_${Date.now()}`,
      plan: cleanPlan.toLowerCase(),
      enabled: true,
      createdAt: new Date().toISOString()
    };

    this.persistKeys();
    return this.keys[newKey];
  }

  /**
   * Returns monthly download limit for a given plan ID
   */
  getPlanLimit(planId = 'free') {
    const key = Object.keys(this.plans).find(
      (k) => this.plans[k].id.toLowerCase() === planId.toLowerCase()
    );
    return key ? this.plans[key].monthlyDownloads : this.plans.FREE.monthlyDownloads;
  }

  /**
   * Resolves user plan
   */
  async getUserPlan(userId = 'dev_admin') {
    const entry = Object.values(this.keys).find((k) => k.userId === userId);
    const planKey = (entry?.plan || 'pro').toUpperCase();
    return this.plans[planKey] || this.plans.FREE;
  }
}

module.exports = new PlanService();
module.exports.PLANS = PLANS;
