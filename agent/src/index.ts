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
import { answerMessage } from "./agents/assistant";
import { logModelConfiguration } from "./lib/model";
import { notificationsApi } from "./lib/api-client";

/**
 * The organisation this bot belongs to.
 *
 * A delivery receipt arrives from WhatsApp, not from a request, so there is
 * no per-call organisation context to read it from — unlike every other call
 * in api-client. This deployment is single-organisation by design (see
 * `organizationLimit: 1` in the app's auth config), so one env var is enough.
 */
const ORGANIZATION_ID = process.env.AGENT_ORGANIZATION_ID ?? "";
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

// Print the model and key status at boot: a missing OPENROUTER_API_KEY
// otherwise shows up as the assistant silently never replying.
logModelConfiguration();

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
    const body = await c.req.json();
    // `to` is what the app sends; `phoneNumber` is kept for older callers.
    const phoneNumber = body.to ?? body.phoneNumber;
    const message = body.message;

    if (!phoneNumber || !message) {
      return c.json({ success: false, error: "Missing 'to' or 'message'" }, 400);
    }
    const client = getAgentWhatsAppClient().getClient();
    if (!client) {
      // 503, not 500: the bot is unpaired rather than broken, and the app
      // turns this into "pair it under Settings, then resend".
      return c.json(
        { success: false, error: "WhatsApp is not connected. Pair the bot and try again." },
        503
      );
    }
    // Format phone number for WhatsApp
    const formattedNumber = phoneNumber.replace(/\D/g, "") + "@c.us";

    // Check if number is registered on WhatsApp
    const isRegistered = await client.isRegisteredUser(formattedNumber);
    if (!isRegistered) {
      return c.json(
        { success: false, error: `${phoneNumber} is not registered on WhatsApp` },
        400
      );
    }

    console.log("[LOG]: Sending message to:", formattedNumber);
    const sent = await client.sendMessage(formattedNumber, message);

    // The message id is what a later delivery receipt refers back to. It used
    // to be discarded, which made acks impossible to match to anything.
    return c.json({ success: true, messageId: sent?.id?._serialized ?? null });
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
  // README/.env.example document ENABLE_WHATSAPP as gating this (disabled by
  // default in production); this was previously hardcoded to `true` and
  // ignored the env var entirely, so every boot launched Chromium/Puppeteer
  // unconditionally regardless of configuration.
  const whatsappEnabled = process.env.ENABLE_WHATSAPP === "true";

  if (!whatsappEnabled) {
    console.log("⏭️  WhatsApp integration disabled (set ENABLE_WHATSAPP=true to enable)");
    return;
  }

  // tsx watch restarts on every save. Each restart is a fresh Chromium
  // against the same profile, which is exactly what unlinks the device.
  if (process.env.TSX_WATCH || process.argv.some((a) => a.includes("watch"))) {
    console.warn(
      "⚠️  WhatsApp is enabled under a file watcher. Every save restarts the " +
        "process and re-opens the session, which can unlink your device. " +
        "Use `bun run dev:whatsapp` (no watcher) when you need the bot paired.",
    );
  }

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
      
      console.log(`\n✅ MESSAGE HANDLER SETUP STARTING`);
      console.log(`   Bot phone number: ${botPhoneNumber}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Setup incoming message handler
      // A delivery receipt from WhatsApp: tell the app, so the trip page can
      // say "delivered" or "read" rather than stopping at "sent".
      client.on("message_ack", async ({ messageId, ack }: { messageId?: string; ack: number }) => {
        if (!messageId || ack < 2) return;
        try {
          await notificationsApi.recordAck(ORGANIZATION_ID, messageId, ack);
        } catch (error) {
          // A lost receipt is not worth crashing the bot over; the
          // message itself was already delivered.
          console.error("[LOG]: could not record delivery receipt:", error);
        }
      });

      client.on("message_create", async (msg: any) => {
        try {
          // Log every received message
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📬 MESSAGE RECEIVED`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   From: ${msg.from}`);
          console.log(`   Body: "${msg.body.substring(0, 100)}${msg.body.length > 100 ? '...' : ''}"`);
          console.log(`   Timestamp: ${new Date().toISOString()}`);
          console.log(`   Message type: ${msg.type}`);
          console.log(`   Message ID: ${msg.id}`);
          
          // Ignore broadcast/status messages or group messages
          if (shouldIgnoreMessage(msg.from)) {
            console.log(`⚠️ EARLY RETURN: Non-personal message (broadcast/group/status)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            return;
          }
          
          // Extract phone number from WhatsApp ID
          const phoneNumber = extractPhoneNumber(msg.from);
          console.log(`📱 Extracted phone: ${phoneNumber}`);
          console.log(`   Bot phone number: ${botPhoneNumber}`);
          
          // Check if it's the bot's own number and ignore
          if (botPhoneNumber && phoneNumber === botPhoneNumber) {
            console.log(`⚠️ EARLY RETURN: Message from bot's own number (self-message) - ignoring`);
            console.log(`   Bot number: ${botPhoneNumber}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            return;
          }
          
          // Who is this? The allowlist lives in the app now, managed by an
          // admin under Settings, rather than in three environment variables
          // that needed a redeploy to change.
          console.log(`🔐 Checking the contact list...`);

          const reply = await answerMessage({
            phone: phoneNumber,
            message: msg.body,
          });

          if (reply.error) {
            console.log(`⚠️ Assistant reported a problem: ${reply.error}`);
          }
          if (reply.didWrite) {
            console.log(`✍️  This message changed data — see the transcript.`);
          }
          console.log(
            `🔧 Tools used: ${
              reply.toolCalls.length === 0
                ? "none"
                : reply.toolCalls.map((c) => `${c.tool}${c.ok ? "" : " (failed)"}`).join(", ")
            }`
          );
          console.log(`💬 Replying (${reply.text.length} characters)`);

          await replyToMessage(msg, reply.text);
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
      
      console.log(`✅ MESSAGE HANDLER REGISTERED SUCCESSFULLY`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      // Also log when we detect all client events for debugging
      console.log(`\n📋 SETTING UP EVENT LISTENERS FOR DEBUGGING`);
      
      // Listen to all events for debugging
      const originalOn = client.getClient().on;
      client.getClient().on = function(eventName: string, handler: any) {
        if (eventName !== "message_create" && eventName !== "message") {
          // Don't log the logging listener itself
          console.log(`   📌 WhatsApp client event listener registered: ${eventName}`);
        }
        return originalOn.call(this, eventName, handler);
      };
      
      console.log(`✅ WHATSAPP INITIALIZATION COMPLETE AND READY FOR MESSAGES`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }
  } catch (error) {
    console.error("❌ Failed to initialize WhatsApp client:", error);
  }
};

/**
 * Close Chromium before the process goes away.
 *
 * Without this, every restart — and `bun run dev` is `tsx watch`, so that is
 * every file save — killed Node while Chromium still held the WhatsApp
 * session open. The browser was left behind holding the profile directory,
 * the next boot opened a second Chromium against the same profile, and
 * WhatsApp dropped the linked device. The symptom is a session that
 * unauthenticates itself a moment after the QR code is scanned.
 */
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (process.env.ENABLE_WHATSAPP === "true") {
    console.log(`
🛑 ${signal} — closing the WhatsApp session cleanly...`);
    try {
      await getAgentWhatsAppClient().disconnect();
      console.log("✅ WhatsApp session closed; it will still be linked next boot.");
    } catch (error) {
      console.error("⚠️  Could not close the WhatsApp session cleanly:", error);
    }
  }

  process.exit(0);
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => void shutdown(signal));
}

// Start WhatsApp initialization immediately
initWhatsApp();

export default app;
