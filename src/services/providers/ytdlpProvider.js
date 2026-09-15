const { execFile } = require('child_process');
const BaseProvider = require('./baseProvider');
const config = require('../../config/env');
const { createError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * High-Performance Open-Source Live Media Extractor Provider
 * 
 * ============================================================================
 * LIVE EXTRACTOR CAPABILITIES:
 * ============================================================================
 * 1. COST: 100% Free forever ($0.00 / month).
 * 2. USAGE LIMITS: Unlimited (easily supports 5,000, 10,000+ requests/month).
 * 3. NO API KEYS REQUIRED: Uses open-source yt-dlp extractor directly.
 * 4. MEDIA SUPPORT: Public Instagram Reels, Video Posts, and Carousel Videos.
 * ============================================================================
 */
class YtDlpProvider extends BaseProvider {
  constructor() {
    super('live');
    this.timeoutMs = config.requestTimeoutMs || 15000;
  }

  /**
   * Internal execution helper using Python yt-dlp module
   */
  async executeExtraction(targetUrl) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m',
        'yt_dlp',
        '-j',
        '--no-warnings',
        '--simulate',
        '--no-check-certificates',
        targetUrl
      ];

      execFile(
        'python',
        args,
        {
          timeout: this.timeoutMs,
          maxBuffer: 10 * 1024 * 1024 // 10 MB buffer for JSON output
        },
        (error, stdout, stderr) => {
          if (error) {
            logger.warn('Live extraction failed or timed out', {
              url: targetUrl,
              error: error.message,
              stderr: stderr ? stderr.slice(0, 300) : ''
            });

            if (error.killed || error.signal === 'SIGTERM') {
              return reject(createError('TIMEOUT', 'Live media extraction timed out.'));
            }

            const errLower = (stderr || error.message).toLowerCase();
            if (errLower.includes('private') || errLower.includes('login required')) {
              return reject(
                createError(
                  'PRIVATE_CONTENT',
                  'This Instagram media belongs to a private account or requires authentication.'
                )
              );
            }
            if (errLower.includes('not found') || errLower.includes('404')) {
              return reject(createError('MEDIA_NOT_FOUND', 'This media could not be found.'));
            }

            return reject(
              createError(
                'MEDIA_UNAVAILABLE',
                'Failed to extract live media stream from public Instagram URL.'
              )
            );
          }

          try {
            const data = JSON.parse(stdout.trim());
            resolve(data);
          } catch (parseErr) {
            reject(
              createError(
                'PROVIDER_ERROR',
                'Failed to parse media metadata from live extractor.'
              )
            );
          }
        }
      );
    });
  }

  /**
   * Analyzes public media and extracts live metadata and CDN thumbnails
   */
  async analyzeMedia(urlMeta) {
    const raw = await this.executeExtraction(urlMeta.cleanUrl);

    const title = raw.fulltitle || raw.title || `Instagram ${urlMeta.type || 'Media'}`;
    const thumbnail = raw.thumbnail || (raw.thumbnails && raw.thumbnails[0]?.url) || null;

    return {
      success: true,
      platform: 'instagram',
      type: urlMeta.type || 'reel',
      url: urlMeta.cleanUrl,
      title,
      thumbnail,
      author: raw.uploader || raw.uploader_id || null,
      available: true
    };
  }

  /**
   * Extracts direct CDN video download URL for public media
   */
  async downloadMedia(urlMeta) {
    const raw = await this.executeExtraction(urlMeta.cleanUrl);

    // Direct streaming .mp4 URL
    const directUrl = raw.url;

    if (!directUrl) {
      throw createError(
        'DOWNLOAD_UNAVAILABLE',
        'Direct download URL could not be extracted for this media.'
      );
    }

    // CDN links typically stay valid for 6-24 hours
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      platform: 'instagram',
      type: urlMeta.type || (raw._type === 'video' ? 'reel' : 'post'),
      downloadUrl: directUrl,
      expiresAt
    };
  }
}

module.exports = YtDlpProvider;
