/**
 * Abstract Base Provider Interface for Media Retrieval
 * 
 * Any concrete provider (Mock, External Scraper, Meta Graph API, RapidAPI)
 * must implement these methods.
 */
class BaseProvider {
  /**
   * @param {string} name - Unique identifier for this provider
   */
  constructor(name) {
    this.name = name;
  }

  getName() {
    return this.name;
  }

  /**
   * Analyzes media URL and retrieves public metadata
   * @param {Object} urlMeta - Parsed URL metadata from urlValidator
   * @returns {Promise<Object>} Structured metadata
   */
  async analyzeMedia(urlMeta) {
    throw new Error(`Method "analyzeMedia" must be implemented by provider ${this.name}`);
  }

  /**
   * Processes and prepares public media for download
   * @param {Object} urlMeta - Parsed URL metadata from urlValidator
   * @returns {Promise<Object>} Download link and expiration details
   */
  async downloadMedia(urlMeta) {
    throw new Error(`Method "downloadMedia" must be implemented by provider ${this.name}`);
  }
}

module.exports = BaseProvider;
