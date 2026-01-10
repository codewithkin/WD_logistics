import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWhatsAppService } from "@/lib/whatsapp";
import { requireRole } from "@/lib/session";

const sendMessageSchema = z.object({
  phoneNumber: z.string().min(10).describe("Phone number to send to"),
  message: z.string().min(1).describe("Message content"),
});

/**
 * POST /api/whatsapp/send
 * Send a WhatsApp message
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(["admin", "supervisor"]);
    
    const body = await request.json();
    const { phoneNumber, message } = sendMessageSchema.parse(body);

    const whatsapp = getWhatsAppService();
    const result = await whatsapp.sendMessage(phoneNumber, message);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("WhatsApp send error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid request format",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to send message" 
      },
      { status: 500 }
    );
  }
}
