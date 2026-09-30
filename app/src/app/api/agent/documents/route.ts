import { NextRequest } from "next/server";
import {
  withAgentAuth,
  getOrganizationId,
  agentJsonResponse,
  agentErrorResponse,
  handleCorsPreflightRequest,
} from "@/lib/agent-auth";
import { stashDocument } from "@/lib/documents/handoff";

/**
 * Somewhere to put a document WhatsApp would not carry.
 *
 * The agent tries to send a generated report as a WhatsApp document first,
 * because a file in the chat is what was asked for. whatsapp-web.js pushes the
 * whole thing through the browser it drives, so that fails on anything large
 * and sometimes on anything at all — and the report has already been produced
 * by then. Rather than apologise, the agent parks it here and sends the link
 * it gets back.
 *
 * Action-dispatch on `action`, like every other endpoint in this folder.
 */
export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

export async function POST(request: NextRequest) {
  const authError = withAgentAuth(request);
  if (authError) return authError;

  const organizationId = getOrganizationId(request);
  if (!organizationId) {
    return agentErrorResponse("Organization ID required", 400);
  }

  try {
    const body = await request.json();
    const { action, ...params } = body as {
      action?: string;
      filename?: string;
      mimeType?: string;
      base64?: string;
      phone?: string;
      ttlHours?: number;
    };

    switch (action) {
      case "stash": {
        if (!params.base64 || !params.filename || !params.mimeType) {
          return agentErrorResponse("filename, mimeType and base64 are required", 400);
        }
        const stashed = await stashDocument({
          organizationId,
          filename: params.filename,
          mimeType: params.mimeType,
          base64: params.base64,
          forPhone: params.phone ?? null,
          ttlHours: params.ttlHours,
        });
        return agentJsonResponse({
          url: stashed.url,
          filename: stashed.filename,
          sizeKb: stashed.sizeKb,
          expiresAt: stashed.expiresAt.toISOString(),
        });
      }
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("[agent/documents]", error);
    return agentErrorResponse("Could not park that document", 500);
  }
}
