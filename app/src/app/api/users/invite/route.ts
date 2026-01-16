import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { notifyUserInvited } from "@/lib/notifications";
import { Role } from "@/lib/types";
import { generateRandomPassword, sendUserCredentials } from "@/lib/email";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Verify admin role
    let session;
    try {
      session = await requireRole(["admin"]);
    } catch (error) {
      console.error("Auth error in invite route:", error);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    const { email, role, name } = body as { email: string; role: Role; name?: string };

    if (!email || !role) {
      return NextResponse.json(
        { success: false, error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    let isNewUser = false;
    let generatedPassword: string | null = null;

    if (!user) {
      // User doesn't exist - create them with generated credentials
      isNewUser = true;
      generatedPassword = generateRandomPassword(12);
      
      // Create user using better-auth's internal method
      const ctx = await auth.$context;
      const hashedPassword = await ctx.password.hash(generatedPassword);

      // Create the user in the database
      user = await prisma.user.create({
        data: {
          name: name || email.split("@")[0], // Use provided name or derive from email
          email: email,
          emailVerified: true, // Pre-verified since admin is creating
        },
      });

      // Create the account (password credential)
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
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

    // Send credentials email if new user was created
    if (isNewUser && generatedPassword) {
      const emailResult = await sendUserCredentials(email, generatedPassword, role);
      
      if (!emailResult.success) {
        console.warn("User created but email failed to send");
        // Return success with warning and credentials for manual sharing
        revalidatePath("/users");
        return NextResponse.json({ 
          success: true, 
          member,
          warning: "User created but email failed to send. Please share credentials manually.",
          credentials: { email, password: generatedPassword }
        });
      }
    }

    // Send admin notification
    notifyUserInvited(
      { email, role },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/users");
    
    return NextResponse.json({ 
      success: true, 
      member,
      message: isNewUser 
        ? "User created and credentials sent to their email" 
        : "User added to organization"
    });
  } catch (error) {
    console.error("Failed to invite user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
