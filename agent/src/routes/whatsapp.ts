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
