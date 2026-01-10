import { NextResponse } from "next/server";
import { getWhatsAppService } from "@/lib/whatsapp";
import { requireRole } from "@/lib/session";

/**
 * GET /api/whatsapp/status
 * Get current WhatsApp connection status
 */
export async function GET() {
  try {
    await requireRole(["admin"]);
    
    const whatsapp = getWhatsAppService();
    const state = whatsapp.getState();

    return NextResponse.json({
      success: true,
      ...state,
    });
  } catch (error) {
    console.error("WhatsApp status error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to get status" 
      },
      { status: 500 }
    );
  }
}
