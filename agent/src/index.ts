import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import workflows from "./routes/workflows";
import whatsapp from "./routes/whatsapp";
import webhooks from "./routes/webhooks";
import { getAgentWhatsAppClient } from "./lib/whatsapp";
import { isAdminPhoneNumber, BUSINESS_INFO_SYSTEM_PROMPT } from "./lib/constants";
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

// Initialize WhatsApp client immediately on startup (if enabled)
const initWhatsApp = async () => {
  // Check if WhatsApp should be enabled
  const whatsappEnabled = process.env.ENABLE_WHATSAPP === "true" || process.env.ENABLE_WHATSAPP === "1";
  
  if (!whatsappEnabled) {
    console.log("⏭️  WhatsApp integration disabled (set ENABLE_WHATSAPP=true to enable)");
    return;
  }
  
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
      
      // Get the bot's own phone number
      const botInfo = await client.getClient().info;
      const botPhoneNumber = botInfo?.wid?.user ? `+${botInfo.wid.user}` : null;
      
      if (botPhoneNumber) {
        console.log(`📱 Bot connected as: ${botPhoneNumber}`);
      }
      
      // Setup incoming message handler
      client.on("message", async (msg: { from: string; body: string; reply: (text: string) => Promise<void> }) => {
        try {
          // Extract phone number from WhatsApp ID
          // Format can be: 263789859332@c.us (normal) or 71025924542654@lid (broadcast/status)
          const phoneNumber = msg.from.replace(/@c\.us|@lid|@g\.us/g, "");
          const formattedNumber = `+${phoneNumber}`;
          
          // Ignore broadcast/status messages or group messages
          if (msg.from.includes("@lid") || msg.from.includes("@g.us")) {
            console.log(`⚠️ Ignoring non-personal message from: ${msg.from}`);
            return;
          }
          
          // Check if message is from bot's own number with WD_LOGISTICS keyword
          const isOwnNumber = botPhoneNumber && formattedNumber === botPhoneNumber;
          const hasKeyword = msg.body.includes("WD_LOGISTICS");
          
          if (isOwnNumber && hasKeyword) {
            console.log(`📨 Processing self-message with WD_LOGISTICS keyword`);
            
            // Process with AI agent (full admin access)
            const response = await logisticsAgent.generate([
              {
                role: "user",
                content: msg.body,
              },
            ]);
            
            await msg.reply(response.text);
            console.log(`✅ Replied to self-message`);
            return;
          }
          
          // Check if sender is an admin
          const isAdmin = isAdminPhoneNumber(formattedNumber);
          
          if (isAdmin) {
            console.log(`📨 Processing message from admin: ${formattedNumber}`);
            
            // Process with AI agent (full admin access)
            const response = await logisticsAgent.generate([
              {
                role: "user",
                content: msg.body,
              },
            ]);
            
            await msg.reply(response.text);
            console.log(`✅ Replied to admin: ${formattedNumber}`);
            return;
          }
          
          // Non-admin user - check if we should respond
          const noAdminAnswer = process.env.NO_ADMIN_ANSWER === "true" || process.env.NO_ADMIN_ANSWER === "1";
          
          if (noAdminAnswer) {
            console.log(`⚠️ Ignoring non-admin message (NO_ADMIN_ANSWER enabled): ${formattedNumber}`);
            return;
          }
          
          // Respond to non-admin with business info only
          console.log(`💬 Processing business inquiry from: ${formattedNumber}`);
          
          // Process with AI agent using business info system prompt
          const response = await logisticsAgent.generate([
            {
              role: "system",
              content: BUSINESS_INFO_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: msg.body,
            },
          ]);
          
          await msg.reply(response.text);
          console.log(`✅ Sent business info to: ${formattedNumber}`);
          
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
