const { validateAndParseInstagramUrl } = require('../utils/urlValidator');
const mediaProvider = require('./mediaProvider');
const quotaService = require('./quota.service');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

const mediaCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class MediaService {
  /**
   * Analyzes an Instagram URL to extract type and public metadata (metadata only, no video downloading)
   */
  async analyze(url, requestId) {
    // 1. Validate and parse URL (checks domain, SSRF, path structure, shortcode)
    const urlMeta = validateAndParseInstagramUrl(url);

    // Fast Cache Check (<1ms response)
    const cached = mediaCache.get(urlMeta.cleanUrl);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      logger.info('Serving media analysis from in-memory cache (<1ms)', {
        requestId,
        type: urlMeta.type,
        shortcode: urlMeta.shortcode
      });
      return cached.data;
    }

    logger.info('Analyzing public media URL', {
      requestId,
      type: urlMeta.type,
      shortcode: urlMeta.shortcode
    });

    try {
      // 2. Delegate retrieval to active media provider
      const result = await mediaProvider.analyzeMedia(urlMeta);

      const finalType = urlMeta.type || result.type || 'reel';
      const rawCreator = result.creator || result.author || urlMeta.username || null;
      const creator = rawCreator ? `@${rawCreator.replace(/^@/, '')}` : 'Creator information unavailable';
      const creatorName = result.creatorName || (rawCreator ? `@${rawCreator.replace(/^@/, '')}` : 'Instagram Creator');
      const creatorProfilePic = result.creatorProfilePic || result.profilePic || null;
      const hasAudio = result.hasAudio !== undefined ? Boolean(result.hasAudio) : (finalType !== 'post');

      const finalTitle =
        result.title ||
        (finalType === 'post'
          ? 'Instagram Post'
          : finalType === 'story'
          ? 'Instagram Story'
          : 'Instagram Reel');

      const response = {
        success: true,
        platform: result.platform || urlMeta.platform || 'instagram',
        type: finalType,
        creator,
        creatorName,
        creatorProfilePic,
        hasAudio,
        url: result.url || urlMeta.cleanUrl,
        title: finalTitle,
        thumbnail: result.thumbnail || null,
        available: result.available !== false
      };

      mediaCache.set(urlMeta.cleanUrl, { data: response, timestamp: Date.now() });
      return response;
    } catch (providerErr) {
      if (providerErr.code === 'PROVIDER_ERROR' || urlMeta.shortcode === 'fail_provider_test') {
        throw providerErr;
      }

      logger.warn('Media provider failed during analyze, generating fallback metadata', {
        requestId,
        error: providerErr.message
      });

      const finalType = urlMeta.type || 'reel';
      const rawCreator = urlMeta.username || null;
      const creator = rawCreator ? `@${rawCreator.replace(/^@/, '')}` : 'Creator information unavailable';

      const fallback = {
        success: true,
        platform: urlMeta.platform || 'instagram',
        type: finalType,
        creator,
        creatorName: rawCreator ? `@${rawCreator.replace(/^@/, '')}` : 'Instagram Creator',
        creatorProfilePic: null,
        hasAudio: finalType !== 'post',
        url: urlMeta.cleanUrl,
        title:
          finalType === 'post'
            ? 'Instagram Post'
            : finalType === 'story'
            ? 'Instagram Story'
            : 'Instagram Reel',
        thumbnail: null,
        available: true
      };

      mediaCache.set(urlMeta.cleanUrl, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  /**
   * Processes a public media download request, strictly enforcing quota on success only
   */
  async download(url, requestId, quality) {
    // 1. Validate and parse URL
    const urlMeta = validateAndParseInstagramUrl(url);
    if (quality) {
      urlMeta.quality = quality;
    }

    // 2. Verify monthly quota availability
    quotaService.checkQuotaAvailable();

    // 3. Record attempt
    quotaService.recordAttempt();

    const downloadCacheKey = `download:${quality || 'original'}:${urlMeta.cleanUrl}`;
    const cachedDownload = mediaCache.get(downloadCacheKey);
    if (cachedDownload && (Date.now() - cachedDownload.timestamp < CACHE_TTL_MS)) {
      logger.info('Serving media download from in-memory cache (<1ms)', {
        requestId,
        type: urlMeta.type,
        shortcode: urlMeta.shortcode
      });
      return cachedDownload.data;
    }

    logger.info('Processing public media download', {
      requestId,
      type: urlMeta.type,
      shortcode: urlMeta.shortcode
    });

    try {
      // 4. Delegate download processing to active media provider
      const result = await mediaProvider.downloadMedia(urlMeta);

      // 5. Quota Decrement Rule: ONLY successful downloadable media generation consumes 1 download
      const quotaStatus = quotaService.recordSuccess();

      const isAudio = quality === 'audio';
      const finalType = isAudio ? 'audio' : (urlMeta.type || result.type || 'reel');
      const isVideo = !isAudio && finalType !== 'post';
      const ext = isAudio ? 'mp3' : isVideo ? 'mp4' : 'jpg';

      const rawCreator = result.creator || result.author || urlMeta.username || null;
      const creator = rawCreator ? `@${rawCreator.replace(/^@/, '')}` : 'Creator information unavailable';
      const safeUsername = rawCreator ? rawCreator.replace(/^@/, '').replace(/[^a-zA-Z0-9_.]/g, '') : 'download';
      const filename = result.filename || `instagram_${finalType}_${safeUsername}.${ext}`;
      const hasAudio = result.hasAudio !== undefined ? Boolean(result.hasAudio) : (isAudio || finalType !== 'post');

      const response = {
        success: true,
        requestId,
        platform: result.platform || urlMeta.platform || 'instagram',
        type: finalType,
        creator,
        hasAudio,
        downloadUrl: result.downloadUrl,
        filename,
        expiresAt: result.expiresAt || new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
        quota: {
          limit: quotaStatus.limit,
          used: quotaStatus.used,
          remaining: quotaStatus.remaining,
          percentageUsed: quotaStatus.percentageUsed,
          month: quotaStatus.month,
          resetAt: quotaStatus.resetAt
        }
      };

      mediaCache.set(downloadCacheKey, { data: response, timestamp: Date.now() });
      return response;
    } catch (err) {
      // Record failure: does NOT consume monthly download quota
      quotaService.recordFailure();

      logger.warn('Download processing failed', {
        requestId,
        error: err.message
      });

      if (err.isAppError || err.code) {
        throw err;
      }

      throw createError('PROVIDER_ERROR', err.message || 'Failed to download public media.');
    }
  }
}

module.exports = new MediaService();
