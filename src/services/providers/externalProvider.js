const http = require('http');
const https = require('https');
const BaseProvider = require('./baseProvider');
const config = require('../../config/env');
const { createError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * External Provider Adapter
 * 
 * ============================================================================
 * EXTERNAL PROVIDER INTEGRATION SPECIFICATION & AUDIT
 * ============================================================================
 * 1. WHAT SERVICE IS REQUIRED:
 *    - To retrieve public Instagram media metadata and direct media streams without
 *      violating user sessions, an upstream media microservice or authorized
 *      aggregator endpoint (e.g. RapidAPI Instagram Scraper/Downloader, Meta oEmbed API,
 *      or dedicated proxy server) is configured via EXTERNAL_PROVIDER_URL.
 * 
 * 2. FREE TIER AVAILABILITY & MONTHLY LIMITS:
 *    - RapidAPI popular Instagram endpoints typically offer a free basic tier
 *      ranging from 100 to 500 requests per month. Higher volume (like 5,000/mo)
 *      requires either multiple pooled keys or a paid subscription ($10-$30/month).
 *    - Official Meta oEmbed API is free, but requires a registered Meta Developer
 *      App with Facebook Login Review.
 * 
 * 3. MEDIA CAPABILITIES:
 *    - Reels: Supported on public profiles.
 *    - Video / Image Posts: Supported on public profiles.
 *    - Public Stories: Frequently restricted because Instagram requires active
 *      session cookies even for public accounts to view stories.
 * 
 * 4. REQUIRED CREDENTIALS:
 *    - EXTERNAL_PROVIDER_URL: Endpoint URL of the upstream service
 *    - EXTERNAL_PROVIDER_API_KEY: Secret API key for the upstream service
 *    - INSTAGRAM_ACCESS_TOKEN: Optional Meta Graph App token (if using oEmbed)
 * ============================================================================
 */
class ExternalProvider extends BaseProvider {
  constructor() {
    super('external');
    this.endpointUrl = config.externalProviderUrl;
    this.apiKey = config.externalProviderApiKey;
    this.timeoutMs = config.requestTimeoutMs;
  }

  /**
   * Helper to perform safe HTTP/HTTPS requests with timeout
   */
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      let isDone = false;

      const req = client.request(url, options, (res) => {
        let body = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (isDone) return;
          isDone = true;

          try {
            const parsed = body ? JSON.parse(body) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(createError('PROVIDER_ERROR', parsed.message || `Upstream provider returned status ${res.statusCode}`));
            }
          } catch (err) {
            reject(createError('PROVIDER_ERROR', 'Failed to parse downstream provider response.'));
          }
        });
      });

      req.on('timeout', () => {
        if (isDone) return;
        isDone = true;
        req.destroy();
        reject(createError('TIMEOUT', 'Connection to external provider timed out.'));
      });

      req.on('error', (err) => {
        if (isDone) return;
        isDone = true;
        reject(createError('PROVIDER_ERROR', `Network error connecting to external provider: ${err.message}`));
      });

      req.setTimeout(this.timeoutMs);

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Analyze public media using external provider
   */
  async analyzeMedia(urlMeta) {
    if (!this.endpointUrl) {
      throw createError(
        'PROVIDER_ERROR',
        'EXTERNAL_PROVIDER_URL is not configured in environment. Switch MEDIA_PROVIDER=mock for offline development.'
      );
    }

    try {
      const targetUrl = new URL('/analyze', this.endpointUrl);
      const headers = {
        'Content-Type': 'application/json'
      };
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await this.request(targetUrl.toString(), {
        method: 'POST',
        headers,
        body: { url: urlMeta.cleanUrl, type: urlMeta.type, shortcode: urlMeta.shortcode }
      });

      return {
        success: true,
        platform: 'instagram',
        type: response.type || urlMeta.type,
        url: urlMeta.cleanUrl,
        title: response.title || `Instagram ${urlMeta.type}`,
        thumbnail: response.thumbnail || null,
        available: true
      };
    } catch (err) {
      logger.error('ExternalProvider analyzeMedia failed', { error: err.message, url: urlMeta.cleanUrl });
      if (err.code) throw err;
      throw createError('MEDIA_UNAVAILABLE', 'The requested public media could not be retrieved from external provider.');
    }
  }

  /**
   * Download public media using external provider
   */
  async downloadMedia(urlMeta) {
    if (!this.endpointUrl) {
      throw createError(
        'PROVIDER_ERROR',
        'EXTERNAL_PROVIDER_URL is not configured in environment. Switch MEDIA_PROVIDER=mock for offline development.'
      );
    }

    try {
      const targetUrl = new URL('/download', this.endpointUrl);
      const headers = {
        'Content-Type': 'application/json'
      };
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await this.request(targetUrl.toString(), {
        method: 'POST',
        headers,
        body: { url: urlMeta.cleanUrl, type: urlMeta.type, shortcode: urlMeta.shortcode }
      });

      if (!response.downloadUrl) {
        throw createError('DOWNLOAD_UNAVAILABLE', 'This media cannot currently be retrieved.');
      }

      return {
        success: true,
        platform: 'instagram',
        type: response.type || urlMeta.type,
        downloadUrl: response.downloadUrl,
        expiresAt: response.expiresAt || new Date(Date.now() + 3600000).toISOString()
      };
    } catch (err) {
      logger.error('ExternalProvider downloadMedia failed', { error: err.message, url: urlMeta.cleanUrl });
      if (err.code) throw err;
      throw createError('DOWNLOAD_UNAVAILABLE', 'This media cannot currently be retrieved.');
    }
  }
}

module.exports = ExternalProvider;
