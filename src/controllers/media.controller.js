const fs = require('fs');
const path = require('path');
const config = require('../config/env');
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

      // If downloadUrl is relative (from local DASH stream muxing), turn it into a full URL
      if (result.downloadUrl && result.downloadUrl.startsWith('/')) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.get('host');
        result.downloadUrl = `${protocol}://${host}${result.downloadUrl}`;
      }

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/media/stream/:filename
   * Streams locally muxed temporary video file with HTTP Range support and download headers
   */
  stream(req, res, next) {
    try {
      const filename = path.basename(req.params.filename);
      // Validate filename to avoid directory traversal
      if (!/^(instagram|stealreel)_[a-zA-Z0-9_.-]+\.(mp4|mp3|m4a|jpg|jpeg|png)$/i.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const filePath = path.resolve(config.tempStorageDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Requested media stream not found or expired' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const isAudio = filename.endsWith('.mp3') || filename.endsWith('.m4a');
      const isVideo = filename.endsWith('.mp4');
      const contentType = isVideo ? 'video/mp4' : isAudio ? 'audio/mpeg' : 'image/jpeg';

      const isInline = req.query.mode === 'inline' || req.headers.range || req.headers['sec-fetch-dest'] === 'video';
      res.setHeader(
        'Content-Disposition',
        isInline ? 'inline' : `attachment; filename="${filename}"`
      );
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/quota or GET /api/media/quota
   * Returns current monthly development quota status
   */
  getQuota(req, res, next) {
    try {
      const quota = quotaService.getQuotaStatus();

      // If opened in a web browser directly navigating to this page (starts with text/html) or ?html=1
      const isBrowserNavigation = req.query.html === '1' || (req.headers.accept && req.headers.accept.startsWith('text/html'));
      if (isBrowserNavigation && !req.xhr && !req.query.json && !req.headers['authorization'] && !req.headers['x-api-key']) {
        const resetDate = new Date(quota.resetAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PublicMedia API - Quota Status</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8FAFC; color: #0F172A; margin: 0; padding: 30px 16px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 8px; }
    .badge { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 24px 20px; text-align: center; margin-bottom: 20px; }
    .big-num { font-size: 48px; font-weight: 800; color: #4F46E5; margin: 0; line-height: 1; letter-spacing: -1px; }
    .subtext { font-size: 13px; color: #64748B; margin-top: 8px; font-weight: 500; }
    .progress-bar-bg { background: #E2E8F0; border-radius: 999px; height: 8px; overflow: hidden; margin: 18px 0 10px; }
    .progress-bar-fill { background: linear-gradient(90deg, #4F46E5, #6366F1); height: 100%; width: ${Math.max(1, quota.percentageUsed)}%; border-radius: 999px; }
    .bar-labels { display: flex; justify-content: space-between; font-size: 12px; color: #64748B; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-item { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
    .grid-label { font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .grid-val { font-size: 16px; font-weight: 700; color: #0F172A; margin-top: 4px; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #64748B; }
    .footer a { color: #4F46E5; text-decoration: none; font-weight: 600; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">PublicMedia API</h1>
      <span class="badge">Operational</span>
    </div>
    <div class="stat-box">
      <div class="big-num">${quota.remaining.toLocaleString()}</div>
      <div class="subtext">Downloads Remaining This Month</div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="bar-labels">
        <span>Used: ${quota.used} (${quota.percentageUsed}%)</span>
        <span>Limit: ${quota.limit.toLocaleString()}</span>
      </div>
    </div>
    <div class="grid">
      <div class="grid-item">
        <div class="grid-label">Monthly Limit</div>
        <div class="grid-val">${quota.limit.toLocaleString()}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Current Month</div>
        <div class="grid-val">${quota.month}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Next Reset Date</div>
        <div class="grid-val">${resetDate}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">API Health</div>
        <div class="grid-val" style="color:#166534;">Healthy</div>
      </div>
    </div>
    <div class="footer">
      <a href="/demo">Go to Testing Portal &rarr;</a>
    </div>
  </div>
</body>
</html>`;
        return res.status(200).send(html);
      }

      return res.status(200).json({
        success: true,
        requestId: req.id,
        quota: {
          limit: quota.limit,
          used: quota.used,
          remaining: quota.remaining,
          percentageUsed: quota.percentageUsed,
          month: quota.month,
          resetAt: quota.resetAt
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MediaController();
