# AI Agent for WD Logistics

An AI-powered agent built with Hono and Mastra.ai for managing logistics operations.

## Features

- 🤖 AI chat interface for natural language queries
- 🚚 Truck management tools
- 📦 Trip scheduling and tracking
- 👷 Driver management
- 💰 Invoice and payment handling
- ⚡ Automated workflows

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your API keys

4. Run the development server:
   ```bash
   bun run dev
   ```

## API Endpoints

- `GET /` - Health check
- `POST /chat` - AI chat interface
- `POST /chat/stream` - Streaming AI chat

## Development

```bash
bun run dev    # Start with hot reload
bun run build  # Build for production
bun start      # Run production build
```

## Docker Deployment

### Option 1: Docker Compose (Recommended)

1. **Create your .env file** (required - not in git):
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Build and run:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f agent
   ```

### Option 2: Docker CLI

1. **Build the image:**
   ```bash
   docker build -t wd-logistics-agent .
   ```

2. **Run with environment variables:**
   ```bash
   docker run -d \
     --name wd-logistics-agent \
     -p 3001:3001 \
     -e OPENAI_API_KEY="your-key" \
     -e WEB_APP_URL="https://your-app.com" \
     -e AGENT_API_KEY="your-shared-key" \
     -v whatsapp_auth:/app/.wwebjs_auth \
     --cap-add=SYS_ADMIN \
     wd-logistics-agent
   ```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for Mastra.ai |
| `WEB_APP_URL` | Yes | URL of the Next.js web app |
| `AGENT_API_KEY` | Yes | Shared API key for agent authentication |
| `ENABLE_WHATSAPP` | No | Set to `true` to enable WhatsApp integration (default: false) |
| `NO_ADMIN_ANSWER` | No | Set to `true` to disable non-admin responses (default: false) |
| `PORT` | No | Server port (default: 3001) |
| `MASTRA_LOG_LEVEL` | No | Log level: debug, info, warn, error |

### WhatsApp Integration

The agent supports WhatsApp integration for receiving and responding to messages.

**⚠️ Important:** WhatsApp is **disabled by default** in production environments.

#### Enabling WhatsApp

1. Set environment variable:
   ```bash
   ENABLE_WHATSAPP=true
   ```

2. **First Run:** Check logs for QR code to scan with WhatsApp mobile app
3. **Authentication:** Scan QR code (Settings → Linked Devices → Link a Device)
4. **Session Persistence:** Session is saved to `.wwebjs_auth` directory

#### Access Levels

1. **Admin Users** (Full Access):
   - `+263789859332`
   - `+263772958986`
   - Can query all data and perform admin operations

2. **Bot Self-Messages**:
   - Messages from bot's own number containing "WD_LOGISTICS"
   - Full admin access

3. **Non-Admin Users** (Business Info Only):
   - Can ask about services, hours, location
   - No access to system data
   - Disabled if `NO_ADMIN_ANSWER=true`

#### Production Considerations

- WhatsApp requires Chrome/Chromium browser (included in Dockerfile)
- May not work on all hosting platforms (Render, Heroku require specific setup)
- Recommended for development or self-hosted production
- For production, consider dedicated WhatsApp Business API instead

### Render Deployment

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Set the **Root Directory** to `agent`
4. Set **Build Command** to: (leave default or use Docker)
5. Add environment variables in the Render dashboard:
   - `OPENAI_API_KEY`
   - `WEB_APP_URL`
   - `AGENT_API_KEY`
   - `ENABLE_WHATSAPP=false` (recommended for Render)
6. Deploy!

> **Note:** Environment variables are set in Render's dashboard, not via .env file.

### Production Notes

- WhatsApp is disabled by default (set `ENABLE_WHATSAPP=true` to enable)
- If WhatsApp enabled, first run requires QR code scan (check logs)
- Health check available at `GET /health`

