const https = require('https');
const BaseProvider = require('./baseProvider');
const config = require('../../config/env');
const { createError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Official Meta Instagram oEmbed Provider Adapter
 * 
 * ============================================================================
 * META OEMBED SPECIFICATION & CREDENTIAL GUIDE
 * ============================================================================
 * 1. PURPOSE:
 *    - Retrieves official legal public metadata (title, author, thumbnail)
 *      directly from Meta's Graph API for Instagram Reels and Posts.
 * 
 * 2. COST & LIMITS:
 *    - 100% Free.
 *    - Rate limit: 5,000,000 requests per rolling 24 hours per Meta App.
 * 
 * 3. REQUIRED CREDENTIALS (Configure in .env):
 *    - INSTAGRAM_ACCESS_TOKEN: Your Meta App Token in the format:
 *      {APP_ID}|{CLIENT_TOKEN}
 *      (Available in Meta Developer Portal -> App Settings -> Advanced -> Client Token).
 * 
 * 4. DOWNLOAD LIMITATION:
 *    - Note: In compliance with Meta Developer Policies, the official oEmbed API
 *      delivers metadata, author information, and thumbnails. It does NOT deliver
 *      raw MP4 video streams. For raw video streams, pair with an authorized
 *      downstream microservice adapter (ExternalProvider).
 * ============================================================================
 */
class OEmbedProvider extends BaseProvider {
  constructor() {
    super('oembed');
    this.accessToken = config.instagramAccessToken;
    this.timeoutMs = config.requestTimeoutMs;
  }

  /**
   * Helper to request Meta Graph oEmbed endpoint
   */
  async fetchOEmbed(url) {
    if (!this.accessToken) {
      throw createError(
        'PROVIDER_ERROR',
        'INSTAGRAM_ACCESS_TOKEN ({APP_ID}|{CLIENT_TOKEN}) is not configured in .env for oEmbed provider.'
      );
    }

    const apiUrl = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(
      url
    )}&access_token=${encodeURIComponent(this.accessToken)}`;

    return new Promise((resolve, reject) => {
      let isDone = false;

      const req = https.get(apiUrl, (res) => {
        let body = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (isDone) return;
          isDone = true;

          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              const errMsg = data.error?.message || `Meta Graph API returned status ${res.statusCode}`;
              if (res.statusCode === 404 || res.statusCode === 400) {
                reject(createError('MEDIA_UNAVAILABLE', errMsg));
              } else {
                reject(createError('PROVIDER_ERROR', errMsg));
              }
            }
          } catch (err) {
            reject(createError('PROVIDER_ERROR', 'Failed to parse Meta Graph API response.'));
          }
        });
      });

      req.on('timeout', () => {
        if (isDone) return;
        isDone = true;
        req.destroy();
        reject(createError('TIMEOUT', 'Connection to Meta Graph API timed out.'));
      });

      req.on('error', (err) => {
        if (isDone) return;
        isDone = true;
        reject(createError('PROVIDER_ERROR', `Network error connecting to Meta Graph API: ${err.message}`));
      });

      req.setTimeout(this.timeoutMs);
    });
  }

  /**
   * Analyzes public media using official Meta oEmbed endpoint
   */
  async analyzeMedia(urlMeta) {
    const rawData = await this.fetchOEmbed(urlMeta.cleanUrl);

    return {
      success: true,
      platform: 'instagram',
      type: urlMeta.type || 'post',
      url: urlMeta.cleanUrl,
      title: rawData.title || `Post by ${rawData.author_name || 'Instagram User'}`,
      thumbnail: rawData.thumbnail_url || null,
      author: rawData.author_name || null,
      available: true
    };
  }

  /**
   * Handles download request
   */
  async downloadMedia(urlMeta) {
    // Check if metadata exists
    const meta = await this.analyzeMedia(urlMeta);

    // If image post, thumbnail is available
    if (urlMeta.type === 'post' && meta.thumbnail) {
      return {
        success: true,
        platform: 'instagram',
        type: 'post',
        downloadUrl: meta.thumbnail,
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
    }

    throw createError(
      'DOWNLOAD_UNAVAILABLE',
      'Meta oEmbed API provides metadata and preview assets only. Direct MP4 stream downloads require an authorized upstream video provider (use MEDIA_PROVIDER=external or mock).'
    );
  }
}

module.exports = OEmbedProvider;
