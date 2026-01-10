/**
 * AI Agent client for communicating with the Hono agent API
 */

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  response?: {
    content: string;
    toolCalls?: Array<{
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  error?: string;
}

export interface StreamChunk {
  type: "text" | "done" | "error";
  content?: string;
  error?: string;
}

/**
 * Send a chat message to the AI agent (non-streaming)
 */
export async function sendChatMessage(
  message: string,
  organizationId: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const response = await fetch(`${AGENT_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      organizationId,
      conversationHistory,
    }),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Send a chat message with streaming response
 */
export async function streamChatMessage(
  message: string,
  organizationId: string,
  conversationHistory: ChatMessage[] = [],
  onChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const response = await fetch(`${AGENT_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      organizationId,
      conversationHistory,
    }),
  });

  if (!response.ok) {
    throw new Error(`Agent stream request failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          onChunk(data as StreamChunk);
        } catch {
          // Ignore parse errors
        }
      }
    }
  }
}

/**
 * Trigger a workflow on the agent
 */
export async function triggerWorkflow(
  workflow: "trip-notifications" | "invoice-reminders" | "daily-summary" | "license-expiry-check" | "run-all",
  organizationId: string,
  options: Record<string, unknown> = {}
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  const response = await fetch(`${AGENT_URL}/workflows/${workflow}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Workflow request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check agent health
 */
export async function checkAgentHealth(): Promise<{ status: string; agent?: string; tools?: number }> {
  try {
    const response = await fetch(`${AGENT_URL}/chat/health`);
    if (!response.ok) {
      return { status: "unhealthy" };
    }
    return response.json();
  } catch {
    return { status: "offline" };
  }
}
