"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function updateOrganizationSettings(data: {
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  timezone?: string;
}) {
  const session = await requireRole(["admin"]);

  try {
    const metadata = JSON.stringify({
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      currency: data.currency || "USD",
      timezone: data.timezone || "UTC",
    });

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        name: data.name,
        logo: data.logo,
        metadata,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to update settings:", error);
    return { success: false, error: "Failed to update settings" };
  }
}

export async function createExpenseCategory(data: {
  name: string;
  description?: string;
  isTrip?: boolean;
  isTruck?: boolean;
  color?: string;
}) {
  const session = await requireRole(["admin"]);

  try {
    const category = await prisma.expenseCategory.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/settings");
    return { success: true, category };
  } catch (error) {
    console.error("Failed to create category:", error);
    return { success: false, error: "Failed to create expense category" };
  }
}

export async function deleteExpenseCategory(id: string) {
  const session = await requireRole(["admin"]);

  try {
    // Check if category has expenses
    const category = await prisma.expenseCategory.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { _count: { select: { expenses: true } } },
    });

    if (!category) {
      return { success: false, error: "Category not found" };
    }

    if (category._count.expenses > 0) {
      return { success: false, error: "Cannot delete category with associated expenses" };
    }

    await prisma.expenseCategory.delete({ where: { id } });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete category:", error);
    return { success: false, error: "Failed to delete expense category" };
  }
}
