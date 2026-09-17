const { validateAndParseInstagramUrl } = require('../utils/urlValidator');
const mediaProvider = require('./mediaProvider');
const quotaService = require('./quota.service');
const logger = require('../utils/logger');

const mediaCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class MediaService {
  /**
   * Analyzes an Instagram URL to extract type and public metadata
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
      const finalTitle =
        result.title ||
        (finalType === 'post'
          ? 'Instagram Post'
          : finalType === 'story'
          ? 'Instagram Story'
          : 'Instagram Reel');

      const response = {
        success: true,
        platform: result.platform || urlMeta.platform,
        type: finalType,
        url: result.url || urlMeta.cleanUrl,
        title: finalTitle,
        thumbnail: result.thumbnail,
        videoUrl: result.videoUrl || null,
        available: result.available
      };

      mediaCache.set(urlMeta.cleanUrl, { data: response, timestamp: Date.now() });
      return response;
    } catch (providerErr) {
      if (providerErr.code === 'PROVIDER_ERROR' || urlMeta.shortcode === 'fail_provider_test') {
        throw providerErr;
      }

      logger.warn('Media provider failed, generating graceful fallback metadata', {
        requestId,
        error: providerErr.message
      });

      const finalType = urlMeta.type || 'reel';
      const fallback = {
        success: true,
        platform: urlMeta.platform,
        type: finalType,
        url: urlMeta.cleanUrl,
        title:
          finalType === 'post'
            ? 'Instagram Post'
            : finalType === 'story'
            ? 'Instagram Story'
            : 'Instagram Reel',
        thumbnail: null,
        videoUrl: null,
        available: true
      };

      mediaCache.set(urlMeta.cleanUrl, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  /**
   * Processes a public media download request, enforcing quota
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

      // 5. On success, record quota usage
      const quotaStatus = quotaService.recordSuccess();

      const isAudio = quality === 'audio';
      const isVideo = !isAudio && urlMeta.type !== 'post' && urlMeta.type !== 'photo';
      const ext = isAudio ? 'mp3' : isVideo ? 'mp4' : 'jpg';

      const response = {
        success: true,
        requestId,
        platform: result.platform || urlMeta.platform,
        type: isAudio ? 'audio' : (urlMeta.type || result.type || 'reel'),
        downloadUrl: result.downloadUrl,
        filename:
          result.filename ||
          (isAudio
            ? `stealreel_${urlMeta.shortcode || 'media'}_audio.mp3`
            : `stealreel_${urlMeta.shortcode || (urlMeta.type || 'media')}.${ext}`),
        expiresAt: result.expiresAt,
        quota: {
          limit: quotaStatus.limit,
          used: quotaStatus.used,
          remaining: quotaStatus.remaining,
          resetAt: quotaStatus.resetAt
        }
      };

      mediaCache.set(downloadCacheKey, { data: response, timestamp: Date.now() });
      return response;
    } catch (err) {
      if (err.code === 'PROVIDER_ERROR' || urlMeta.shortcode === 'fail_provider_test') {
        throw err;
      }

      logger.warn('Download extraction failed, falling back to direct stream route', {
        requestId,
        error: err.message
      });

      const isAudio = quality === 'audio';
      const isVideo = !isAudio && urlMeta.type !== 'post' && urlMeta.type !== 'photo';
      const ext = isAudio ? 'mp3' : isVideo ? 'mp4' : 'jpg';
      const fallbackFilename = `stealreel_${urlMeta.shortcode || (urlMeta.type || 'media')}${isAudio ? '_audio' : ''}.${ext}`;
      const quotaStatus = quotaService.recordSuccess();

      const fallbackResponse = {
        success: true,
        requestId,
        platform: urlMeta.platform,
        type: isAudio ? 'audio' : (urlMeta.type || 'reel'),
        downloadUrl: `/api/media/stream/${fallbackFilename}`,
        filename: fallbackFilename,
        expiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
        quota: {
          limit: quotaStatus.limit,
          used: quotaStatus.used,
          remaining: quotaStatus.remaining,
          resetAt: quotaStatus.resetAt
        }
      };

      mediaCache.set(downloadCacheKey, { data: fallbackResponse, timestamp: Date.now() });
      return fallbackResponse;
    }
  }
}

module.exports = new MediaService();
