/**
 * OpenAI Realtime API Service
 * Handles WebSocket connection to OpenAI Realtime API
 * for Glazed and Confused donut shop
 */

const WebSocket = require('ws');
const { getMenuText } = require('../config/menu');

class OpenAIService {
  constructor(apiKey, orderManager, onAudioCallback, onTranscriptCallback) {
    this.apiKey = apiKey;
    this.orderManager = orderManager;
    this.onAudioCallback = onAudioCallback;
    this.onTranscriptCallback = onTranscriptCallback;
    this.client = null;
    this.ready = false;
    this.sessionId = null;
    this.audioChunksSent = 0;
    this.audioChunksReceived = 0;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

        this.client = new WebSocket(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        this.client.on('open', () => {
          console.log('✅ OpenAI WebSocket connected');
          this._setupSession();
          resolve();
        });

        this.client.on('message', (data) => {
          this._handleMessage(data);
        });

        this.client.on('error', (error) => {
          console.error('❌ OpenAI WebSocket error:', error.message);
          this.ready = false;
          reject(error);
        });

        this.client.on('close', (code, reason) => {
          console.log(`🔌 OpenAI connection closed: ${code} ${reason?.toString() || ''}`);
          console.log(`📊 Audio stats — sent: ${this.audioChunksSent} chunks, received: ${this.audioChunksReceived} chunks`);
          this.ready = false;
          if (this.client) this.client.removeAllListeners();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup OpenAI session with configuration
   */
  _setupSession() {
    const menuText = getMenuText();
    const orderSummary = this.orderManager.getSummary();

    console.log('📋 Menu text length for AI prompt:', menuText.length, 'chars');

    const instructions = `You are a warm, friendly ordering assistant for Glazed and Confused, a beloved neighborhood donut shop. You help customers place orders over the phone.

AVAILABLE MENU ITEMS:
${menuText}

CURRENT ORDER STATE:
Items: ${orderSummary}
Delivery Method: ${this.orderManager.getOrder().deliveryMethod || 'not specified'}
Address: ${this.orderManager.getOrder().address || 'not specified'}
Customer Name: ${this.orderManager.getOrder().customerName || 'not provided'}
Payment Method: ${this.orderManager.getOrder().paymentMethod || 'not specified'}

CONVERSATION RULES:
1. Start by greeting: "Thanks for calling Glazed and Confused! What can I get for you today?"
2. When customer mentions items, use the add_item_to_order tool immediately
3. Ask follow-up questions naturally (size/quantity — single, half-dozen, or dozen for donuts; small/medium/large for drinks)
4. Periodically summarize the order: "So far you have [items]. What else can I get you?"
5. When customer says they're done ("that's it", "I'm all set", etc.), ask about pickup or delivery
6. If delivery, ask for address and repeat it back for confirmation
7. Before finalizing, read back the complete order with totals
8. Ask for customer name at the end (REQUIRED)
9. Only confirm order after customer explicitly confirms ("yes", "that's correct", etc.)
10. Be conversational, upbeat, and friendly — like a real donut shop employee
11. Use tools immediately when customer mentions items — don't wait
12. Vary your responses — don't repeat the same question
13. For donuts, default to "single" if quantity/size not specified. Suggest the dozen deal if they order multiple of the same donut.
14. If a customer says "a dozen donuts" without specifying type, ask which kind they'd like.

IMPORTANT: Finish complete sentences. Don't cut off mid-sentence.`;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: instructions,
        voice: 'alloy',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700
        },
        tools: this._getTools(),
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    };

    this.client.send(JSON.stringify(sessionUpdate));
    console.log('✅ OpenAI session configured (g711_ulaw, whisper-1 transcription, server_vad)');

    // Trigger the initial greeting
    this.client.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Greet the customer warmly. Say: "Thanks for calling Glazed and Confused! What can I get for you today?"'
      }
    }));
    console.log('✅ Initial greeting triggered');
  }

  /**
   * Define available tools for the AI
   */
  _getTools() {
    return [
      {
        type: 'function',
        name: 'add_item_to_order',
        description: 'Add an item to the customer\'s order',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The menu item name' },
            size: {
              type: 'string',
              description: 'Size: single, half-dozen, dozen for donuts; small, medium, large for drinks; regular for bakery',
              enum: ['single', 'half-dozen', 'dozen', 'small', 'medium', 'large', 'regular', 'double']
            },
            quantity: { type: 'number', description: 'How many of that size', minimum: 1, default: 1 }
          },
          required: ['name']
        }
      },
      {
        type: 'function',
        name: 'set_delivery_method',
        description: 'Set whether order is for pickup or delivery',
        parameters: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['pickup', 'delivery'], description: 'Pickup or delivery' }
          },
          required: ['method']
        }
      },
      {
        type: 'function',
        name: 'set_address',
        description: 'Set delivery address',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Full delivery address' }
          },
          required: ['address']
        }
      },
      {
        type: 'function',
        name: 'set_customer_name',
        description: 'Set customer name',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Customer name' }
          },
          required: ['name']
        }
      },
      {
        type: 'function',
        name: 'set_customer_phone',
        description: 'Set customer phone number',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Customer phone number' }
          },
          required: ['phone']
        }
      },
      {
        type: 'function',
        name: 'set_payment_method',
        description: 'Set payment method',
        parameters: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['cash', 'card'], description: 'Payment method' }
          },
          required: ['method']
        }
      },
      {
        type: 'function',
        name: 'confirm_order',
        description: 'Confirm the order is complete and ready to be submitted',
        parameters: { type: 'object', properties: {} }
      }
    ];
  }

  /**
   * Handle messages from OpenAI
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'session.created':
          this.sessionId = message.session.id;
          this.ready = true;
          console.log('✅ OpenAI session created:', this.sessionId);
          break;

        case 'session.updated':
          this.ready = true;
          console.log('✅ OpenAI session updated');
          break;

        // ── Audio from AI → forward to Twilio ──
        case 'response.audio.delta':
          if (message.delta && this.onAudioCallback) {
            this.audioChunksReceived++;
            this.onAudioCallback(message.delta);
          }
          break;

        case 'response.audio.done':
          console.log('🔊 AI audio response complete');
          break;

        // ── AI speech transcript (what the AI said) ──
        case 'response.audio_transcript.delta':
          break; // partial transcript, ignore

        case 'response.audio_transcript.done':
          if (message.transcript) {
            console.log(`🤖 AI said: "${message.transcript}"`);
          }
          break;

        // ── User speech transcript (what the user said) ──
        case 'conversation.item.input_audio_transcription.completed':
          if (message.transcript) {
            console.log(`👤 USER SAID: "${message.transcript}"`);
            if (this.onTranscriptCallback) {
              this.onTranscriptCallback(message.transcript);
            }
          } else {
            console.log('👤 USER SAID: (empty transcription)');
          }
          break;

        case 'conversation.item.input_audio_transcription.failed':
          console.error('❌ Transcription FAILED:', JSON.stringify(message.error || message));
          break;

        // ── Tool calls ──
        case 'response.function_call_arguments.done':
          this._handleToolCall(message);
          break;

        // ── Response lifecycle ──
        case 'response.created':
          break;
        case 'response.done':
          if (message.response?.status === 'failed') {
            console.error('❌ Response failed:', JSON.stringify(message.response?.status_details));
          }
          break;

        case 'input_audio_buffer.speech_started':
          console.log('🎤 User started speaking');
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('🎤 User stopped speaking');
          break;

        case 'input_audio_buffer.committed':
          console.log('🎤 Audio buffer committed for processing');
          break;

        case 'error':
          console.error('❌ OpenAI error:', JSON.stringify(message.error));
          break;

        default:
          break;
      }
    } catch (error) {
      // Binary data or unparseable message — expected for raw audio frames
    }
  }

  /**
   * Handle tool calls from OpenAI.
   * CRITICAL: Must respond with conversation.item.create + response.create
   * (NOT response.function_call_arguments.done which is a server→client event)
   */
  _handleToolCall(message) {
    let result = '';
    try {
      const callId = message.call_id;
      const functionName = message.name;
      const args = JSON.parse(message.arguments || '{}');

      console.log(`🔧 TOOL CALL: ${functionName}(${JSON.stringify(args)})`);

      switch (functionName) {
        case 'add_item_to_order': {
          const order = this.orderManager.addItem(args.name, args.size || 'single', args.quantity || 1);
          result = JSON.stringify({
            success: true,
            message: `Added ${args.quantity || 1}x ${args.size || 'single'} ${args.name} to the order`,
            currentOrder: this.orderManager.getSummary(),
            total: `$${order.total.toFixed(2)}`
          });
          console.log(`   ✅ Added: ${args.quantity || 1}x ${args.size || 'single'} ${args.name} → total: $${order.total.toFixed(2)}`);
          break;
        }
        case 'set_delivery_method':
          this.orderManager.setDeliveryMethod(args.method);
          result = JSON.stringify({ success: true, method: args.method });
          console.log(`   ✅ Delivery: ${args.method}`);
          break;

        case 'set_address':
          this.orderManager.setAddress(args.address);
          result = JSON.stringify({ success: true, address: args.address });
          console.log(`   ✅ Address: ${args.address}`);
          break;

        case 'set_customer_name':
          this.orderManager.setCustomerName(args.name);
          result = JSON.stringify({ success: true, name: args.name });
          console.log(`   ✅ Name: ${args.name}`);
          break;

        case 'set_customer_phone':
          this.orderManager.setCustomerPhone(args.phone);
          result = JSON.stringify({ success: true, phone: args.phone });
          console.log(`   ✅ Phone: ${args.phone}`);
          break;

        case 'set_payment_method':
          this.orderManager.setPaymentMethod(args.method);
          result = JSON.stringify({ success: true, method: args.method });
          console.log(`   ✅ Payment: ${args.method}`);
          break;

        case 'confirm_order':
          this.orderManager.confirm();
          result = JSON.stringify({
            success: true,
            message: 'Order confirmed!',
            summary: this.orderManager.getFullSummary()
          });
          console.log('   ✅ ORDER CONFIRMED');
          console.log('   📋', this.orderManager.getFullSummary().replace(/\n/g, '\n   '));
          break;

        default:
          result = JSON.stringify({ error: `Unknown function: ${functionName}` });
      }

      // Send the tool result back to OpenAI (correct format)
      this.client.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: result
        }
      }));

      // Trigger the AI to continue responding after receiving the tool result
      this.client.send(JSON.stringify({ type: 'response.create' }));

    } catch (error) {
      console.error('❌ Tool call error:', error.message);
      // Even on error, send a result so the AI doesn't get stuck
      if (message.call_id) {
        this.client.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: message.call_id,
            output: JSON.stringify({ error: error.message })
          }
        }));
        this.client.send(JSON.stringify({ type: 'response.create' }));
      }
    }
  }

  /**
   * Send audio input to OpenAI
   */
  sendAudio(audioBase64) {
    if (!this.ready || !this.client || this.client.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.client.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBase64
      }));
      this.audioChunksSent++;
      return true;
    } catch (error) {
      console.error('❌ Error sending audio to OpenAI:', error.message);
      return false;
    }
  }

  /**
   * Close connection
   */
  close() {
    if (this.client) {
      this.client.removeAllListeners();
      if (this.client.readyState === WebSocket.OPEN || this.client.readyState === WebSocket.CONNECTING) {
        this.client.close();
      }
      this.client = null;
    }
    this.ready = false;
  }

  /**
   * Check if connection is ready
   */
  isReady() {
    return this.ready && this.client && this.client.readyState === WebSocket.OPEN;
  }
}

module.exports = OpenAIService;
