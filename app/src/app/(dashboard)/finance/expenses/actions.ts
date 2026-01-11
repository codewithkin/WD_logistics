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

export async function getExpensesForCharts(days: number = 30) {
  const user = await requireRole(["admin", "supervisor"]);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const expenses = await prisma.expense.findMany({
    where: {
      organizationId: user.organizationId,
      date: {
        gte: startDate,
      },
    },
    include: {
      category: {
        select: {
          name: true,
          color: true,
        },
      },
      truckExpenses: {
        include: {
          truck: {
            select: {
              registrationNo: true,
            },
          },
        },
      },
      tripExpenses: {
        include: {
          trip: {
            select: {
              originCity: true,
              destinationCity: true,
            },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Aggregate by category
  const categoryMap = new Map<string, { amount: number; count: number; color: string }>();
  expenses.forEach((expense) => {
    const existing = categoryMap.get(expense.category.name) || { amount: 0, count: 0, color: expense.category.color || "#71717a" };
    categoryMap.set(expense.category.name, {
      amount: existing.amount + expense.amount,
      count: existing.count + 1,
      color: expense.category.color || "#71717a",
    });
  });

  // Aggregate by truck
  const truckMap = new Map<string, number>();
  expenses.forEach((expense) => {
    expense.truckExpenses.forEach((te) => {
      const current = truckMap.get(te.truck.registrationNo) || 0;
      truckMap.set(te.truck.registrationNo, current + expense.amount);
    });
  });

  // Aggregate by trip
  const tripMap = new Map<string, number>();
  expenses.forEach((expense) => {
    expense.tripExpenses.forEach((te) => {
      const key = `${te.trip.originCity}→${te.trip.destinationCity}`;
      const current = tripMap.get(key) || 0;
      tripMap.set(key, current + expense.amount);
    });
  });

  // Aggregate by month
  const monthMap = new Map<string, number>();
  expenses.forEach((expense) => {
    const month = new Date(expense.date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const current = monthMap.get(month) || 0;
    monthMap.set(month, current + expense.amount);
  });

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    byCategory: Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, amount: data.amount, count: data.count, color: data.color }))
      .sort((a, b) => b.amount - a.amount),
    byTruck: Array.from(truckMap.entries())
      .map(([truck, amount]) => ({ truck, amount }))
      .sort((a, b) => b.amount - a.amount),
    byTrip: Array.from(tripMap.entries())
      .map(([trip, amount]) => ({ trip, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMonth: Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()),
    total,
  };
}

