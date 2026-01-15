import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import workflows from "./routes/workflows";
import whatsapp from "./routes/whatsapp";
import webhooks from "./routes/webhooks";
import { getAgentWhatsAppClient } from "./lib/whatsapp";
import { isAdminPhoneNumber } from "./lib/constants";
import { logisticsAgent } from "./agents/logistics-agent";

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

serve({
  fetch: app.fetch,
  port,
});

console.log(`🤖 WD Logistics AI Agent running on http://localhost:${port}`);

// Initialize WhatsApp client immediately on startup
const initWhatsApp = async () => {
  console.log("🔄 Initializing WhatsApp client...");
  try {
    const client = getAgentWhatsAppClient();

    // Listen for QR code
    client.on("qr", (qr) => {
      console.log("--- SCAN WHATSAPP QR CODE ---");
      // The qrcode-terminal library will print the QR code to the console here
    });

    // Listen for status changes
    client.on("status", (status) => {
      console.log(`📱 WhatsApp client status: ${status.status}`);
    });

    const initialized = await client.initialize();
    if (initialized) {
      console.log("✅ WhatsApp client initialized and ready");
      
      // Setup incoming message handler with admin phone filter
      client.on("message", async (msg: { from: string; body: string; reply: (text: string) => Promise<void> }) => {
        try {
          // Extract phone number from WhatsApp ID
          // Format can be: 263789859332@c.us (normal) or 71025924542654@lid (broadcast/status)
          const phoneNumber = msg.from.replace(/@c\.us|@lid|@g\.us/g, "");
          const formattedNumber = `+${phoneNumber}`;
          
          // Ignore broadcast/status messages (typically @lid)
          if (msg.from.includes("@lid") || msg.from.includes("@g.us")) {
            console.log(`⚠️ Ignoring non-personal message from: ${msg.from}`);
            return;
          }
          
          // Check if sender is an admin
          if (!isAdminPhoneNumber(formattedNumber)) {
            console.log(`⚠️ Ignoring message from non-admin number: ${formattedNumber}`);
            // Silently ignore non-admin messages to avoid errors
            return;
          }
          
          console.log(`📨 Processing message from admin: ${formattedNumber}`);
          
          // Process with AI agent
          const response = await logisticsAgent.generate([
            {
              role: "user",
              content: msg.body,
            },
          ]);
          
          // Reply via WhatsApp
          await msg.reply(response.text);
          console.log(`✅ Replied to admin: ${formattedNumber}`);
        } catch (error) {
          console.error("Error processing incoming message:", error);
          try {
            await msg.reply("Sorry, I encountered an error processing your request. Please try again.");
          } catch (replyError) {
            console.error("Failed to send error message:", replyError);
          }
        }
      });
    }
  } catch (error) {
    console.error("❌ Failed to initialize WhatsApp client:", error);
  }
};

// Start WhatsApp initialization immediately
initWhatsApp();

export default app;
