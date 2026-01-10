import { NextResponse } from "next/server";
import { getWhatsAppService } from "@/lib/whatsapp";
import { requireRole } from "@/lib/session";

/**
 * POST /api/whatsapp/initialize
 * Initialize WhatsApp client and start authentication
 */
export async function POST() {
  try {
    await requireRole(["admin"]);
    
    const whatsapp = getWhatsAppService();
    const currentState = whatsapp.getState();

    // Already initializing or ready
    if (currentState.status === "connecting" || currentState.status === "ready") {
      return NextResponse.json({
        success: true,
        message: "WhatsApp is already " + currentState.status,
        ...currentState,
      });
    }

    // Start initialization (non-blocking)
    whatsapp.initialize().catch((error) => {
      console.error("WhatsApp initialization failed:", error);
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp initialization started",
      status: "connecting",
    });
  } catch (error) {
    console.error("WhatsApp initialize error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to initialize" 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/whatsapp/initialize
 * Disconnect WhatsApp client
 */
export async function DELETE() {
  try {
    await requireRole(["admin"]);
    
    const whatsapp = getWhatsAppService();
    await whatsapp.disconnect();

    return NextResponse.json({
      success: true,
      message: "WhatsApp disconnected",
      status: "disconnected",
    });
  } catch (error) {
    console.error("WhatsApp disconnect error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to disconnect" 
      },
      { status: 500 }
    );
  }
}
