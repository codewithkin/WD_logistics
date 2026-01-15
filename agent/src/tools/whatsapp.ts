/**
 * WhatsApp Tool for AI Agent
 * 
 * This tool allows the AI agent to send WhatsApp messages to drivers,
 * customers, and other contacts as part of automated workflows.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { getAgentWhatsAppClient } from "../lib/whatsapp";
import { api } from "../lib/api-client";

/**
 * Send WhatsApp message tool
 * Used by the agent to send messages to drivers, customers, etc.
 */
export const sendWhatsAppMessage = createTool({
  id: "send_whatsapp_message",
  description:
    "Send a WhatsApp message to a driver, customer, or contact. Use this to notify drivers of trips, remind customers of payments, or send operational updates.",
  inputSchema: z.object({
    organizationId: z.string().describe("The organization ID for logging purposes"),
    phoneNumber: z.string().describe("The phone number to send the message to (e.g., +1234567890)"),
    message: z
      .string()
      .min(1)
      .max(5000)
      .describe("The message to send (WhatsApp has a limit per message)"),
    recipientType: z
      .enum(["driver", "customer", "employee", "other"])
      .describe("Type of recipient for logging and context"),
    recipientId: z.string().optional().describe("ID of the recipient (driverId, customerId, etc)"),
  }),
  execute: async ({ context }) => {
    const { organizationId, phoneNumber, message, recipientType, recipientId } = context;
    try {
      const client = getAgentWhatsAppClient();

      // Check if client is ready
      if (!client.isConnected()) {
        return {
          success: false,
          error: "WhatsApp client is not connected. Please initialize WhatsApp in settings.",
        };
      }

      // Send the message
      const result = await client.sendMessage(phoneNumber, message);

      // Log the message in database
      try {
        await api.workflows.createNotification(organizationId, {
          type: "whatsapp",
          recipientPhone: phoneNumber,
          message: message,
          status: "sent",
          metadata: {
            channel: "whatsapp",
            recipientType: recipientType,
            recipientId: recipientId,
          },
        });
      } catch (error) {
        console.warn("Failed to log notification to database:", error);
        // Continue - logging failure shouldn't block the operation
      }

      return {
        success: true,
        messageId: result.id,
        to: phoneNumber,
        sentAt: result.timestamp,
        message: `Message sent successfully to ${phoneNumber}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("WhatsApp send error:", error);

      return {
        success: false,
        error: `Failed to send message: ${errorMsg}`,
      };
    }
  },
});

/**
 * Send bulk WhatsApp messages to multiple recipients
 */
export const sendBulkWhatsAppMessages = createTool({
  id: "send_bulk_whatsapp_messages",
  description:
    "Send WhatsApp messages to multiple recipients (drivers, customers, etc). Useful for broadcasts and bulk notifications.",
  inputSchema: z.object({
    recipients: z
      .array(
        z.object({
          phoneNumber: z.string(),
          recipientType: z.enum(["driver", "customer", "employee", "other"]),
          recipientId: z.string().optional(),
        })
      )
      .min(1)
      .max(100)
      .describe("List of recipients"),
    message: z.string().min(1).max(5000).describe("The message to send to all recipients"),
    delayMs: z.number().optional().default(1000).describe("Delay between messages in milliseconds"),
  }),
  execute: async ({ context }) => {
    const { recipients, message, delayMs } = context;
    try {
      const client = getAgentWhatsAppClient();

      if (!client.isConnected()) {
        return {
          success: false,
          error: "WhatsApp client is not connected. Please initialize WhatsApp in settings.",
        };
      }

      // Send messages with rate limiting
      const results = await client.sendBulkMessages(
        recipients.map((r: any) => ({
          to: r.phoneNumber,
          body: message,
        })),
        delayMs
      );

      // Count successes and failures
      let successCount = 0;
      let failureCount = 0;
      const failures: Array<{ to: string; error: string }> = [];

      for (const result of results) {
        if ((result as any).error) {
          failureCount++;
          failures.push({ to: (result as any).to, error: (result as any).error });
        } else {
          successCount++;
        }
      }

      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        total: results.length,
        failures: failures.length > 0 ? failures : undefined,
        message: `Sent to ${successCount}/${results.length} recipients`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to send bulk messages: ${errorMsg}`,
      };
    }
  },
};

/**
 * Check WhatsApp connection status
 */
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("Bulk WhatsApp send error:", error);

      return {
        success: false,
        error: `Failed to send bulk messages: ${errorMsg}`,
      };
    }
  },
});

/**
 * Check WhatsApp connection status
 */
export const checkWhatsAppStatus = createTool({
  id: "check_whatsapp_status",
  description: "Check if the WhatsApp integration is connected and ready for sending messages.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const client = getAgentWhatsAppClient();
      const state = client.getState();

      return {
        success: true,
        connected: state.status === "ready",
        status: state.status,
        phoneNumber: state.phoneNumber,
        messagesSent: state.messagesSent,
        queuedMessages: client.getQueueLength(),
        ready: `WhatsApp is ${state.status === "ready" ? "ready" : "not ready"}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to check status: ${errorMsg}`,
      };
    }
  },
});

export const whatsappTools = {
  send_whatsapp_message: sendWhatsAppMessage,
  send_bulk_whatsapp_messages: sendBulkWhatsAppMessages,
  check_whatsapp_status: checkWhatsAppStatus,
};

export default whatsappTools;
