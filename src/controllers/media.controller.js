const mediaService = require('../services/media.service');
const quotaService = require('../services/quota.service');

/**
 * Controller for Instagram media analysis and downloading
 */
class MediaController {
  /**
   * POST /api/media/analyze
   * Validates Instagram URL and returns public metadata
   */
  async analyze(req, res, next) {
    try {
      const { url } = req.body;
      const result = await mediaService.analyze(url, req.id);

      // Attach media type to request context for logging
      req.detectedMediaType = result.type;

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/media/download
   * Verifies quota, validates URL, and returns temporary authorized download link
   */
  async download(req, res, next) {
    try {
      const { url, quality } = req.body;
      const result = await mediaService.download(url, req.id, quality);

      req.detectedMediaType = result.type;

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/media/quota
   * Returns current monthly development quota status
   */
  getQuota(req, res, next) {
    try {
      const quota = quotaService.getQuotaStatus();
      return res.status(200).json({
        success: true,
        requestId: req.id,
        quota
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MediaController();
