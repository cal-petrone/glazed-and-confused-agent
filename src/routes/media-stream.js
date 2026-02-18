/**
 * Media Stream Route
 * Handles WebSocket connections from Twilio Media Streams.
 * Each call gets its own OpenAI session and OrderManager.
 * On call end, logs the order to Google Sheets.
 */

const WebSocket = require('ws');
const OrderManager = require('../services/order-manager');
const OpenAIService = require('../services/openai-service');

function setupMediaStream(wss, logger, sheetsLogger) {
  wss.on('connection', (ws, req) => {
    console.log('═══════════════════════════════════════════════════');
    console.log('📡 NEW CALL — Twilio Media Stream connected');
    console.log('═══════════════════════════════════════════════════');

    let streamSid = null;
    let callSid = null;
    let fromNumber = null;
    let orderManager = null;
    let openaiService = null;
    let audioChunksFromTwilio = 0;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.event) {
          case 'start': {
            streamSid = message.start.streamSid;
            callSid = message.start.callSid || message.start.customParameters?.callSid;
            fromNumber = message.start.customParameters?.callerPhone || 'unknown';

            console.log(`📞 Stream started`);
            console.log(`   StreamSid: ${streamSid}`);
            console.log(`   CallSid:   ${callSid}`);
            console.log(`   Caller:    ${fromNumber}`);
            console.log(`   Params:    ${JSON.stringify(message.start.customParameters || {})}`);

            // Initialize order manager for this call
            orderManager = new OrderManager(streamSid, callSid, fromNumber);

            // Initialize OpenAI service
            openaiService = new OpenAIService(
              process.env.OPENAI_API_KEY,
              orderManager,
              // onAudio — send AI's audio back to Twilio
              (audioBase64) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    event: 'media',
                    streamSid: streamSid,
                    media: { payload: audioBase64 }
                  }));
                }
              },
              // onTranscript — user speech transcribed
              (transcript) => {
                console.log(`👤 Transcript: "${transcript}"`);
              }
            );

            // Connect to OpenAI
            openaiService.connect().then(() => {
              console.log('✅ OpenAI connected — waiting for customer to speak');
            }).catch(error => {
              console.error('❌ Failed to connect to OpenAI:', error.message);
            });

            break;
          }

          case 'media': {
            // Forward each audio chunk directly to OpenAI (no buffering)
            if (message.media?.payload && openaiService?.isReady()) {
              openaiService.sendAudio(message.media.payload);
              audioChunksFromTwilio++;

              // Log periodically to confirm audio is flowing
              if (audioChunksFromTwilio === 1) {
                console.log('🎤 First audio chunk received from Twilio');
              } else if (audioChunksFromTwilio === 50) {
                console.log('🎤 50 audio chunks received — audio stream flowing normally');
              } else if (audioChunksFromTwilio % 500 === 0) {
                console.log(`🎤 ${audioChunksFromTwilio} audio chunks received`);
              }
            }
            break;
          }

          case 'stop': {
            console.log(`📞 Stream stopped: ${streamSid}`);
            _handleCallEnd('stop');
            break;
          }

          case 'mark': {
            // Twilio mark events — ignore
            break;
          }

          default:
            console.log(`📡 Unknown Twilio event: ${message.event}`);
            break;
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error.message);
      }
    });

    ws.on('close', () => {
      console.log('📞 Twilio WebSocket closed');
      _handleCallEnd('close');
    });

    ws.on('error', (error) => {
      console.error('❌ Twilio WebSocket error:', error.message);
    });

    /**
     * Handle call ending (from stop event or WebSocket close)
     */
    function _handleCallEnd(reason) {
      console.log(`═══════════════════════════════════════════════════`);
      console.log(`📞 CALL ENDED (${reason}) — ${audioChunksFromTwilio} audio chunks processed`);

      // Close OpenAI
      if (openaiService) {
        openaiService.close();
        openaiService = null;
      }

      // Log the order
      if (orderManager) {
        const order = orderManager.getOrder();
        console.log(`📋 Order state at call end:`);
        console.log(`   Items:    ${order.items.length} items`);
        console.log(`   Name:     ${order.customerName || 'not set'}`);
        console.log(`   Method:   ${order.deliveryMethod || 'not set'}`);
        console.log(`   Confirmed: ${order.confirmed}`);
        console.log(`   Total:    $${order.total.toFixed(2)}`);

        if (order.items.length > 0) {
          order.items.forEach((item, i) => {
            console.log(`   Item ${i + 1}: ${item.quantity}x ${item.size} ${item.name} @ $${item.price}`);
          });
        }

        // Log to Google Sheets (even if not fully confirmed — captures partial orders)
        if (order.items.length > 0 && !order.logged) {
          const orderData = orderManager.getOrderForLogging();

          // Log to Zapier
          if (logger) {
            logger.logOrder(orderData).then(result => {
              if (result.success) {
                console.log('✅ Order logged to Zapier');
              } else {
                console.log('⚠️  Zapier log failed:', result.error);
              }
            }).catch(err => console.error('❌ Zapier error:', err.message));
          }

          // Log to Google Sheets Call Log
          if (sheetsLogger) {
            sheetsLogger(orderData).then(success => {
              if (success) {
                console.log('✅ Order logged to Google Sheets');
                orderManager.markAsLogged();
              } else {
                console.log('⚠️  Google Sheets log failed');
              }
            }).catch(err => console.error('❌ Google Sheets error:', err.message));
          }
        } else if (order.items.length === 0) {
          console.log('ℹ️  No items in order — skipping log');
        } else if (order.logged) {
          console.log('ℹ️  Order already logged — skipping');
        }

        orderManager = null;
      }

      console.log(`═══════════════════════════════════════════════════`);
    }
  });
}

module.exports = setupMediaStream;
