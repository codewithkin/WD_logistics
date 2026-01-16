import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { notifyUserInvited } from "@/lib/notifications";
import { Role } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const session = await requireRole(["admin"]);
    const body = await request.json();
    
    const { email, role } = body as { email: string; role: Role };

    if (!email || !role) {
      return NextResponse.json(
        { success: false, error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found. They must create an account first.",
        },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.member.findFirst({
      where: {
        userId: user.id,
        organizationId: session.organizationId,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: "User is already a member of this organization" },
        { status: 409 }
      );
    }

    const member = await prisma.member.create({
      data: {
        userId: user.id,
        organizationId: session.organizationId,
        role,
      },
    });

    // Send admin notification
    notifyUserInvited(
      { email, role },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/users");
    
    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error("Failed to invite user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
