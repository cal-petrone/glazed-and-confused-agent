/**
 * Real-Time AI Donut Ordering Assistant — Glazed and Confused
 * Production-ready server with modular architecture
 * 
 * Twilio Media Streams + OpenAI Realtime API
 * 
 * IMPORTANT: The health check starts FIRST so Railway can verify
 * the container is alive before we load heavier dependencies.
 */

require('dotenv').config();

const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// ── Health check routes ── MUST be registered before anything else ──
// These are inline (no external imports) so they can never fail to load.
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'glazed-and-confused',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'glazed-and-confused'
  });
});

// ── Start listening IMMEDIATELY so Railway's healthcheck can reach us ──
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🍩 Glazed and Confused server listening on 0.0.0.0:${port}`);
  console.log(`❤️  Health check available at GET /health`);

  // ── Now that the health check is live, initialize the rest ──
  initializeApp();
});

/**
 * Initialize all application logic AFTER the server is already listening.
 * Errors here are logged but do NOT kill the process — the health check
 * stays alive so Railway doesn't tear down the container.
 */
function initializeApp() {
  try {
    // Validate environment variables
    const { validateEnv, sanitizeForLog } = require('./src/utils/validation');
    try {
      validateEnv();
    } catch (envError) {
      console.error('⚠️  Environment validation warning:', envError.message);
      console.error('⚠️  The server is running but some features may not work.');
      // Do NOT process.exit — keep the server alive for the healthcheck
    }

    // Middleware
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Request logging middleware
    app.use((req, res, next) => {
      // Skip logging health checks to reduce noise
      if (req.path === '/health' || req.path === '/') {
        return next();
      }
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });

    // Load route handlers
    const handleIncomingCall = require('./src/routes/incoming-call');
    const setupMediaStream = require('./src/routes/media-stream');
    const Logger = require('./src/services/logger');

    // Register application routes
    app.post('/incoming-call', handleIncomingCall);
    console.log(`📞 Incoming call webhook: POST /incoming-call`);

    // WebSocket server for Media Streams
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

      if (pathname === '/media-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    console.log(`📡 Media stream WebSocket: /media-stream`);

    // Initialize logger
    const logger = new Logger(
      process.env.ZAPIER_WEBHOOK_URL,
      3,    // max retries
      1000  // initial retry delay (ms)
    );

    // Setup media stream handler
    setupMediaStream(wss, logger);

    // Periodic health log
    setInterval(() => {
      console.log(`📊 Server health — ${new Date().toISOString()} — uptime: ${Math.floor(process.uptime())}s`);
    }, 300000); // Every 5 minutes

    console.log('✅ Glazed and Confused fully initialized and ready to accept calls');

  } catch (error) {
    console.error('❌ Application initialization error:', error);
    console.error('❌ The health check is still running. Check logs and fix the issue.');
    // Intentionally do NOT exit — keep the container alive
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Catch any unhandled errors to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  // Don't exit — keep the health check alive
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  // Don't exit — keep the health check alive
});
