import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";

/**
 * Pushes a test notification to the caller and nobody else.
 *
 * Real events deliberately exclude whoever performed them, which meant the
 * only way to check your own setup was to ask a colleague to do something.
 * This closes that gap: if nothing arrives, the response says why.
 */
export async function POST() {
  const session = await requireAuth();

  const result = await sendPushToUser(session.user.id, {
    title: "WD Logistics",
    body: "Test notification — if you can read this, push is working on this device.",
    url: "/notifications",
    tag: "push-test",
    category: "test",
    organizationId: session.organizationId,
  });

  if (result.skipped) {
    return NextResponse.json({ success: false, error: result.skipped });
  }

  if (result.sent === 0) {
    return NextResponse.json({
      success: false,
      error:
        result.failed > 0
          ? "Every device rejected the notification. Open Notification history below for the reason."
          : "No devices were subscribed for this account.",
    });
  }

  return NextResponse.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
  });
}
