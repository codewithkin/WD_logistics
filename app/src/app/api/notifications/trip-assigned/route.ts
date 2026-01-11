/**
 * API Route: Send Trip Assignment Notification
 * 
 * POST /api/notifications/trip-assigned
 * 
 * Triggers the agent to send a WhatsApp notification to a driver
 * when they are assigned to a trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has permission
    const user = await requireRole(["admin", "supervisor", "staff"]);
    
    const body = await request.json();
    const { tripId, sendImmediately = false } = body;

    if (!tripId) {
      return NextResponse.json(
        { success: false, error: "tripId is required" },
        { status: 400 }
      );
    }

    // Call the agent webhook
    const response = await fetch(`${AGENT_URL}/webhooks/trip-assigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripId,
        organizationId: user.organizationId,
        sendImmediately,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trip notification error:", error);
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to send notification" 
      },
      { status: 500 }
    );
  }
}
