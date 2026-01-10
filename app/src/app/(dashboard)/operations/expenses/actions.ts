"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function createExpense(data: {
  description: string;
  amount: number;
  date: Date;
  tripId: string;
  categoryId?: string | null;
  receiptUrl?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const trip = await prisma.trip.findFirst({
      where: { id: data.tripId, organizationId: session.organizationId },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    const expense = await prisma.tripExpense.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/operations/expenses");
    revalidatePath(`/operations/trips/${data.tripId}`);
    return { success: true, expense };
  } catch (error) {
    console.error("Failed to create expense:", error);
    return { success: false, error: "Failed to create expense" };
  }
}

export async function updateExpense(
  id: string,
  data: {
    description?: string;
    amount?: number;
    date?: Date;
    tripId?: string;
    categoryId?: string | null;
    receiptUrl?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const expense = await prisma.tripExpense.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    const updatedExpense = await prisma.tripExpense.update({
      where: { id },
      data,
    });

    revalidatePath("/operations/expenses");
    revalidatePath(`/operations/trips/${expense.tripId}`);
    if (data.tripId && data.tripId !== expense.tripId) {
      revalidatePath(`/operations/trips/${data.tripId}`);
    }
    return { success: true, expense: updatedExpense };
  } catch (error) {
    console.error("Failed to update expense:", error);
    return { success: false, error: "Failed to update expense" };
  }
}

export async function deleteExpense(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const expense = await prisma.tripExpense.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    await prisma.tripExpense.delete({ where: { id } });

    revalidatePath("/operations/expenses");
    revalidatePath(`/operations/trips/${expense.tripId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return { success: false, error: "Failed to delete expense" };
  }
}
