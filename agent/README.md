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
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your API keys

4. Run the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `GET /` - Health check
- `POST /chat` - AI chat interface
- `POST /chat/stream` - Streaming AI chat

## Development

```bash
npm run dev    # Start with hot reload
npm run build  # Build for production
npm start      # Run production build
```
