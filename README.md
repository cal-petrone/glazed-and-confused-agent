# Glazed and Confused — Real-Time AI Donut Ordering Assistant

Production-ready AI phone receptionist for **Glazed and Confused** donut shop using Twilio Media Streams and OpenAI Realtime API.

## Features

- **Real-time conversation** — Low-latency audio streaming (no "record -> HTTP -> speak" delays)
- **Natural interruptions** — Customers can interrupt the AI mid-sentence
- **Donut-optimized ordering** — Handles single, half-dozen, and dozen quantities naturally
- **Full drink menu** — Coffee, lattes, specialty drinks with size options
- **Robust error handling** — Graceful recovery from network issues, API failures
- **Idempotent logging** — Prevents duplicate orders with retry logic
- **Production-ready** — Structured logging, health checks, environment validation
- **Modular architecture** — Clean, testable, maintainable code

## Architecture

```
┌─────────────┐
│   Twilio    │
│   Phone     │
└──────┬──────┘
       │
       │ HTTP POST (TwiML)
       ▼
┌─────────────────┐
│  Express Server │
│  /incoming-call │
└──────┬──────────┘
       │
       │ WebSocket (Media Stream)
       ▼
┌─────────────────┐      ┌──────────────┐
│  Media Stream   │◄────►│   OpenAI     │
│     Handler     │      │  Realtime    │
└──────┬──────────┘      └──────────────┘
       │
       │ Order Data
       ▼
┌─────────────────┐
│  Order Manager  │
└──────┬──────────┘
       │
       │ Finalized Order
       ▼
┌─────────────────┐
│  Logger Service │
│  (Zapier)       │
└─────────────────┘
```

## Project Structure

```
.
├── src/
│   ├── config/
│   │   └── menu.js              # Donut shop menu configuration
│   ├── routes/
│   │   ├── incoming-call.js     # Twilio webhook handler
│   │   ├── media-stream.js      # WebSocket handler
│   │   └── health.js            # Health check endpoint
│   ├── services/
│   │   ├── order-manager.js     # Order state management
│   │   ├── openai-service.js    # OpenAI Realtime API client
│   │   └── logger.js            # Zapier logging with retries
│   └── utils/
│       └── validation.js        # Environment validation
├── tests/
│   ├── order-manager.test.js    # Order logic tests
│   └── menu.test.js             # Menu tests
├── integrations/
│   ├── google-sheets.js         # Google Sheets order logging
│   └── pos-systems.js           # Square / Toast / Clover POS
├── services/
│   └── personaplex-gateway/     # PersonaPlex gateway (Railway)
│       ├── index.js
│       ├── package.json
│       └── railway.json
├── glazed-and-confused-function.js  # Twilio Function (Studio)
├── server.js                        # Main server
├── package.json
└── README.md
```

## Menu

### Donuts (single / half-dozen / dozen)
| Item | Single | Half-Dozen | Dozen |
|------|--------|------------|-------|
| Glazed Donut | $2.49 | $12.99 | $22.99 |
| Chocolate Frosted | $2.99 | $15.99 | $27.99 |
| Boston Cream | $3.49 | $18.99 | $33.99 |
| Maple Bar | $3.29 | $17.99 | $31.99 |
| Jelly Filled | $3.29 | $17.99 | $31.99 |
| Sprinkle Donut | $2.79 | $14.99 | $25.99 |
| Old Fashioned | $2.79 | $14.99 | $25.99 |
| Apple Fritter | $3.99 | $21.99 | $39.99 |
| Cruller | $2.99 | $15.99 | $27.99 |
| Cinnamon Sugar | $2.79 | $14.99 | $25.99 |
| Blueberry Cake | $3.29 | $17.99 | $31.99 |

### Donut Holes
| Size | Price |
|------|-------|
| Small (25pc) | $4.99 |
| Large (50pc) | $8.99 |

### Coffee & Drinks
| Item | Small | Medium | Large |
|------|-------|--------|-------|
| Coffee | $2.49 | $3.29 | $3.99 |
| Iced Coffee | $3.29 | $3.99 | $4.79 |
| Latte | $4.29 | $4.99 | $5.79 |
| Cappuccino | $4.29 | $4.99 | $5.79 |
| Hot Chocolate | $3.49 | $4.29 | $4.99 |
| Chai Latte | $4.49 | $5.29 | $5.99 |
| Matcha Latte | $4.99 | $5.79 | $6.49 |

### Bakery
| Item | Price |
|------|-------|
| Muffin | $3.49 |
| Croissant | $3.99 |
| Bagel | $2.99 |
| Bagel w/ Cream Cheese | $4.49 |

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:

```env
# Required
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
OPENAI_API_KEY=your_openai_api_key
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your/webhook/url
PORT=3000

# Optional
GOOGLE_SHEETS_CREDENTIALS_PATH=./google-credentials.json
GOOGLE_SHEETS_ID=your_google_sheets_id
NGROK_URL=https://your-ngrok-url.ngrok.io

# POS (optional)
POS_SYSTEM=square
SQUARE_ACCESS_TOKEN=your-access-token
SQUARE_LOCATION_ID=your-location-id
```

### 3. Start Server

```bash
npm start
```

### 4. Expose with ngrok

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 5. Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to Phone Numbers -> Manage -> Active Numbers
3. Click on your phone number
4. Under "Voice & Fax", set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-ngrok-url.ngrok.io/incoming-call`
   - **HTTP**: POST

### 6. Test

Call your Twilio number and place a test order!

## Order Flow

1. **Call starts** -> Twilio connects WebSocket -> Server connects to OpenAI
2. **AI greets** -> "Thanks for calling Glazed and Confused! What can I get for you today?"
3. **Customer orders** -> AI uses tools to add items (donuts, coffee, etc.)
4. **Follow-up questions** -> Quantity (single/half-dozen/dozen), drink size, etc.
5. **Order summary** -> AI reads back complete order with totals
6. **Customer confirmation** -> "Yes, that's correct"
7. **Order logged** -> Sent to Zapier webhook with retry logic
8. **Call ends** -> Cleanup and resource release

## API Endpoints

### `POST /incoming-call`
Twilio webhook that returns TwiML to start Media Stream.

### `GET /health`
Health check endpoint for monitoring.

```json
{
  "status": "ok",
  "service": "glazed-and-confused",
  "timestamp": "2026-02-06T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### `WebSocket /media-stream`
WebSocket endpoint for Twilio Media Streams.

## Testing

```bash
npm test
```

## Error Handling

- **Network failures**: Automatic retry with exponential backoff
- **API errors**: Graceful degradation, fallback responses
- **Duplicate orders**: Idempotency checks prevent duplicate logging
- **Connection drops**: Automatic cleanup, order logged on close if ready

## Production Checklist

- [ ] Environment variables validated at startup
- [ ] Health check endpoint configured for monitoring
- [ ] Error logging to external service (optional)
- [ ] Rate limiting on webhook endpoints (optional)
- [ ] SSL/TLS certificate (use ngrok or deploy to HTTPS server)
- [ ] Process manager (PM2, systemd, etc.)
- [ ] Log rotation configured
- [ ] Monitoring/alerting setup

## Deployment (Railway)

1. Push to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your repo
4. Add environment variables
5. Deploy!

For the PersonaPlex gateway, see `services/personaplex-gateway/README.md`.

## License

ISC
