const BaseProvider = require('./baseProvider');
const { createError } = require('../../utils/errors');

/**
 * Mock Provider for offline local development and test automation.
 * Does not call any external network or Instagram servers.
 * Generates realistic structured responses and handles simulated error triggers.
 */
class MockProvider extends BaseProvider {
  constructor() {
    super('mock');
  }

  /**
   * Analyzes media URL and returns realistic public metadata
   */
  async analyzeMedia(urlMeta) {
    const { shortcode, cleanUrl, type } = urlMeta;

    // Simulated test scenarios
    if (shortcode && shortcode.includes('fail_provider')) {
      throw createError('PROVIDER_ERROR', 'Mock provider simulated a downstream service failure.');
    }
    if (shortcode && shortcode.includes('unavailable')) {
      throw createError('MEDIA_UNAVAILABLE', 'The requested public media could not be retrieved.');
    }
    if (shortcode && shortcode.includes('not_found')) {
      throw createError('MEDIA_NOT_FOUND', 'The requested Instagram post could not be found.');
    }
    if (shortcode && shortcode.includes('timeout')) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      throw createError('TIMEOUT', 'The media retrieval operation timed out.');
    }

    // Default mock thumbnails and sample media
    const mockThumbnails = {
      reel: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&auto=format&fit=crop&q=80',
      post: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=640&auto=format&fit=crop&q=80',
      story: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=640&auto=format&fit=crop&q=80'
    };

    return {
      success: true,
      platform: 'instagram',
      type: type || 'reel',
      url: cleanUrl,
      title: `Instagram ${type.charAt(0).toUpperCase() + type.slice(1)} [${shortcode || 'story'}]`,
      thumbnail: mockThumbnails[type] || mockThumbnails.reel,
      author: '@instagram_creator',
      creator: '@instagram_creator',
      hasAudio: type !== 'post',
      available: true
    };
  }

  /**
   * Generates a temporary authorized download URL
   */
  async downloadMedia(urlMeta) {
    const { shortcode, type } = urlMeta;

    // Simulated test triggers
    if (shortcode && shortcode.includes('fail_provider')) {
      throw createError('PROVIDER_ERROR', 'Mock provider simulated a downstream download failure.');
    }
    if (shortcode && shortcode.includes('download_unavailable')) {
      throw createError('DOWNLOAD_UNAVAILABLE', 'This media cannot currently be retrieved.');
    }
    if (shortcode && shortcode.includes('timeout')) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      throw createError('TIMEOUT', 'The media download operation timed out.');
    }

    // Direct temporary media asset sample URL with 1-hour expiration
    const sampleMediaUrls = {
      reel: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      post: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1080&auto=format&fit=crop&q=80',
      story: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
    };

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      success: true,
      platform: 'instagram',
      type: type || 'reel',
      author: '@instagram_creator',
      creator: '@instagram_creator',
      hasAudio: type !== 'post',
      downloadUrl: sampleMediaUrls[type] || sampleMediaUrls.reel,
      expiresAt
    };
  }
}

module.exports = MockProvider;
