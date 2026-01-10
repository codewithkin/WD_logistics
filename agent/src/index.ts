import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import workflows from "./routes/workflows";
import whatsapp from "./routes/whatsapp";
import { getAgentWhatsAppClient } from "./lib/whatsapp";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
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
    },
  });
});

// Mount routes
app.route("/chat", chat);
app.route("/workflows", workflows);
app.route("/whatsapp", whatsapp);

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
