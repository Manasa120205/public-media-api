const config = require('../config/env');
const MockProvider = require('./providers/mockProvider');
const ExternalProvider = require('./providers/externalProvider');
const OEmbedProvider = require('./providers/oembedProvider');
const logger = require('../utils/logger');

class MediaProviderManager {
  constructor() {
    this.providers = {
      mock: new MockProvider(),
      external: new ExternalProvider(),
      oembed: new OEmbedProvider()
    };

    const requested = (config.mediaProvider || 'mock').toLowerCase();
    this.activeProvider = this.providers[requested] || this.providers.mock;

    logger.info('Initialized MediaProviderManager', {
      activeProvider: this.activeProvider.getName()
    });
  }

  /**
   * Returns currently active provider
   */
  getProvider() {
    return this.activeProvider;
  }

  /**
   * Allows dynamically swapping provider (e.g. for testing)
   */
  setProvider(provider) {
    this.activeProvider = provider;
    return this.activeProvider;
  }

  /**
   * Analyzes media using the active provider
   */
  async analyzeMedia(urlMeta) {
    return this.activeProvider.analyzeMedia(urlMeta);
  }

  /**
   * Downloads media using the active provider
   */
  async downloadMedia(urlMeta) {
    return this.activeProvider.downloadMedia(urlMeta);
  }
}

module.exports = new MediaProviderManager();
