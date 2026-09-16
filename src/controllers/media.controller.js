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
      if (!/^stealreel_[a-zA-Z0-9_-]+\.(mp4|jpg|jpeg|png)$/i.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const filePath = path.resolve(config.tempStorageDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Requested media stream not found or expired' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

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
          'Content-Type': filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
        });
        fs.createReadStream(filePath).pipe(res);
      }
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

      // If opened in a web browser, render a clean visual dashboard
      if (req.accepts('html') && !req.xhr && !req.query.json) {
        const percent = Math.min(100, Math.round((quota.used / quota.limit) * 100));
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
  <title>StealReel - Live API Quota</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090B; color: #F4F4F5; margin: 0; padding: 30px 16px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #18181B; border: 1px solid #27272A; border-radius: 20px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .title { font-size: 17px; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px; }
    .badge { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-box { background: #121215; border: 1px solid #27272A; border-radius: 16px; padding: 24px 20px; text-align: center; margin-bottom: 20px; }
    .big-num { font-size: 52px; font-weight: 800; color: #6366F1; margin: 0; line-height: 1; letter-spacing: -1px; }
    .subtext { font-size: 13px; color: #A1A1AA; margin-top: 8px; font-weight: 500; }
    .progress-bar-bg { background: #27272A; border-radius: 999px; height: 8px; overflow: hidden; margin: 18px 0 10px; }
    .progress-bar-fill { background: linear-gradient(90deg, #6366F1, #A855F7); height: 100%; width: ${Math.max(1, percent)}%; border-radius: 999px; }
    .bar-labels { display: flex; justify-content: space-between; font-size: 11px; color: #71717A; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .grid-item { background: #121215; border: 1px solid #27272A; border-radius: 12px; padding: 14px; }
    .grid-label { font-size: 11px; color: #71717A; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .grid-val { font-size: 18px; font-weight: 700; color: #fff; margin-top: 4px; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #71717A; }
    .footer a { color: #818CF8; text-decoration: none; font-weight: 600; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">⚡ StealReel API</h1>
      <span class="badge">● Online</span>
    </div>
    <div class="stat-box">
      <div class="big-num">${quota.remaining.toLocaleString()}</div>
      <div class="subtext">Downloads Remaining This Month</div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="bar-labels">
        <span>Used: ${quota.used}</span>
        <span>Limit: ${quota.limit.toLocaleString()}</span>
      </div>
    </div>
    <div class="grid">
      <div class="grid-item">
        <div class="grid-label">Monthly Limit</div>
        <div class="grid-val">${quota.limit.toLocaleString()}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Used Downloads</div>
        <div class="grid-val">${quota.used}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">Next Reset Date</div>
        <div class="grid-val">${resetDate}</div>
      </div>
      <div class="grid-item">
        <div class="grid-label">API Health</div>
        <div class="grid-val" style="color:#34D399;">100% Operational</div>
      </div>
    </div>
    <div class="footer">
      Live backend for <a href="https://stealreel.com" target="_blank">stealreel.com</a>
    </div>
  </div>
</body>
</html>`;
        return res.status(200).send(html);
      }

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
