"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { resolvePeriod, type PeriodInput } from "@/lib/period-range";
import { generateOperationsExpenseReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyExpenseCreated, notifyExpenseUpdated, notifyExpenseDeleted } from "@/lib/notifications";
import { InsufficientBalanceError } from "@/lib/accounts";
import { debitAccountForExpense, creditAccountForExpense } from "@/lib/accounts-server";
import { handleActionError } from "@/lib/error-messages";

export async function createExpense(data: {
  description?: string;
  amount: number;
  date: Date;
  categoryId: string;
  tripId?: string;
  vendor?: string;
  reference?: string;
  receiptUrl?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    // Validate category exists
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.categoryId, organizationId: session.organizationId },
    });

    if (!category) {
      return { success: false as const, error: "Category not found" };
    }

    // If linking to a trip, validate it exists
    if (data.tripId) {
      const trip = await prisma.trip.findFirst({
        where: { id: data.tripId, organizationId: session.organizationId },
      });

      if (!trip) {
        return { success: false as const, error: "Trip not found" };
      }
    }

    // Create expense with optional trip link, and draw funds from the
    // category's default account (if configured) atomically with it.
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          organizationId: session.organizationId,
          categoryId: data.categoryId,
          amount: data.amount,
          description: data.description,
          date: data.date,
          vendor: data.vendor,
          reference: data.reference,
          receiptUrl: data.receiptUrl,
          notes: data.notes,
          tripExpenses: data.tripId ? {
            create: { tripId: data.tripId }
          } : undefined,
        },
      });

      if (category.defaultAccountId) {
        await debitAccountForExpense(tx, {
          accountId: category.defaultAccountId,
          amount: data.amount,
          expenseId: created.id,
          description: data.description || category.name,
          date: data.date,
          createdById: session.user.id,
        });
      }

      return created;
    });

    // Send admin notification
    notifyExpenseCreated(
      {
        id: expense.id,
        description: data.description || category.name || "Expense",
        category: category.name,
        amount: data.amount,
        date: data.date,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/operations/expenses");
    revalidatePath("/finance/accounts");
    if (data.tripId) {
      revalidatePath(`/operations/trips/${data.tripId}`);
    }
    return { success: true as const, expense };
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { success: false as const, error: error.message };
    }
    return handleActionError(error, "Failed to create expense");
  }
}

export async function updateExpense(
  id: string,
  data: {
    description?: string;
    amount?: number;
    date?: Date;
    categoryId?: string;
    tripId?: string;
    vendor?: string;
    reference?: string;
    receiptUrl?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const expense = await prisma.expense.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        tripExpenses: true,
        category: { select: { name: true, defaultAccountId: true } },
      },
    });

    if (!expense) {
      return { success: false as const, error: "Expense not found" };
    }

    // Resolve the new category up front (if it's actually changing) so we
    // know which account the new amount should draw from.
    const newCategory = data.categoryId && data.categoryId !== expense.categoryId
      ? await prisma.expenseCategory.findUnique({
          where: { id: data.categoryId },
          select: { name: true, defaultAccountId: true },
        })
      : expense.category;
    const newAmount = data.amount ?? expense.amount;

    const updatedExpense = await prisma.$transaction(async (tx) => {
      // Reverse the old account impact, then apply the new one — see
      // finance/expenses/actions.ts updateExpense for why this ordering
      // avoids a false overdraft on a same-account edit.
      if (expense.category.defaultAccountId) {
        await creditAccountForExpense(tx, {
          accountId: expense.category.defaultAccountId,
          amount: expense.amount,
          expenseId: id,
          description: "Expense updated (reversal)",
          createdById: session.user.id,
        });
      }
      if (newCategory?.defaultAccountId) {
        await debitAccountForExpense(tx, {
          accountId: newCategory.defaultAccountId,
          amount: newAmount,
          expenseId: id,
          description: data.description || newCategory.name,
          date: data.date,
          createdById: session.user.id,
        });
      }

      return tx.expense.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          amount: data.amount,
          description: data.description,
          date: data.date,
          vendor: data.vendor,
          reference: data.reference,
          receiptUrl: data.receiptUrl,
          notes: data.notes,
        },
        include: { category: { select: { name: true } } },
      });
    });

    // Handle trip link changes
    const currentTripId = expense.tripExpenses[0]?.tripId;
    if (data.tripId !== undefined && data.tripId !== currentTripId) {
      // Remove existing trip link
      if (currentTripId) {
        await prisma.tripExpense.deleteMany({
          where: { expenseId: id },
        });
        revalidatePath(`/operations/trips/${currentTripId}`);
      }
      // Add new trip link
      if (data.tripId) {
        await prisma.tripExpense.create({
          data: { tripId: data.tripId, expenseId: id },
        });
        revalidatePath(`/operations/trips/${data.tripId}`);
      }
    }

    // Send admin notification
    notifyExpenseUpdated(
      {
        id: updatedExpense.id,
        description: updatedExpense.description || updatedExpense.category.name || "Expense",
        category: updatedExpense.category.name,
        amount: updatedExpense.amount,
        date: updatedExpense.date,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/operations/expenses");
    revalidatePath("/finance/accounts");
    return { success: true as const, expense: updatedExpense };
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { success: false as const, error: error.message };
    }
    return handleActionError(error, "Failed to update expense");
  }
}

export async function deleteExpense(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const expense = await prisma.expense.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        tripExpenses: true,
        category: { select: { name: true, defaultAccountId: true } },
      },
    });

    if (!expense) {
      return { success: false as const, error: "Expense not found" };
    }

    await prisma.$transaction(async (tx) => {
      if (expense.category.defaultAccountId) {
        await creditAccountForExpense(tx, {
          accountId: expense.category.defaultAccountId,
          amount: expense.amount,
          expenseId: id,
          description: expense.description || expense.category.name || "Expense deleted",
          createdById: session.user.id,
        });
      }

      // Cascade delete will handle tripExpenses
      await tx.expense.delete({ where: { id } });
    });

    // Send admin notification
    notifyExpenseDeleted(
      expense.description || expense.category.name || "Expense",
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/operations/expenses");
    revalidatePath("/finance/accounts");
    for (const te of expense.tripExpenses) {
      revalidatePath(`/operations/trips/${te.tripId}`);
    }
    return { success: true as const };
  } catch (error) {
    return handleActionError(error, "Failed to delete expense");
  }
}

export async function exportOperationsExpensesPDF(options?: {
  categoryId?: string;
  period?: PeriodInput;
}) {
  const session = await requireAuth();

  try {
    // Follows the page's period rather than exporting every expense ever.
    const range = resolvePeriod(options?.period, "1m");

    // Build where clause with optional category filter
    const whereClause: Record<string, unknown> = {
      organizationId: session.organizationId,
      date: { gte: range.from, lte: range.to },
    };
    
    if (options?.categoryId) {
      whereClause.categoryId = options.categoryId;
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        category: { select: { id: true, name: true } },
        tripExpenses: {
          include: {
            trip: {
              select: { truck: { select: { registrationNo: true } } },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Get category name if filtering by category
    let categoryName = "All Categories";
    if (options?.categoryId) {
      const category = await prisma.expenseCategory.findFirst({
        where: {
          id: options.categoryId,
          organizationId: session.organizationId,
        },
        select: { name: true },
      });
      if (category) {
        categoryName = category.name;
      }
    }

    const analytics = {
      totalExpenses: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
      // These were hardcoded to "nothing pending, everything paid", which is
      // the same bug the on-screen chart carried. Read the flag.
      pendingAmount: expenses
        .filter((e) => !e.isPaid)
        .reduce((sum, e) => sum + e.amount, 0),
      paidAmount: expenses
        .filter((e) => e.isPaid)
        .reduce((sum, e) => sum + e.amount, 0),
    };

    const now = new Date();

    const pdfBytes = generateOperationsExpenseReportPDF({
      expenses: expenses.map((e) => ({
        description: e.description || "No description",
        amount: e.amount,
        date: e.date,
        status: e.isPaid ? "Paid" : "Pending",
        category: e.category?.name || "Uncategorized",
        tripTruck: e.tripExpenses[0]?.trip?.truck?.registrationNo || "N/A",
      })),
      analytics,
      period: {
        startDate: range.from,
        endDate: range.to,
      },
      categoryName: options?.categoryId ? categoryName : undefined,
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");
    
    const filename = options?.categoryId 
      ? `expenses-${categoryName.toLowerCase().replace(/\s+/g, "-")}-report-${now.toISOString().split("T")[0]}.pdf`
      : `operations-expenses-report-${now.toISOString().split("T")[0]}.pdf`;

    return {
      success: true as const,
      data: base64,
      filename,
      mimeType: "application/pdf",
    };
  } catch (error) {
    return handleActionError(error, "Failed to generate PDF report", "Failed to generate PDF");
  }
}
