// Load environment variables FIRST before any other imports
import './env';

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import workflows from "./routes/workflows";
import whatsapp from "./routes/whatsapp";
import testWhatsApp from "./routes/test-whatsapp";
import webhooks from "./routes/webhooks";
import { getAgentWhatsAppClient } from "./lib/whatsapp";
import { 
  isAuthorizedNumber, 
  extractPhoneNumber, 
  shouldIgnoreMessage,
  setBotPhoneNumber,
  getAuthorizedUserName 
} from "./lib/constants";
import { logisticsAgent } from "./agents/logistics-agent";
import qrcode from "qrcode-terminal"

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
app.route("/test-whatsapp", testWhatsApp);
app.route("/webhooks", webhooks);

// Backend route to send WhatsApp message
app.post("/sendMessage", async (c) => {
  try {
    const { phoneNumber, message } = await c.req.json();
    if (!phoneNumber || !message) {
      return c.json({ success: false, error: "Missing phoneNumber or message" }, 400);
    }
    const client = getAgentWhatsAppClient().getClient();
    if (!client) {
      return c.json({ success: false, error: "WhatsApp client not initialized" }, 500);
    }
    // Format phone number for WhatsApp
    const formattedNumber = phoneNumber.replace(/\D/g, "") + "@c.us";

    // Check if number is registered on WhatsApp
    const isRegistered = await client.isRegisteredUser(formattedNumber);
    if (!isRegistered) {
      return c.json({ success: false, error: "Phone number is not registered on WhatsApp" }, 400);
    }

    console.log("[LOG]: Sending message to:", formattedNumber);
    await client.sendMessage(formattedNumber, message);

    console.log("[LOG]: should have sent message")
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send WhatsApp message:", error);
    return c.json({ success: false, error: error?.message || "Unknown error" }, 500);
  }
});

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
  const whatsappEnabled = true;
  
  console.log("🔄 Initializing WhatsApp client...");
  try {
    const client = getAgentWhatsAppClient();

    // Listen for QR code
    client.on("qr", (qr) => {
      console.log("--- SCAN WHATSAPP QR CODE ---");
      // The qrcode-terminal library will print the QR code to the console here
      qrcode.generate(qr, {small: true})
    });

    // Listen for status changes
    client.on("status", (status) => {
      console.log(`📱 WhatsApp client status: ${status.status}`);
    });

    const initialized = await client.initialize();
    if (initialized) {
      console.log("✅ WhatsApp client initialized and ready");
      
      // Get the bot's own phone number and register it
      const botInfo = await client.getClient().info;
      const botPhoneNumber = botInfo?.wid?.user ? `+${botInfo.wid.user}` : null;
      
      if (botPhoneNumber) {
        setBotPhoneNumber(botPhoneNumber);
        console.log(`📱 Bot connected as: ${botPhoneNumber}`);
      }
      
      // Patch the WhatsApp client to disable sendSeen which causes markedUnread error
      const whatsappClient = client.getClient();
      if (whatsappClient && whatsappClient.pupPage) {
        try {
          await whatsappClient.pupPage.evaluate(() => {
            // Override sendSeen to be a no-op to avoid markedUnread error
            if (window.WWebJS && window.WWebJS.sendSeen) {
              window.WWebJS.sendSeen = async () => {
                // Do nothing - this prevents the markedUnread error
                return true;
              };
            }
          });
          console.log("✅ Patched sendSeen to prevent markedUnread errors");
        } catch (patchError) {
          console.warn("⚠️ Could not patch sendSeen:", patchError);
        }
      }
      
      // Helper function to reply to a message using msg.reply()
      const replyToMessage = async (msg: any, content: string) => {
        try {
          console.log(`📤 Replying to message from ${msg.from}...`);
          await msg.reply(content);
          console.log(`✅ Message replied successfully`);
        } catch (error: any) {
          console.error(`❌ Error replying to message:`, error?.message || error);
          throw error;
        }
      };
      
      // Setup incoming message handler
      client.on("message_create", async (msg: any) => {
        try {
          // Log every received message
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📬 MESSAGE RECEIVED`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   From: ${msg.from}`);
          console.log(`   Body: "${msg.body.substring(0, 100)}${msg.body.length > 100 ? '...' : ''}"`);
          console.log(`   Timestamp: ${new Date().toISOString()}`);
          
          // Ignore broadcast/status messages or group messages
          if (shouldIgnoreMessage(msg.from)) {
            console.log(`⚠️ EARLY RETURN: Non-personal message (broadcast/group/status)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            return;
          }
          
          // Extract phone number from WhatsApp ID
          const phoneNumber = extractPhoneNumber(msg.from);
          console.log(`📱 Extracted phone: ${phoneNumber}`);
          
          // Check if it's the bot's own number and ignore
          if (botPhoneNumber && phoneNumber === botPhoneNumber) {
            console.log(`⚠️ EARLY RETURN: Message from bot's own number (self-message) - ignoring`);
            console.log(`   Bot number: ${botPhoneNumber}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            return;
          }
          
          // Check if sender is authorized
          console.log(`🔐 Checking authorization...`);
          const isAuthorized = isAuthorizedNumber(phoneNumber);
          
          if (!isAuthorized) {
            console.log(`⛔ EARLY RETURN: Unauthorized number`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            return;
          }
          
          // ✅ MESSAGE PASSED ALL CHECKS - LOG IT
          console.log(`\n✅ MESSAGE PASSED ALL CHECKS ✅`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`✓ From authorized number: ${phoneNumber}`);
          
          // Get user's name for personalization
          const userName = getAuthorizedUserName(phoneNumber);
          console.log(`✓ User identified as: ${userName || 'Unknown'}`);
          
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📝 Processing message with AI agent...`);
          
          // Get organization ID from environment (default to first org)
          // In production, you might want to map phone numbers to specific organizations
          const organizationId = "default-org-id"; // TODO: Map authorized numbers to their org IDs
          
          // Build context with user identification
          const userContext = userName 
            ? `[User: ${userName}] [Organization ID: ${organizationId}]\n\n` 
            : `[Organization ID: ${organizationId}]\n\n`;
          
          // Process with AI agent (full access to business data)
          const response = await logisticsAgent.generate([
            {
              role: "user",
              content: `${userContext}${msg.body}`,
            },
          ]);
          
          console.log(`💬 Generated response (${response.text.length} characters)`);
          console.log(`   Preview: "${response.text.substring(0, 60)}${response.text.length > 60 ? '...' : ''}"`);
          
          // Reply to the message
          await replyToMessage(msg, response.text);
          console.log(`✅ Message sent to ${phoneNumber}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
        } catch (error: any) {
          // Check if it's just the markedUnread error
          if (error?.message?.includes("markedUnread") || 
              error?.toString()?.includes("markedUnread")) {
            console.log(`✅ Message sent (markedUnread error ignored)`);
            return;
          }
          
          console.error("❌ Error processing incoming message:", error);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          // Try to send error message to user
          try {
            await replyToMessage(msg, "Sorry, I encountered an error processing your request. Please try again or contact support.");
          } catch (replyError) {
            console.log(`⚠️ Could not send error message to user`);
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
