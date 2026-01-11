"use server";

import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface ExpenseFormData {
  categoryId: string;
  amount: number;
  description?: string;
  date: Date;
  vendor?: string;
  reference?: string;
  notes?: string;
  receiptUrl?: string;
  truckIds?: string[];
  tripIds?: string[];
}

export async function createExpense(data: ExpenseFormData) {
  const user = await requireRole(["admin", "supervisor", "staff"]);

  const expense = await prisma.expense.create({
    data: {
      organizationId: user.organizationId,
      categoryId: data.categoryId,
      amount: data.amount,
      description: data.description,
      date: data.date,
      vendor: data.vendor,
      reference: data.reference,
      notes: data.notes,
      receiptUrl: data.receiptUrl,
      truckExpenses: data.truckIds?.length
        ? {
            create: data.truckIds.map((truckId) => ({ truckId })),
          }
        : undefined,
      tripExpenses: data.tripIds?.length
        ? {
            create: data.tripIds.map((tripId) => ({ tripId })),
          }
        : undefined,
    },
  });

  revalidatePath("/finance/expenses");
  redirect("/finance/expenses");
}

export async function updateExpense(id: string, data: ExpenseFormData) {
  const user = await requireRole(["admin", "supervisor", "staff"]);

  // Verify ownership
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error("Expense not found");
  }

  await prisma.$transaction(async (tx) => {
    // Update the expense
    await tx.expense.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        amount: data.amount,
        description: data.description,
        date: data.date,
        vendor: data.vendor,
        reference: data.reference,
        notes: data.notes,
        receiptUrl: data.receiptUrl,
      },
    });

    // Update truck associations
    if (data.truckIds !== undefined) {
      await tx.truckExpense.deleteMany({ where: { expenseId: id } });
      if (data.truckIds.length > 0) {
        await tx.truckExpense.createMany({
          data: data.truckIds.map((truckId) => ({ truckId, expenseId: id })),
        });
      }
    }

    // Update trip associations
    if (data.tripIds !== undefined) {
      await tx.tripExpense.deleteMany({ where: { expenseId: id } });
      if (data.tripIds.length > 0) {
        await tx.tripExpense.createMany({
          data: data.tripIds.map((tripId) => ({ tripId, expenseId: id })),
        });
      }
    }
  });

  revalidatePath("/finance/expenses");
  revalidatePath(`/finance/expenses/${id}`);
  redirect("/finance/expenses");
}

export async function deleteExpense(id: string) {
  const user = await requireRole(["admin", "supervisor"]);

  // Verify ownership
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error("Expense not found");
  }

  await prisma.expense.delete({
    where: { id },
  });

  revalidatePath("/finance/expenses");
}
