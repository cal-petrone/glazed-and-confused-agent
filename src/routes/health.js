/**
 * Health Check Route
 * Simple health endpoint for monitoring
 * Glazed and Confused donut shop
 */

function healthCheck(req, res) {
  res.json({
    status: 'ok',
    service: 'glazed-and-confused',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
}

module.exports = healthCheck;
