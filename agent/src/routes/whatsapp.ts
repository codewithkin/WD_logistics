/**
 * WhatsApp Routes for AI Agent
 * 
 * Endpoints for WhatsApp integration with safety guardrails,
 * rate limiting, and access control.
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getAgentWhatsAppClient } from "../lib/whatsapp";
import { getMemoryManager, getRateLimiter, getInputGuard } from "../lib/memory";
import { db } from "../lib/prisma";
import {
  tripAssignmentTemplate,
  invoiceReminderTemplate,
  tripStatusTemplate,
  deliveryConfirmationTemplate,
  paymentReceivedTemplate,
  dailyScheduleTemplate,
  type TripMessageData,
  type InvoiceMessageData,
  type TripStatusMessageData,
  type DeliveryConfirmationData,
} from "../lib/message-templates";

const whatsapp = new Hono();

// Validation schemas
const sendMessageSchema = z.object({
  phoneNumber: z.string().min(7).describe("Phone number to send to"),
  message: z.string().min(1).max(5000).describe("Message content"),
  organizationId: z.string().describe("Organization ID"),
  recipientType: z
    .enum(["driver", "customer", "employee", "other"])
    .optional()
    .default("other"),
  recipientId: z.string().optional().describe("ID of recipient in system"),
});

const bulkMessageSchema = z.object({
  recipients: z
    .array(
      z.object({
        phoneNumber: z.string(),
        recipientId: z.string().optional(),
      })
    )
    .min(1)
    .max(100)
    .describe("Recipients"),
  message: z.string().min(1).max(5000),
  organizationId: z.string(),
  recipientType: z.enum(["driver", "customer", "employee", "other"]).optional(),
});

const statusSchema = z.object({
  organizationId: z.string(),
});

/**
 * POST /whatsapp/send - Send single message with guardrails
 */
whatsapp.post(
  "/send",
  zValidator("json", sendMessageSchema),
  async (c) => {
    try {
      const data = c.req.valid("json");
      const rateLimiter = getRateLimiter();
      const inputGuard = getInputGuard();
      const memoryManager = getMemoryManager();

      // Rate limiting
      const rateLimitKey = `${data.organizationId}:whatsapp`;
      if (!rateLimiter.isAllowed(rateLimitKey)) {
        return c.json(
          {
            success: false,
            error: "Rate limit exceeded. Please wait before sending more messages.",
            remaining: rateLimiter.getRemaining(rateLimitKey),
          },
          429
        );
      }

      // Validate organization access
      const hasAccess = await inputGuard.validateOrganizationAccess(
        "agent",
        data.organizationId
      );
      if (!hasAccess) {
        return c.json(
          {
            success: false,
            error: "Invalid organization",
          },
          403
        );
      }

      // Input validation and sanitization
      const validation = inputGuard.validateInput(data.message);
      if (!validation.valid) {
        return c.json(
          {
            success: false,
            error: validation.message,
          },
          400
        );
      }

      // Check WhatsApp client
      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json(
          {
            success: false,
            error: "WhatsApp is not connected. Initialize from settings.",
          },
          503
        );
      }

      // Send message
      const result = await client.sendMessage(data.phoneNumber, validation.cleaned!);

      // Log to memory
      const conversationId = `whatsapp:${data.recipientId || data.phoneNumber}`;
      const memory = await memoryManager.getOrCreateConversation(
        conversationId,
        data.organizationId,
        "agent"
      );

      memoryManager.addMessage(
        conversationId,
        "assistant",
        validation.cleaned!
      );

      // Log to database if recipientId provided
      if (data.recipientId) {
        await db.notification.create({
          data: {
            type: "whatsapp",
            channel: "whatsapp",
            recipientId: data.recipientId,
            recipientType: data.recipientType,
            title: "WhatsApp Message Sent",
            message: validation.cleaned!,
            status: "sent",
            sentAt: new Date(),
          },
        });
      }

      return c.json({
        success: true,
        messageId: result.id,
        to: data.phoneNumber,
        sentAt: result.timestamp,
        message: "Message sent successfully",
        remaining: rateLimiter.getRemaining(rateLimitKey),
      });
    } catch (error) {
      console.error("WhatsApp send error:", error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send message",
        },
        500
      );
    }
  }
);

/**
 * POST /whatsapp/send-bulk - Send bulk messages with rate limiting
 */
whatsapp.post(
  "/send-bulk",
  zValidator("json", bulkMessageSchema),
  async (c) => {
    try {
      const data = c.req.valid("json");
      const rateLimiter = getRateLimiter();
      const inputGuard = getInputGuard();

      // Rate limiting (stricter for bulk)
      const rateLimitKey = `${data.organizationId}:whatsapp:bulk`;
      if (!rateLimiter.isAllowed(rateLimitKey)) {
        return c.json(
          {
            success: false,
            error: "Bulk rate limit exceeded",
            remaining: rateLimiter.getRemaining(rateLimitKey),
          },
          429
        );
      }

      // Validate organization
      const hasAccess = await inputGuard.validateOrganizationAccess(
        "agent",
        data.organizationId
      );
      if (!hasAccess) {
        return c.json(
          {
            success: false,
            error: "Invalid organization",
          },
          403
        );
      }

      // Input validation
      const validation = inputGuard.validateInput(data.message);
      if (!validation.valid) {
        return c.json(
          {
            success: false,
            error: validation.message,
          },
          400
        );
      }

      // Check WhatsApp client
      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json(
          {
            success: false,
            error: "WhatsApp is not connected",
          },
          503
        );
      }

      // Send bulk messages with rate limiting
      const results = await client.sendBulkMessages(
        data.recipients.map((r) => ({
          to: r.phoneNumber,
          body: validation.cleaned!,
        })),
        2000 // 2 second delay between messages to respect WhatsApp rate limits
      );

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const recipient = data.recipients[i];

        if (!("error" in result)) {
          successCount++;

          // Log successful send
          if (recipient.recipientId) {
            await db.notification.create({
              data: {
                type: "whatsapp",
                channel: "whatsapp",
                recipientId: recipient.recipientId,
                recipientType: data.recipientType || "other",
                title: "WhatsApp Broadcast Message",
                message: validation.cleaned!,
                status: "sent",
                sentAt: new Date(),
              },
            });
          }
        } else {
          failureCount++;
        }
      }

      return c.json({
        success: failureCount === 0,
        successCount,
        failureCount,
        total: results.length,
        message: `Sent to ${successCount}/${results.length} recipients`,
        remaining: rateLimiter.getRemaining(rateLimitKey),
      });
    } catch (error) {
      console.error("WhatsApp bulk send error:", error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send bulk messages",
        },
        500
      );
    }
  }
);

/**
 * GET /whatsapp/status - Check WhatsApp connection status
 */
whatsapp.get("/status", zValidator("query", statusSchema), async (c) => {
  try {
    const { organizationId } = c.req.valid("query");

    // Verify org access
    const org = await db.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return c.json(
        {
          success: false,
          error: "Organization not found",
        },
        404
      );
    }

    const client = getAgentWhatsAppClient();
    const state = client.getState();

    return c.json({
      success: true,
      status: state.status,
      connected: state.status === "ready",
      phoneNumber: state.phoneNumber,
      messagesSent: state.messagesSent,
      queuedMessages: client.getQueueLength(),
      lastError: state.lastError,
    });
  } catch (error) {
    console.error("WhatsApp status error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check status",
      },
      500
    );
  }
});

/**
 * POST /whatsapp/initialize - Initialize WhatsApp client
 * (This is primarily done through the web app, but available here for agent startup)
 */
whatsapp.post(
  "/initialize",
  zValidator("json", z.object({ organizationId: z.string() })),
  async (c) => {
    try {
      const { organizationId } = c.req.valid("json");

      // Verify org
      const org = await db.organization.findUnique({
        where: { id: organizationId },
      });

      if (!org) {
        return c.json(
          {
            success: false,
            error: "Organization not found",
          },
          404
        );
      }

      const client = getAgentWhatsAppClient();
      const isInitialized = await client.initialize();

      if (!isInitialized) {
        return c.json(
          {
            success: false,
            error: "Failed to initialize WhatsApp client",
          },
          500
        );
      }

      return c.json({
        success: true,
        message: "WhatsApp client initialized",
        status: client.getState().status,
      });
    } catch (error) {
      console.error("WhatsApp initialize error:", error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to initialize",
        },
        500
      );
    }
  }
);

// ============================================================================
// TEMPLATED MESSAGING ENDPOINTS - Direct WhatsApp, no AI
// ============================================================================

// Schema for trip assignment template
const tripTemplateSchema = z.object({
  phoneNumber: z.string().min(7),
  organizationId: z.string(),
  data: z.object({
    driverName: z.string(),
    originCity: z.string(),
    originAddress: z.string().optional(),
    destinationCity: z.string(),
    destinationAddress: z.string().optional(),
    scheduledDate: z.coerce.date(),
    loadDescription: z.string().optional(),
    loadWeight: z.number().optional(),
    loadUnits: z.number().optional(),
    truckRegistration: z.string(),
    customerName: z.string(),
    notes: z.string().optional(),
  }),
});

// Schema for invoice reminder template
const invoiceTemplateSchema = z.object({
  phoneNumber: z.string().min(7),
  organizationId: z.string(),
  data: z.object({
    customerName: z.string(),
    invoiceNumber: z.string(),
    total: z.number(),
    dueDate: z.coerce.date(),
    balance: z.number(),
    organizationName: z.string(),
  }),
});

// Schema for trip status template
const tripStatusTemplateSchema = z.object({
  phoneNumber: z.string().min(7),
  organizationId: z.string(),
  data: z.object({
    customerName: z.string(),
    tripOrigin: z.string(),
    tripDestination: z.string(),
    status: z.enum(["in_progress", "completed", "delayed", "cancelled"]),
    estimatedArrival: z.coerce.date().optional(),
    notes: z.string().optional(),
  }),
});

// Schema for delivery confirmation template
const deliveryTemplateSchema = z.object({
  phoneNumber: z.string().min(7),
  organizationId: z.string(),
  data: z.object({
    customerName: z.string(),
    tripOrigin: z.string(),
    tripDestination: z.string(),
    deliveryDate: z.coerce.date(),
    driverName: z.string(),
  }),
});

// Schema for payment received template
const paymentTemplateSchema = z.object({
  phoneNumber: z.string().min(7),
  organizationId: z.string(),
  data: z.object({
    customerName: z.string(),
    invoiceNumber: z.string(),
    amount: z.number(),
    paymentDate: z.coerce.date(),
    paymentMethod: z.string(),
    organizationName: z.string(),
  }),
});

/**
 * POST /whatsapp/template/trip-assignment - Send trip assignment notification
 * Direct WhatsApp message using pre-defined template (no AI)
 */
whatsapp.post(
  "/template/trip-assignment",
  zValidator("json", tripTemplateSchema),
  async (c) => {
    try {
      const { phoneNumber, organizationId, data } = c.req.valid("json");

      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json({ success: false, error: "WhatsApp not connected" }, 503);
      }

      const message = tripAssignmentTemplate(data as TripMessageData);
      const result = await client.sendMessage(phoneNumber, message);

      // Log to database
      await db.notification.create({
        data: {
          type: "trip_assignment",
          channel: "whatsapp",
          recipientType: "driver",
          title: "Trip Assignment Sent",
          message: message,
          status: "sent",
          sentAt: new Date(),
        },
      });

      return c.json({
        success: true,
        messageId: result.id,
        template: "trip_assignment",
        to: phoneNumber,
      });
    } catch (error) {
      console.error("Template send error:", error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send",
      }, 500);
    }
  }
);

/**
 * POST /whatsapp/template/invoice-reminder - Send invoice reminder
 * Direct WhatsApp message using pre-defined template (no AI)
 */
whatsapp.post(
  "/template/invoice-reminder",
  zValidator("json", invoiceTemplateSchema),
  async (c) => {
    try {
      const { phoneNumber, organizationId, data } = c.req.valid("json");

      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json({ success: false, error: "WhatsApp not connected" }, 503);
      }

      const message = invoiceReminderTemplate(data as InvoiceMessageData);
      const result = await client.sendMessage(phoneNumber, message);

      await db.notification.create({
        data: {
          type: "invoice_reminder",
          channel: "whatsapp",
          recipientType: "customer",
          title: "Invoice Reminder Sent",
          message: message,
          status: "sent",
          sentAt: new Date(),
        },
      });

      return c.json({
        success: true,
        messageId: result.id,
        template: "invoice_reminder",
        to: phoneNumber,
      });
    } catch (error) {
      console.error("Template send error:", error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send",
      }, 500);
    }
  }
);

/**
 * POST /whatsapp/template/trip-status - Send trip status update to customer
 * Direct WhatsApp message using pre-defined template (no AI)
 */
whatsapp.post(
  "/template/trip-status",
  zValidator("json", tripStatusTemplateSchema),
  async (c) => {
    try {
      const { phoneNumber, organizationId, data } = c.req.valid("json");

      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json({ success: false, error: "WhatsApp not connected" }, 503);
      }

      const message = tripStatusTemplate(data as TripStatusMessageData);
      const result = await client.sendMessage(phoneNumber, message);

      await db.notification.create({
        data: {
          type: "trip_status",
          channel: "whatsapp",
          recipientType: "customer",
          title: "Trip Status Update Sent",
          message: message,
          status: "sent",
          sentAt: new Date(),
        },
      });

      return c.json({
        success: true,
        messageId: result.id,
        template: "trip_status",
        to: phoneNumber,
      });
    } catch (error) {
      console.error("Template send error:", error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send",
      }, 500);
    }
  }
);

/**
 * POST /whatsapp/template/delivery-confirmation - Send delivery confirmation
 * Direct WhatsApp message using pre-defined template (no AI)
 */
whatsapp.post(
  "/template/delivery-confirmation",
  zValidator("json", deliveryTemplateSchema),
  async (c) => {
    try {
      const { phoneNumber, organizationId, data } = c.req.valid("json");

      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json({ success: false, error: "WhatsApp not connected" }, 503);
      }

      const message = deliveryConfirmationTemplate(data as DeliveryConfirmationData);
      const result = await client.sendMessage(phoneNumber, message);

      await db.notification.create({
        data: {
          type: "delivery_confirmation",
          channel: "whatsapp",
          recipientType: "customer",
          title: "Delivery Confirmation Sent",
          message: message,
          status: "sent",
          sentAt: new Date(),
        },
      });

      return c.json({
        success: true,
        messageId: result.id,
        template: "delivery_confirmation",
        to: phoneNumber,
      });
    } catch (error) {
      console.error("Template send error:", error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send",
      }, 500);
    }
  }
);

/**
 * POST /whatsapp/template/payment-received - Send payment confirmation
 * Direct WhatsApp message using pre-defined template (no AI)
 */
whatsapp.post(
  "/template/payment-received",
  zValidator("json", paymentTemplateSchema),
  async (c) => {
    try {
      const { phoneNumber, organizationId, data } = c.req.valid("json");

      const client = getAgentWhatsAppClient();
      if (!client.isConnected()) {
        return c.json({ success: false, error: "WhatsApp not connected" }, 503);
      }

      const message = paymentReceivedTemplate(data);
      const result = await client.sendMessage(phoneNumber, message);

      await db.notification.create({
        data: {
          type: "payment_received",
          channel: "whatsapp",
          recipientType: "customer",
          title: "Payment Confirmation Sent",
          message: message,
          status: "sent",
          sentAt: new Date(),
        },
      });

      return c.json({
        success: true,
        messageId: result.id,
        template: "payment_received",
        to: phoneNumber,
      });
    } catch (error) {
      console.error("Template send error:", error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send",
      }, 500);
    }
  }
);

/**
 * GET /whatsapp/health - Health check
 */
whatsapp.get("/health", (c) => {
  const client = getAgentWhatsAppClient();
  const state = client.getState();
  const memoryManager = getMemoryManager();
  const stats = memoryManager.getStats();

  return c.json({
    status: "healthy",
    whatsapp: {
      connected: state.status === "ready",
      status: state.status,
      messagesSent: state.messagesSent,
      queuedMessages: client.getQueueLength(),
    },
    memory: stats,
  });
});

export default whatsapp;
