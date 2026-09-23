/**
 * Delivery receipts from the agent's WhatsApp session.
 *
 * whatsapp-web.js raises `message_ack` when a message reaches the recipient's
 * device (ack 2) and again when they open it (ack 3). The agent has the
 * session; the app has the database. This is how one tells the other, over
 * the same action-dispatch protocol and shared secret as every other
 * app↔agent call.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/agent-auth";
import { applyDeliveryAck, getTripMessages } from "@/lib/whatsapp/trip-messages";

export async function POST(request: NextRequest) {
  // Same guard as every other agent route: returns a response when the
  // shared secret is wrong, null when the call may proceed.
  const denied = withAgentAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const action: string | undefined = body?.action;

  switch (action) {
    case "ack": {
      const waMessageId: string | undefined = body?.waMessageId;
      const ack: number | undefined = body?.ack;

      if (!waMessageId || typeof ack !== "number") {
        return NextResponse.json(
          { success: false, error: "waMessageId and ack are required" },
          { status: 400 },
        );
      }

      const result = await applyDeliveryAck(waMessageId, ack);
      return NextResponse.json({ success: true, data: result });
    }

    case "listForTrip": {
      const tripId: string | undefined = body?.tripId;
      if (!tripId) {
        return NextResponse.json(
          { success: false, error: "tripId is required" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        success: true,
        data: await getTripMessages(tripId),
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
  }
}
