/**
 * Test WhatsApp Route
 * 
 * Simple test route that sends and receives messages using basic whatsapp-web.js
 * No validation, no fancy implementation - just msg.reply()
 */

import { Hono } from "hono";
import { getAgentWhatsAppClient } from "../lib/whatsapp";

const testWhatsApp = new Hono();

const TEST_NUMBER = "+263789859332";

/**
 * POST /test-whatsapp/start - Initialize test message handler
 */
testWhatsApp.post("/start", async (c) => {
  try {
    const client = getAgentWhatsAppClient();
    const wwebClient = client.getClient();

    if (!wwebClient) {
      return c.json(
        {
          success: false,
          error: "WhatsApp client not initialized",
        },
        503
      );
    }

    const state = client.getState();
    if (state.status !== "ready") {
      return c.json(
        {
          success: false,
          error: `WhatsApp client is ${state.status}, not ready`,
        },
        503
      );
    }

    const TEST_MODE = process.env.TEST_MODE === "true";

    // Remove any existing listeners to avoid duplicates
    wwebClient.removeAllListeners("message");

    if (TEST_MODE) {
      console.log("✅ Test mode enabled. Listening for messages from test number.");

      // Set up simple message handler that always replies
      wwebClient.on("message", async (msg: any) => {
        // Only respond to messages from the test number
        const senderPhone = msg.from.replace(/@c\.us|@g\.us|@lid/g, "");
        const formattedSender = `+${senderPhone}`;

        if (formattedSender === TEST_NUMBER) {
          console.log(`📨 Test message from ${TEST_NUMBER}: ${msg.body}`);
          try {
            // Reply using msg.reply() as per the requirement
            await msg.reply(`Echo: ${msg.body}`);
            console.log(`✅ Replied to ${TEST_NUMBER}`);
          } catch (replyError) {
            console.error(`❌ Failed to reply:`, replyError);
          }
        }
      });

      console.log(`✅ Test message handler started for ${TEST_NUMBER}`);
    } else {
      console.log("⚠️ Test mode is disabled. No message handler is active.");
    }

    return c.json({
      success: true,
      message: "Test handler setup complete",
      listeningTo: TEST_NUMBER,
      testMode: TEST_MODE,
      handler: "msg.reply()",
    });
  } catch (error) {
    console.error("Test WhatsApp error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * GET /test-whatsapp/status - Check test status
 */
testWhatsApp.get("/status", (c) => {
  const client = getAgentWhatsAppClient();
  const state = client.getState();

  return c.json({
    success: true,
    whatsappStatus: state.status,
    testNumber: TEST_NUMBER,
    isReady: state.status === "ready",
    message: "Test route is active. POST to /test-whatsapp/start to initialize.",
  });
});

export default testWhatsApp;
