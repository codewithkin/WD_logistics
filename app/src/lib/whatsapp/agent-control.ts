export const AGENT_WHATSAPP_SESSION_NAME = "agent-whatsapp";

type AgentLogoutResponse = {
  success?: boolean;
  status?: string;
  toldWhatsApp?: boolean;
  message?: string;
};

/**
 * Ask the agent process to unlink WhatsApp and clear its persisted session.
 *
 * A data reset must not proceed when the live agent cannot confirm logout:
 * deleting the Postgres row alone is insufficient because the running agent
 * can recreate it on its next RemoteAuth backup cycle.
 */
export async function revokeAgentWhatsAppPairing(
  organizationId: string,
): Promise<
  | { success: true; toldWhatsApp: boolean; message: string | null }
  | { success: false; error: string }
> {
  const agentUrl = (process.env.AGENT_URL || process.env.NEXT_PUBLIC_AGENT_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = process.env.AGENT_API_KEY;

  if (!agentUrl || !apiKey) {
    return {
      success: false,
      error: "The WhatsApp agent is not configured, so its pairing cannot be safely revoked. No data was reset.",
    };
  }

  try {
    const response = await fetch(`${agentUrl}/whatsapp/disconnect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ organizationId }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => null)) as AgentLogoutResponse | null;

    if (!response.ok || body?.success !== true || body.status !== "disconnected") {
      return {
        success: false,
        error: "The WhatsApp agent could not confirm logout. No data was reset; check the agent and try again.",
      };
    }

    return {
      success: true,
      toldWhatsApp: body.toldWhatsApp === true,
      message: typeof body.message === "string" ? body.message : null,
    };
  } catch {
    return {
      success: false,
      error: "The WhatsApp agent could not be reached to revoke its pairing. No data was reset.",
    };
  }
}
