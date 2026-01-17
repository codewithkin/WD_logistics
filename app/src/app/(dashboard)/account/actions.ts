"use server";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function changePassword(data: {
    currentPassword: string;
    newPassword: string;
}) {
    const session = await requireAuth();

    try {
        // Get the user's account with the current password
        const account = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
                providerId: "credential",
            },
        });

        if (!account || !account.password) {
            return { success: false, error: "Account not found or no password set" };
        }

        // Verify the current password
        const isValid = await verifyPassword({
            hash: account.password,
            password: data.currentPassword,
        });

        if (!isValid) {
            return { success: false, error: "Current password is incorrect" };
        }

        // Hash the new password
        const hashedPassword = await hashPassword(data.newPassword);

        // Update the password
        await prisma.account.update({
            where: { id: account.id },
            data: { password: hashedPassword },
        });

        return { success: true, message: "Password changed successfully" };
    } catch (error) {
        console.error("Failed to change password:", error);
        return { success: false, error: "Failed to change password" };
    }
}
