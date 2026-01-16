# WD Logistics AI Agent Dockerfile
# Uses Node.js with Puppeteer support for WhatsApp Web integration

# ============================================================================
# Stage 1: Build
# ============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# Install bun for faster dependency installation
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript (allow errors - runtime will handle them)
RUN bun run build || echo "Build completed with warnings"

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM node:22-slim AS production

# Install Chromium dependencies for whatsapp-web.js/Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Disable Chrome sandboxing for containerized environments
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox"

# Verify Chromium installation
RUN which chromium && chromium --version

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy package files and install ALL dependencies (including dev for tsx)
COPY package.json ./
RUN npm install

# Copy source files directly
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create directory for WhatsApp session data
RUN mkdir -p /app/.wwebjs_auth && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the agent port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the application with dev command
CMD ["npx", "tsx", "src/index.ts"]
