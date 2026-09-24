/**
 * The agent's connection to the app's assistant endpoint.
 *
 * Everything the assistant can do lives in the app (`lib/assistant/*`),
 * because that is where the database and the business rules are. This is the
 * thin client: identify a caller, fetch the operations they are allowed, run
 * one, and write the transcript back.
 *
 * Deliberately narrow. The agent never decides what anyone may do — it asks,
 * and the app answers. A model that hallucinated a tool name or a role gets a
 * refusal from the server, not a surprise.
 */

const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "";

export type AssistantRole = "readonly" | "staff" | "supervisor" | "admin";

export interface AssistantIdentity {
  authorized: boolean;
  name?: string;
  role?: AssistantRole;
  organizationName?: string;
}

export interface ToolManifestEntry {
  name: string;
  description: string;
  writes: boolean;
  /** JSON Schema for the arguments, produced from the app's Zod schema. */
  schema: Record<string, unknown>;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  writes?: boolean;
}

async function call<T>(body: Record<string, unknown>): Promise<Envelope<T>> {
  try {
    const response = await fetch(`${WEB_APP_URL}/api/agent/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": AGENT_API_KEY,
        // The app resolves the real organisation from the contact; this only
        // satisfies the shared header contract.
        "x-organization-id": process.env.AGENT_ORGANIZATION_ID || "unknown",
      },
      body: JSON.stringify(body),
      // A hung app must not leave a WhatsApp conversation silent forever.
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        error: `The system returned ${response.status}. ${text}`.trim(),
      };
    }

    return (await response.json()) as Envelope<T>;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error && error.name === "TimeoutError"
          ? "The system took too long to answer."
          : "Could not reach the system.",
    };
  }
}

/** Who is this, and may they use the assistant at all? */
export async function identify(phone: string): Promise<AssistantIdentity> {
  const result = await call<AssistantIdentity>({ action: "identify", phone });
  return result.data ?? { authorized: false };
}

/** The operations this caller is allowed, as tool definitions. */
export async function fetchManifest(phone: string): Promise<{
  authorized: boolean;
  name?: string;
  role?: AssistantRole;
  tools: ToolManifestEntry[];
}> {
  const result = await call<{
    authorized: boolean;
    name?: string;
    role?: AssistantRole;
    tools: ToolManifestEntry[];
  }>({ action: "manifest", phone });

  // The app answers an unknown number with `{ authorized: false }` and no
  // tools key at all, so `?? {}` is not enough — the nullish coalescing sees
  // a truthy object and leaves `tools` undefined. Normalising here is what
  // stops a stranger's message crashing the agent.
  const data = result.data;
  return {
    authorized: data?.authorized ?? false,
    name: data?.name,
    role: data?.role,
    tools: data?.tools ?? [],
  };
}

/** Runs one operation as this caller. */
export async function invoke(
  phone: string,
  operation: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; data?: unknown; error?: string; writes?: boolean }> {
  return call<unknown>({ action: "invoke", phone, operation, args });
}

/** Writes an exchange to the transcript, which is also the audit trail. */
export async function logExchange(params: {
  phone: string;
  direction: "inbound" | "outbound";
  body: string;
  toolCalls?: unknown;
  didWrite?: boolean;
  error?: string;
}): Promise<void> {
  await call({
    action: "log",
    phone: params.phone,
    direction: params.direction,
    body: params.body,
    toolCalls: params.toolCalls,
    didWrite: params.didWrite,
    error: params.error,
  }).catch(() => {
    // A lost transcript entry must never swallow the reply itself.
  });
}
