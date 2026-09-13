# WD Logistics Web App — Dockerfile
#
# Build from the REPO ROOT, not from app/: `docker build -f app/Dockerfile .`
# (Coolify's Dockerfile build pack does exactly this by default — it found
# this file fine but every COPY failed with "not found" until the paths
# below were made root-relative). If you need to build with `app/` itself as
# the context instead, change every `COPY app/...` below back to `COPY ...`.
#
# Two stages: `builder` installs deps and runs `next build`; `runtime` gets
# the ENTIRE unpruned /app tree copied in (full node_modules, .next, public,
# prisma/, the generated Prisma client under src/generated). This does NOT
# use Next's `output: "standalone"` tracing — the app also loads
# whatsapp-web.js/Puppeteer (src/lib/whatsapp/index.ts, wired to
# Settings -> WhatsApp), and dynamic requires + native Chromium binaries are
# exactly what standalone's dependency tracer is known to miss. Copying the
# untouched build output instead trades a larger image for not having to
# hand-patch missing files after every dependency bump.
#
# Chromium + PUPPETEER_SKIP_CHROMIUM_DOWNLOAD/PUPPETEER_EXECUTABLE_PATH: same
# reasoning as agent/Dockerfile. This is a second, independent whatsapp-web.js
# client from the agent service's own bot — see CLAUDE.md's "Auth &
# authorization model" section if that's surprising.
#
# `prisma generate` happens automatically via package.json's "postinstall"
# script (output goes to src/generated/prisma, per prisma/schema.prisma), so
# the schema + prisma.config.ts must exist BEFORE `bun install`, not just
# before `next build`. Same postinstall also runs scripts/patch-whatsapp.ts,
# which edits whatsapp-web.js's injected browser script in place — so
# scripts/ has to be present at install time too.

# ============================================================================
# Stage 1: deps + build
# ============================================================================
FROM node:22-slim AS builder

WORKDIR /app

RUN npm install -g bun

# openssl/ca-certificates: Prisma's query engine + TLS to Postgres
# (sslmode=require etc).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's bundled Chromium download at install time — the runtime
# stage installs a system Chromium instead and points
# PUPPETEER_EXECUTABLE_PATH at it.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY app/package.json app/bun.lock ./
COPY app/prisma ./prisma
COPY app/prisma.config.ts ./
COPY app/scripts ./scripts

RUN bun install --frozen-lockfile

# Source after install for better layer caching.
COPY app/next.config.ts app/tsconfig.json app/postcss.config.mjs ./
COPY app/public ./public
COPY app/src ./src

# NEXT_PUBLIC_* vars get inlined into the client bundle by `next build` and
# are NOT re-readable at container runtime — override at build time:
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://logistics.example.com \
#                 --build-arg NEXT_PUBLIC_AGENT_URL=https://agent.logistics.example.com .
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ARG NEXT_PUBLIC_AGENT_URL=http://localhost:3001
ENV NEXT_PUBLIC_AGENT_URL=${NEXT_PUBLIC_AGENT_URL}

# `next build` re-runs `prisma generate` (package.json's "build" script), and
# prisma.config.ts unconditionally reads process.env["DATABASE_URL"] — give
# it a harmless placeholder so nothing that touches this value at build time
# can trip over `undefined`. Nothing at build time actually connects to a
# database; the real value is supplied at container start.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}

RUN bun run build

# ============================================================================
# Stage 2: runtime
# ============================================================================
FROM node:22-slim AS runtime

# Chromium + shared libs for the app's own whatsapp-web.js/Puppeteer client.
# Keep this list in sync with agent/Dockerfile.
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
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=3000

WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser -m appuser

# Unpruned copy — see header comment on why this skips `output: standalone`.
COPY --from=builder /app ./

# WhatsApp session (LocalAuth) lives here — mount a volume over it so a
# redeploy doesn't force re-scanning the pairing QR code.
RUN mkdir -p /app/.wwebjs_auth && chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

# `/` redirects to /sign-in or /dashboard depending on session state — any
# non-5xx response means the server is up and serving.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

# `prisma migrate deploy` applies any pending migrations before the server
# takes traffic — needs the real DATABASE_URL, only available at container
# start, not the placeholder ARG'd in during build.
#
# Both run through node_modules/.bin directly (via plain Node, not
# `bun run`/`bunx`) so the actual server process is Next's own Node runtime —
# `bun` here is only ever used for installing packages, not for serving
# production traffic, since Next's CLI under Bun's runtime isn't something
# this app has been verified against. `exec` hands off to `next start` as
# PID 1's replacement so it receives SIGTERM directly for a clean shutdown
# instead of leaving it with the wrapping shell.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/next start"]
