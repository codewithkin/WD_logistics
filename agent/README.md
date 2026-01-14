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

   Or use an env file:
   ```bash
   docker run -d \
     --name wd-logistics-agent \
     -p 3001:3001 \
     --env-file .env \
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
| `PORT` | No | Server port (default: 3001) |
| `MASTRA_LOG_LEVEL` | No | Log level: debug, info, warn, error |

### Production Notes

- The WhatsApp session is persisted in a Docker volume (`whatsapp_auth`)
- First run requires QR code scan for WhatsApp authentication
- `--cap-add=SYS_ADMIN` is required for Puppeteer/Chromium
- Health check available at `GET /health`

