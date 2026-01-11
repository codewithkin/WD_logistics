/**
 * Webhook Routes for External Triggers
 * 
 * These endpoints are called by the Next.js web app to trigger
 * notifications and workflows in real-time.
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  notifyTripAssignment,
  sendInvoiceReminderById,
} from "../workflows";
import { getAgentWhatsAppClient } from "../lib/whatsapp";
import prisma from "../lib/prisma";

const webhooks = new Hono();

// Schema for trip assignment webhook
const tripAssignmentSchema = z.object({
  tripId: z.string().describe("The ID of the trip"),
  organizationId: z.string().describe("The organization ID"),
  sendImmediately: z.boolean().optional().default(false).describe("Whether to send via WhatsApp immediately"),
});

// Schema for invoice reminder webhook
const invoiceReminderSchema = z.object({
  invoiceId: z.string().describe("The ID of the invoice"),
  organizationId: z.string().describe("The organization ID"),
  sendImmediately: z.boolean().optional().default(false).describe("Whether to send via WhatsApp immediately"),
});

/**
 * POST /webhooks/trip-assigned
 * Called when a driver is assigned to a trip
 */
webhooks.post(
  "/trip-assigned",
  zValidator("json", tripAssignmentSchema),
  async (c) => {
    const { tripId, organizationId, sendImmediately } = c.req.valid("json");

    try {
      // Create the notification record
      const result = await notifyTripAssignment(tripId, organizationId);

      if (!result.success) {
        return c.json(result, 400);
      }

      // If sendImmediately is true, try to send via WhatsApp
      if (sendImmediately && result.data) {
        const client = getAgentWhatsAppClient();
        
        if (client.isConnected()) {
          try {
            const phone = result.data.phone as string;
            const message = result.data.notificationMessage as string;
            
            await client.sendMessage(phone, message);
            
            // Update notification status to sent
            await prisma.notification.updateMany({
              where: {
                metadata: {
                  path: ["tripId"],
                  equals: tripId,
                },
                status: "pending",
              },
              data: {
                status: "sent",
                sentAt: new Date(),
              },
            });

            return c.json({
              ...result,
              whatsappSent: true,
              message: `Trip assignment notification sent via WhatsApp to ${result.data.driverName}`,
            });
          } catch (whatsappError) {
            console.error("WhatsApp send failed:", whatsappError);
            return c.json({
              ...result,
              whatsappSent: false,
              whatsappError: whatsappError instanceof Error ? whatsappError.message : "Failed to send WhatsApp",
            });
          }
        } else {
          return c.json({
            ...result,
            whatsappSent: false,
            whatsappError: "WhatsApp client not connected",
          });
        }
      }

      return c.json(result);
    } catch (error) {
      console.error("Trip assignment webhook error:", error);
      return c.json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to process trip assignment",
      }, 500);
    }
  }
);

/**
 * POST /webhooks/invoice-reminder
 * Called to send a payment reminder for an invoice
 */
webhooks.post(
  "/invoice-reminder",
  zValidator("json", invoiceReminderSchema),
  async (c) => {
    const { invoiceId, organizationId, sendImmediately } = c.req.valid("json");

    try {
      // Create the notification record
      const result = await sendInvoiceReminderById(invoiceId, organizationId);

      if (!result.success) {
        return c.json(result, 400);
      }

      // If sendImmediately is true, try to send via WhatsApp
      if (sendImmediately && result.data) {
        const client = getAgentWhatsAppClient();
        
        if (client.isConnected()) {
          try {
            const phone = result.data.phone as string;
            const message = result.data.notificationMessage as string;
            
            await client.sendMessage(phone, message);
            
            // Update notification status to sent
            await prisma.notification.updateMany({
              where: {
                metadata: {
                  path: ["invoiceId"],
                  equals: invoiceId,
                },
                status: "pending",
              },
              data: {
                status: "sent",
                sentAt: new Date(),
              },
            });

            return c.json({
              ...result,
              whatsappSent: true,
              message: `Invoice reminder sent via WhatsApp to ${result.data.customerName}`,
            });
          } catch (whatsappError) {
            console.error("WhatsApp send failed:", whatsappError);
            return c.json({
              ...result,
              whatsappSent: false,
              whatsappError: whatsappError instanceof Error ? whatsappError.message : "Failed to send WhatsApp",
            });
          }
        } else {
          return c.json({
            ...result,
            whatsappSent: false,
            whatsappError: "WhatsApp client not connected",
          });
        }
      }

      return c.json(result);
    } catch (error) {
      console.error("Invoice reminder webhook error:", error);
      return c.json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to process invoice reminder",
      }, 500);
    }
  }
);

/**
 * POST /webhooks/bulk-trip-notifications
 * Send notifications for multiple trips at once
 */
webhooks.post(
  "/bulk-trip-notifications",
  zValidator(
    "json",
    z.object({
      tripIds: z.array(z.string()).min(1).max(50),
      organizationId: z.string(),
      sendImmediately: z.boolean().optional().default(false),
    })
  ),
  async (c) => {
    const { tripIds, organizationId, sendImmediately } = c.req.valid("json");

    const results = [];
    for (const tripId of tripIds) {
      const result = await notifyTripAssignment(tripId, organizationId);
      results.push({ tripId, ...result });
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return c.json({
      success: failed === 0,
      message: `Processed ${tripIds.length} trips: ${successful} successful, ${failed} failed`,
      results,
    });
  }
);

/**
 * GET /webhooks/health
 * Health check for webhooks
 */
webhooks.get("/health", async (c) => {
  const client = getAgentWhatsAppClient();
  const state = client.getState();

  return c.json({
    status: "healthy",
    whatsapp: {
      connected: state.status === "ready",
      status: state.status,
    },
    timestamp: new Date().toISOString(),
  });
});

export default webhooks;
