/**
 * Incoming Call Route
 * Handles Twilio webhook for incoming calls
 * Returns TwiML to start Media Stream
 * for Glazed and Confused donut shop
 */

const twilio = require('twilio');

function handleIncomingCall(req, res) {
  try {
    const calledNumber = req.body.Called || req.body.To;
    const callSid = req.body.CallSid;
    const fromNumber = req.body.From;
    
    console.log(`📞 Incoming call: ${fromNumber} -> ${calledNumber} (CallSid: ${callSid})`);
    
    // Build the WebSocket URL for Twilio Media Streams
    // Twilio requires wss:// (not https://) for the Stream URL
    const host = req.get('host') || process.env.SERVER_URL?.replace(/^https?:\/\//, '') || 'localhost:3000';
    const wsUrl = `wss://${host}/media-stream`;
    
    // Create TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Connect to Media Stream
    const connect = twiml.connect();
    const stream = connect.stream({
      url: wsUrl,
      name: callSid // Use CallSid as stream identifier
    });
    
    console.log(`✓ TwiML generated, connecting to: ${wsUrl}`);
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.status(500).send('Error processing call');
  }
}

module.exports = handleIncomingCall;
