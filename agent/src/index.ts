import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import workflows from "./routes/workflows";
import whatsapp from "./routes/whatsapp";
import webhooks from "./routes/webhooks";
import { getAgentWhatsAppClient } from "./lib/whatsapp";

const app = new Hono();

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.WEB_APP_URL,
].filter(Boolean) as string[];

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return "*";
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) return origin;
      // Allow any localhost port in development
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return origin;
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "WD Logistics AI Agent",
    version: "1.0.0",
    status: "healthy",
    endpoints: {
      chat: "/chat",
      chatStream: "/chat/stream",
      chatHealth: "/chat/health",
      workflows: "/workflows",
      workflowsHealth: "/workflows/health",
      whatsapp: "/whatsapp",
      whatsappHealth: "/whatsapp/health",
      webhooks: "/webhooks",
      webhooksHealth: "/webhooks/health",
    },
  });
});

// Mount routes
app.route("/chat", chat);
app.route("/workflows", workflows);
app.route("/whatsapp", whatsapp);
app.route("/webhooks", webhooks);

// Start server
const port = Number(process.env.PORT) || 3001;

console.log(`🤖 WD Logistics AI Agent running on http://localhost:${port}`);

// Initialize WhatsApp client (optional - can be done on-demand)
const initWhatsApp = async () => {
  try {
    const client = getAgentWhatsAppClient();
    const initialized = await client.initialize();
    if (initialized) {
      console.log("✅ WhatsApp client initialized on startup");
    }
  } catch (error) {
    console.warn("⚠️  WhatsApp client initialization deferred (will initialize on first use):", error);
  }
};

// Try to initialize WhatsApp if configured
if (process.env.INITIALIZE_WHATSAPP === "true") {
  initWhatsApp();
}

serve({
  fetch: app.fetch,
  port,
});

export default app;
