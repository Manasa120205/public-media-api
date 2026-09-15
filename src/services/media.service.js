const { validateAndParseInstagramUrl } = require('../utils/urlValidator');
const mediaProvider = require('./mediaProvider');
const quotaService = require('./quota.service');
const logger = require('../utils/logger');

class MediaService {
  /**
   * Analyzes an Instagram URL to extract type and public metadata
   */
  async analyze(url, requestId) {
    // 1. Validate and parse URL (checks domain, SSRF, path structure, shortcode)
    const urlMeta = validateAndParseInstagramUrl(url);

    logger.info('Analyzing public media URL', {
      requestId,
      type: urlMeta.type,
      shortcode: urlMeta.shortcode
    });

    // 2. Delegate retrieval to active media provider
    const result = await mediaProvider.analyzeMedia(urlMeta);

    return {
      success: true,
      platform: result.platform || urlMeta.platform,
      type: result.type || urlMeta.type,
      url: result.url || urlMeta.cleanUrl,
      title: result.title,
      thumbnail: result.thumbnail,
      available: result.available
    };
  }

  /**
   * Processes a public media download request, enforcing quota
   */
  async download(url, requestId) {
    // 1. Validate and parse URL
    const urlMeta = validateAndParseInstagramUrl(url);

    // 2. Verify monthly quota availability
    quotaService.checkQuotaAvailable();

    // 3. Record attempt
    quotaService.recordAttempt();

    logger.info('Processing public media download', {
      requestId,
      type: urlMeta.type,
      shortcode: urlMeta.shortcode
    });

    try {
      // 4. Delegate download processing to active media provider
      const result = await mediaProvider.downloadMedia(urlMeta);

      // 5. On success, record quota usage
      const quotaStatus = quotaService.recordSuccess();

      return {
        success: true,
        requestId,
        platform: result.platform || urlMeta.platform,
        type: result.type || urlMeta.type,
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt,
        quota: {
          limit: quotaStatus.limit,
          used: quotaStatus.used,
          remaining: quotaStatus.remaining,
          resetAt: quotaStatus.resetAt
        }
      };
    } catch (err) {
      // Record failure for analytics without consuming download quota
      quotaService.recordFailure();
      throw err;
    }
  }
}

module.exports = new MediaService();
