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
import { prisma } from "@/lib/prisma";

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

    // The assistant records a message before the agent tries to send it, so
    // that a failure leaves a trace rather than nothing. These two close the
    // loop once the agent knows what happened.
    case "markSent": {
      const id: string | undefined = body?.notificationId;
      if (!id) {
        return NextResponse.json(
          { success: false, error: "notificationId is required" },
          { status: 400 },
        );
      }
      await prisma.notification.updateMany({
        where: { id },
        data: {
          status: "sent",
          sentAt: new Date(),
          ...(body?.waMessageId ? { waMessageId: String(body.waMessageId) } : {}),
        },
      });
      return NextResponse.json({ success: true });
    }

    case "markFailed": {
      const id: string | undefined = body?.notificationId;
      if (!id) {
        return NextResponse.json(
          { success: false, error: "notificationId is required" },
          { status: 400 },
        );
      }
      await prisma.notification.updateMany({
        where: { id },
        data: {
          status: "failed",
          error: body?.error ? String(body.error).slice(0, 500) : "Unknown error",
        },
      });
      return NextResponse.json({ success: true });
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
