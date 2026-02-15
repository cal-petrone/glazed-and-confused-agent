/**
 * Real-Time AI Donut Ordering Assistant — Glazed and Confused
 * Production-ready server with modular architecture
 * 
 * Twilio Media Streams + OpenAI Realtime API
 */

require('dotenv').config();

const express = require('express');
const WebSocket = require('ws');

// ── Try to load all modules up front ──
let handleIncomingCall, setupMediaStream, Logger, validateEnv, sanitizeForLog;
let initError = null;

try {
  ({ validateEnv, sanitizeForLog } = require('./src/utils/validation'));
  handleIncomingCall = require('./src/routes/incoming-call');
  setupMediaStream = require('./src/routes/media-stream');
  Logger = require('./src/services/logger');
} catch (err) {
  initError = err;
  console.error('❌ Failed to load modules:', err.message);
}

// ── Validate environment (warn but don't crash) ──
if (validateEnv) {
  try {
    validateEnv();
  } catch (envError) {
    console.error('⚠️  Environment validation warning:', envError.message);
    console.error('⚠️  Server will start but some features may not work.');
  }
}

const app = express();
const port = process.env.PORT || 3000;

// ── Middleware — registered BEFORE routes ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging (skip health checks to reduce noise)
app.use((req, res, next) => {
  if (req.path !== '/health' && req.path !== '/') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ── Routes ──

// Health check — always available
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'glazed-and-confused',
    initialized: !initError,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'glazed-and-confused' });
});

// Incoming call webhook — the critical route Twilio hits
if (handleIncomingCall) {
  app.post('/incoming-call', handleIncomingCall);
  console.log('✅ POST /incoming-call route registered');
} else {
  // Fallback: return valid TwiML even if the module failed to load
  app.post('/incoming-call', (_req, res) => {
    console.error('❌ /incoming-call hit but module not loaded. Init error:', initError?.message);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>We are sorry, our ordering system is temporarily unavailable. Please try again later.</Say></Response>`;
    res.type('text/xml').send(twiml);
  });
  console.error('⚠️  POST /incoming-call registered with FALLBACK handler (module load failed)');
}

// ── Start HTTP server — bind to 0.0.0.0 for Railway ──
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🍩 Glazed and Confused server listening on 0.0.0.0:${port}`);
  console.log(`❤️  Health check: GET /health`);
  console.log(`📞 Incoming call: POST /incoming-call`);
  console.log(`📡 Media stream: WS /media-stream`);
});

// ── WebSocket server for Twilio Media Streams ──
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

// ── Initialize logger and media stream handler ──
if (setupMediaStream && Logger) {
  const logger = new Logger(
    process.env.ZAPIER_WEBHOOK_URL,
    3,    // max retries
    1000  // initial retry delay (ms)
  );
  setupMediaStream(wss, logger);
  console.log('✅ Media stream handler initialized');
} else {
  console.error('⚠️  Media stream handler NOT initialized (module load failed)');
}

// ── Periodic health log ──
setInterval(() => {
  console.log(`📊 Server health — ${new Date().toISOString()} — uptime: ${Math.floor(process.uptime())}s`);
}, 300000);

console.log('✅ Glazed and Confused server fully started');

// ── Graceful shutdown ──
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

// ── Catch unhandled errors to prevent container crashes ──
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
});
