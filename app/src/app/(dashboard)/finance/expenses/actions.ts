"use server";

import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateExpenseReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyExpenseCreated, notifyExpenseUpdated, notifyExpenseDeleted } from "@/lib/notifications";

export interface ExpenseFormData {
  categoryId: string;
  amount: number;
  date: Date;
  notes?: string;
  truckIds?: string[];
  tripIds?: string[];
  driverIds?: string[];
  isBusinessExpense?: boolean;
  supplierId?: string;
}

export async function createExpense(data: ExpenseFormData) {
  const user = await requireRole(["admin", "supervisor", "staff"]);

  // Get category name for notification
  const category = await prisma.expenseCategory.findUnique({
    where: { id: data.categoryId },
    select: { name: true },
  });

  const expense = await prisma.expense.create({
    data: {
      organizationId: user.organizationId,
      categoryId: data.categoryId,
      amount: data.amount,
      date: data.date,
      notes: data.notes,
      isBusinessExpense: data.isBusinessExpense || false,
      supplierId: data.isBusinessExpense ? data.supplierId : undefined,
      truckExpenses: !data.isBusinessExpense && data.truckIds?.length
        ? {
            create: data.truckIds.map((truckId) => ({ truckId })),
          }
        : undefined,
      tripExpenses: !data.isBusinessExpense && data.tripIds?.length
        ? {
            create: data.tripIds.map((tripId) => ({ tripId })),
          }
        : undefined,
      driverExpenses: !data.isBusinessExpense && data.driverIds?.length
        ? {
            create: data.driverIds.map((driverId) => ({ driverId })),
          }
        : undefined,
    },
  });

  // Update supplier balance if business expense with supplier
  if (data.isBusinessExpense && data.supplierId) {
    await prisma.supplier.update({
      where: { id: data.supplierId },
      data: {
        balance: {
          increment: data.amount,
        },
      },
    });
  }

  // Send admin notification
  notifyExpenseCreated(
    {
      id: expense.id,
      description: data.notes || category?.name || "Expense",
      category: category?.name || "Unknown",
      amount: data.amount,
      date: data.date,
    },
    user.organizationId,
    { name: user.user.name, email: user.user.email, role: user.role }
  ).catch((err) => console.error("Failed to send admin notification:", err));

  revalidatePath("/finance/expenses");
  if (data.supplierId) {
    revalidatePath(`/suppliers/${data.supplierId}`);
  }
  redirect("/finance/expenses");
}

export async function updateExpense(id: string, data: ExpenseFormData) {
  const user = await requireRole(["admin", "supervisor", "staff"]);

  // Verify ownership and get old data for supplier balance adjustment
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { 
      organizationId: true, 
      amount: true, 
      isBusinessExpense: true, 
      supplierId: true,
      isPaid: true,
    },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error("Expense not found");
  }

  // Get category name for notification
  const category = await prisma.expenseCategory.findUnique({
    where: { id: data.categoryId },
    select: { name: true },
  });

  await prisma.$transaction(async (tx) => {
    // Handle supplier balance changes for unpaid expenses
    if (!existing.isPaid) {
      // If expense was linked to a supplier, decrement old supplier balance
      if (existing.isBusinessExpense && existing.supplierId) {
        await tx.supplier.update({
          where: { id: existing.supplierId },
          data: { balance: { decrement: existing.amount } },
        });
      }
      
      // If expense is now linked to a supplier, increment new supplier balance
      if (data.isBusinessExpense && data.supplierId) {
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: { balance: { increment: data.amount } },
        });
      }
    }

    // Update the expense
    await tx.expense.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        amount: data.amount,
        date: data.date,
        notes: data.notes,
        isBusinessExpense: data.isBusinessExpense || false,
        supplierId: data.isBusinessExpense ? data.supplierId : null,
      },
    });

    // Clear associations if now a business expense
    if (data.isBusinessExpense) {
      await tx.truckExpense.deleteMany({ where: { expenseId: id } });
      await tx.tripExpense.deleteMany({ where: { expenseId: id } });
      await tx.driverExpense.deleteMany({ where: { expenseId: id } });
    } else {
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

      // Update driver associations
      if (data.driverIds !== undefined) {
        await tx.driverExpense.deleteMany({ where: { expenseId: id } });
        if (data.driverIds.length > 0) {
          await tx.driverExpense.createMany({
            data: data.driverIds.map((driverId) => ({ driverId, expenseId: id })),
          });
        }
      }
    }
  });

  // Send admin notification
  notifyExpenseUpdated(
    {
      id,
      description: data.notes || category?.name || "Expense",
      category: category?.name || "Unknown",
      amount: data.amount,
      date: data.date,
    },
    user.organizationId,
    { name: user.user.name, email: user.user.email, role: user.role }
  ).catch((err) => console.error("Failed to send admin notification:", err));

  revalidatePath("/finance/expenses");
  revalidatePath(`/finance/expenses/${id}`);
  if (existing.supplierId) {
    revalidatePath(`/suppliers/${existing.supplierId}`);
  }
  if (data.supplierId) {
    revalidatePath(`/suppliers/${data.supplierId}`);
  }
  redirect("/finance/expenses");
}

export async function deleteExpense(id: string) {
  const user = await requireRole(["admin", "supervisor"]);

  // Verify ownership and get details for notification and supplier balance
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { 
      organizationId: true,
      notes: true,
      amount: true,
      isBusinessExpense: true,
      supplierId: true,
      isPaid: true,
      category: { select: { name: true } },
    },
  });

  if (!existing || existing.organizationId !== user.organizationId) {
    throw new Error("Expense not found");
  }

  // If unpaid business expense with supplier, decrement supplier balance
  if (existing.isBusinessExpense && existing.supplierId && !existing.isPaid) {
    await prisma.supplier.update({
      where: { id: existing.supplierId },
      data: { balance: { decrement: existing.amount } },
    });
  }

  await prisma.expense.delete({
    where: { id },
  });

  // Send admin notification
  notifyExpenseDeleted(
    existing.notes || existing.category.name || "Expense",
    user.organizationId,
    { name: user.user.name, email: user.user.email, role: user.role }
  ).catch((err) => console.error("Failed to send admin notification:", err));

  revalidatePath("/finance/expenses");
  if (existing.supplierId) {
    revalidatePath(`/suppliers/${existing.supplierId}`);
  }
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
      driverExpenses: {
        include: {
          driver: {
            select: {
              firstName: true,
              lastName: true,
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

  // Aggregate by driver
  const driverMap = new Map<string, number>();
  expenses.forEach((expense) => {
    expense.driverExpenses.forEach((de) => {
      const key = `${de.driver.firstName} ${de.driver.lastName}`;
      const current = driverMap.get(key) || 0;
      driverMap.set(key, current + expense.amount);
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
    byDriver: Array.from(driverMap.entries())
      .map(([driver, amount]) => ({ driver, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMonth: Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()),
    total,
  };
}

export async function exportExpensesPDF() {
  const user = await requireRole(["admin", "supervisor", "staff"]);

  const expenses = await prisma.expense.findMany({
    where: {
      organizationId: user.organizationId,
    },
    include: {
      category: {
        select: { name: true, color: true },
      },
      truckExpenses: {
        include: {
          truck: { select: { registrationNo: true } },
        },
      },
      tripExpenses: {
        include: {
          trip: { select: { originCity: true, destinationCity: true } },
        },
      },
      driverExpenses: {
        include: {
          driver: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Get date range from expenses
  const dates = expenses.map((e) => new Date(e.date).getTime());
  const startDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
  const endDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

  try {
    const pdfBytes = generateExpenseReportPDF({
      expenses: expenses.map((expense) => ({
        date: expense.date,
        category: expense.category.name,
        description: expense.notes ?? "",
        amount: expense.amount,
        trucks: expense.truckExpenses.map((te) => te.truck.registrationNo),
        trips: expense.tripExpenses.map((te) => `${te.trip.originCity}→${te.trip.destinationCity}`),
        drivers: expense.driverExpenses.map((de) => `${de.driver.firstName} ${de.driver.lastName}`),
      })),
      period: { startDate, endDate },
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");

    return {
      success: true,
      data: base64,
      filename: `expenses-report-${new Date().toISOString().split("T")[0]}.pdf`,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    return {
      success: false,
      error: "Failed to generate PDF report",
    };
  }
}

