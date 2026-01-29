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
import { isAdminPhoneNumber, BUSINESS_INFO_SYSTEM_PROMPT } from "./lib/constants";
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
      
      // Get the bot's own phone number
      const botInfo = await client.getClient().info;
      const botPhoneNumber = botInfo?.wid?.user ? `+${botInfo.wid.user}` : null;
      
      if (botPhoneNumber) {
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
          console.log("Received message: ", msg.body);
          
          // Use msg.reply() instead of client.sendMessage()
          await msg.reply("Generic reply here");

          // Extract phone number from WhatsApp ID
          // Format can be: 263789859332@c.us (normal) or 71025924542654@lid (broadcast/status)
          const phoneNumber = msg.from.replace(/@c\.us|@lid|@g\.us/g, "");
          const formattedNumber = `+${phoneNumber}`;
          
          // Ignore broadcast/status messages or group messages
          if (msg.from.includes("@lid") || msg.from.includes("@g.us")) {
            console.log(`⚠️ Ignoring non-personal message from: ${msg.from}`);
            return;
          }
          
          // Check if message contains WD_LOGISTICS keyword (case-insensitive)
          const hasKeyword = msg.body.toUpperCase().includes("WD_LOGISTICS");
          
          // Check if message is from bot's own number
          const isOwnNumber = botPhoneNumber && formattedNumber === botPhoneNumber;
          
          // Check if sender is an admin
          const isAdmin = isAdminPhoneNumber(formattedNumber);
          
          // Allow bot's own messages with keyword for testing
          if (isOwnNumber) {
            if (hasKeyword) {
              console.log(`📨 Processing self-message with WD_LOGISTICS keyword for testing`);
              console.log(`📝 Generating AI response for self-message...`);
              
              // Process with AI agent (full admin access)
              const response = await logisticsAgent.generate([
                {
                  role: "user",
                  content: msg.body,
                },
              ]);

              console.log("Received message: ", msg.body);
              msg.reply("This is a test");
              
              console.log(`💬 Generated response: ${response.text.substring(0, 100)}...`);
              // Use msg.reply() to reply to the message
              await replyToMessage(msg, response.text);
              console.log(`✅ Replied to self-message`);
            } else {
              console.log(`⚠️ Ignoring self-message without WD_LOGISTICS keyword`);
            }
            return;
          }
          
          // Process admin messages (no keyword required)
          if (isAdmin) {
            console.log(`📨 Processing message from admin: ${formattedNumber}`);
            console.log(`📝 Generating AI response for admin with full access...`);
            
            // Process with AI agent (full admin access)
            const response = await logisticsAgent.generate([
              {
                role: "user",
                content: msg.body,
              },
            ]);
            
            console.log(`💬 Generated response: ${response.text.substring(0, 100)}...`);
            // Use msg.reply() to reply to the message
            await replyToMessage(msg, response.text);
            console.log(`✅ Replied to admin: ${formattedNumber}`);
            return;
          }
          
          // // Non-admin user - only respond if message contains WD_LOGISTICS
          // if (!hasKeyword) {
          //   console.log(`⚠️ Ignoring non-admin message without WD_LOGISTICS keyword: ${formattedNumber}`);
          //   return;
          // }
          
          // Respond to non-admin with keyword using business info only
          console.log(`💬 Processing business inquiry with WD_LOGISTICS from: ${formattedNumber}`);
          console.log(`📝 Generating AI response with business info system prompt...`);
          
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
          
          console.log(`💬 Generated response: ${response.text.substring(0, 100)}...`);
          // Use msg.reply() to reply to the message
          await replyToMessage(msg, response.text);
          console.log(`✅ Sent business info to: ${formattedNumber}`);
          
        } catch (error: any) {
          // Check if it's just the markedUnread error
          if (error?.message?.includes("markedUnread") || 
              error?.toString()?.includes("markedUnread")) {
            console.log(`✅ Message sent (markedUnread error ignored)`);
            return;
          }
          
          console.error("Error processing incoming message:", error);
          // Don't try to send error message as it might cause the same error
          console.log(`⚠️ Skipping error reply to avoid recursive failure`);
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
