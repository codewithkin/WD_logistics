import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { logisticsAgent } from "../agents/logistics-agent";

const chat = new Hono();

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1).describe("The user's message"),
  organizationId: z.string().describe("The organization ID for context"),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .describe("Previous messages in the conversation"),
});

/**
 * POST /chat - Non-streaming chat endpoint
 * Returns the complete response after processing
 */
chat.post("/", zValidator("json", chatRequestSchema), async (c) => {
  try {
    const { message, organizationId, conversationHistory = [] } = c.req.valid("json");

    // Build messages array with conversation history
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: `[Organization ID: ${organizationId}]\n\n${message}`,
      },
    ];

    // Generate response from the agent
    const response = await logisticsAgent.generate(messages);

    return c.json({
      success: true,
      response: {
        content: response.text,
        toolCalls: response.toolCalls?.map((tc) => ({
          name: tc.toolName,
          args: tc.args,
        })),
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      },
      500
    );
  }
});

/**
 * POST /chat/stream - Streaming chat endpoint
 * Returns the response as a stream of SSE events
 */
chat.post("/stream", zValidator("json", chatRequestSchema), async (c) => {
  const { message, organizationId, conversationHistory = [] } = c.req.valid("json");

  // Build messages array with conversation history
  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    {
      role: "user" as const,
      content: `[Organization ID: ${organizationId}]\n\n${message}`,
    },
  ];

  return streamSSE(c, async (stream) => {
    try {
      // Stream response from the agent
      const response = await logisticsAgent.stream(messages);

      for await (const chunk of response.textStream) {
        await stream.writeSSE({
          event: "message",
          data: JSON.stringify({ type: "text", content: chunk }),
        });
      }

      // Send completion event
      await stream.writeSSE({
        event: "message",
        data: JSON.stringify({ type: "done" }),
      });
    } catch (error) {
      console.error("Stream error:", error);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "An error occurred",
        }),
      });
    }
  });
});

/**
 * GET /chat/health - Health check for chat service
 */
chat.get("/health", (c) => {
  return c.json({
    status: "healthy",
    agent: "logistics-agent",
    tools: Object.keys(logisticsAgent.tools || {}).length,
  });
});

export default chat;
