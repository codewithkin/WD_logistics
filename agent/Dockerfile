# WD Logistics AI Agent — Dockerfile
#
# Build from the REPO ROOT, not from agent/: `docker build -f agent/Dockerfile .`
# (Coolify's Dockerfile build pack does exactly this by default — see the
# same note in app/Dockerfile). If you need `agent/` itself as the context
# instead, change every `COPY agent/...` below back to `COPY ...`.
#
# Runs via `tsx` (transpile-only, no type-check) instead of a compiled dist/
# build. `bun run build` (tsc) isn't guaranteed clean on this codebase, so
# building to dist/ and running the compiled JS risks either failing the
# image build outright or silently shipping stale/partial output. `tsx` at
# runtime is exactly what `bun run dev` already does locally, minus --watch.
# Revisit once `tsc` passes cleanly and there's a real reason to prebuild.
#
# Needs a real Chromium because whatsapp-web.js drives it via Puppeteer.
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true is set BEFORE `bun install` so
# Puppeteer's postinstall doesn't also pull its own ~170MB copy — the apt
# Chromium below is the only one that ends up in the image, and
# PUPPETEER_EXECUTABLE_PATH points whatsapp-web.js at it (see
# src/lib/whatsapp.ts, which reads this var on Linux).
#
# WhatsApp only actually starts if ENABLE_WHATSAPP=true is set at runtime
# (see src/index.ts) — leave it unset/false to run this as a plain chat/API
# service with no Chromium launch at boot.

# ============================================================================
# Stage 1: install dependencies
# ============================================================================
FROM node:22-slim AS deps

WORKDIR /app

RUN npm install -g bun

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY agent/package.json agent/bun.lock ./
RUN bun install --frozen-lockfile

# ============================================================================
# Stage 2: runtime
# ============================================================================
FROM node:22-slim AS runtime

# Chromium + the shared libs whatsapp-web.js/Puppeteer needs to launch it
# headless in a container (no X server, no sandbox namespaces by default).
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# node_modules comes from the deps stage (built with the Chromium download
# already skipped) rather than reinstalling here.
COPY --from=deps /app/node_modules ./node_modules
COPY agent/package.json agent/bun.lock agent/tsconfig.json ./
COPY agent/src ./src

# WhatsApp session (LocalAuth) lives here — mount a volume over it so a
# redeploy doesn't force re-scanning the pairing QR code.
RUN mkdir -p /app/.wwebjs_auth && chown -R appuser:appuser /app

USER appuser

EXPOSE 3001

# `GET /` is the only route guaranteed to respond regardless of config (see
# src/index.ts) — there's no dedicated /health endpoint, despite the
# sub-router health checks (/chat/health etc.) advertised in its JSON body.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npx", "tsx", "src/index.ts"]
