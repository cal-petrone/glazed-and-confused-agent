/**
 * Real-Time AI Donut Ordering Assistant — Glazed and Confused
 * Production-ready server with modular architecture
 *
 * Twilio Media Streams + OpenAI Realtime API + Google Sheets
 */

require('dotenv').config();

const express = require('express');
const WebSocket = require('ws');

// ── Load modules ──
let handleIncomingCall, setupMediaStream, Logger, validateEnv;
let googleSheets, menuConfig;
let initError = null;

try {
  ({ validateEnv } = require('./src/utils/validation'));
  handleIncomingCall = require('./src/routes/incoming-call');
  setupMediaStream = require('./src/routes/media-stream');
  Logger = require('./src/services/logger');
  googleSheets = require('./integrations/google-sheets');
  menuConfig = require('./src/config/menu');
} catch (err) {
  initError = err;
  console.error('❌ Failed to load modules:', err.message, err.stack);
}

// ── Validate environment ──
if (validateEnv) {
  try {
    validateEnv();
  } catch (envError) {
    console.error('⚠️  Environment validation warning:', envError.message);
  }
}

const app = express();
const port = process.env.PORT || 3000;

// ── Middleware ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
  if (req.path !== '/health' && req.path !== '/') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ── Health check ──
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'glazed-and-confused',
    initialized: !initError,
    sheetsReady: googleSheets?.isSheetsReady() || false,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'glazed-and-confused' });
});

// ── Incoming call webhook ──
if (handleIncomingCall) {
  app.post('/incoming-call', handleIncomingCall);
  console.log('✅ POST /incoming-call registered');
} else {
  app.post('/incoming-call', (_req, res) => {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>We are sorry, our ordering system is temporarily unavailable. Please try again later.</Say></Response>`;
    res.type('text/xml').send(twiml);
  });
  console.error('⚠️  /incoming-call using FALLBACK handler');
}

// ── Start HTTP server ──
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🍩 Glazed and Confused server listening on 0.0.0.0:${port}`);

  // Initialize Google Sheets and menu AFTER the server is listening
  initializeServices();
});

// ── WebSocket for Twilio Media Streams ──
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

// ── Initialize services ──
async function initializeServices() {
  // 1. Initialize Google Sheets
  let sheetsLogFn = null;
  if (googleSheets) {
    try {
      const sheetsOk = await googleSheets.initializeGoogleSheets();
      if (sheetsOk) {
        // 2. Load menu from the Menu sheet
        const menuData = await googleSheets.fetchMenuFromSheet();
        if (menuData && menuConfig) {
          menuConfig.setDynamicMenu(menuData);
          console.log('✅ Dynamic menu loaded from Google Sheets');
        } else {
          console.log('⚠️  Using hardcoded fallback menu');
        }

        // Prepare the Sheets logging function for media-stream
        sheetsLogFn = googleSheets.logOrderToCallLog;
      } else {
        console.log('⚠️  Google Sheets not initialized — using fallback menu, no order logging');
      }
    } catch (error) {
      console.error('❌ Error initializing Google Sheets:', error.message);
    }
  }

  // 3. Initialize logger and media stream
  if (setupMediaStream && Logger) {
    const logger = new Logger(process.env.ZAPIER_WEBHOOK_URL, 3, 1000);
    setupMediaStream(wss, logger, sheetsLogFn);
    console.log('✅ Media stream handler initialized');
  } else {
    console.error('⚠️  Media stream NOT initialized');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('🍩 Glazed and Confused is READY');
  console.log('   Health:   GET  /health');
  console.log('   Webhook:  POST /incoming-call');
  console.log('   Stream:   WS   /media-stream');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

// ── Periodic health log ──
setInterval(() => {
  console.log(`📊 Heartbeat — ${new Date().toISOString()} — uptime: ${Math.floor(process.uptime())}s`);
}, 300000);

// ── Graceful shutdown ──
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
});
