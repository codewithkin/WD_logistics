/**
 * API Route: Send Invoice Payment Reminder
 * 
 * POST /api/notifications/invoice-reminder
 * 
 * Triggers the agent to send a WhatsApp payment reminder
 * to a customer for a specific invoice.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated and has permission
    const user = await requireRole(["admin", "supervisor"]);
    
    const body = await request.json();
    const { invoiceId, sendImmediately = false } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: "invoiceId is required" },
        { status: 400 }
      );
    }

    // Call the agent webhook
    const response = await fetch(`${AGENT_URL}/webhooks/invoice-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoiceId,
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
    console.error("Invoice reminder error:", error);
    
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
        error: error instanceof Error ? error.message : "Failed to send reminder" 
      },
      { status: 500 }
    );
  }
}
