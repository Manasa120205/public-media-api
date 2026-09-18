const path = require('path');

const getRootStatus = (req, res) => {
  // Serve the official website if visited in a web browser
  if (req.headers.accept && req.headers.accept.startsWith('text/html') && !req.xhr && !req.query.json) {
    return res.sendFile(path.resolve(__dirname, '../../public/index.html'));
  }

  res.status(200).json({
    success: true,
    name: 'PublicMedia API',
    version: '1.0.0',
    status: 'online'
  });
};

const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};

module.exports = {
  getRootStatus,
  getHealthStatus
};
