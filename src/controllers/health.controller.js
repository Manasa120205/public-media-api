/**
 * Health and root status controller
 */

const getRootStatus = (req, res) => {
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
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getRootStatus,
  getHealthStatus
};
