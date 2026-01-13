"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { generateOperationsExpenseReportPDF } from "@/lib/reports/pdf-report-generator";

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
      return { success: false, error: "Category not found" };
    }

    // If linking to a trip, validate it exists
    if (data.tripId) {
      const trip = await prisma.trip.findFirst({
        where: { id: data.tripId, organizationId: session.organizationId },
      });

      if (!trip) {
        return { success: false, error: "Trip not found" };
      }
    }

    // Create expense with optional trip link
    const expense = await prisma.expense.create({
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

    revalidatePath("/operations/expenses");
    if (data.tripId) {
      revalidatePath(`/operations/trips/${data.tripId}`);
    }
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
      include: { tripExpenses: true },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    // Update the expense
    const updatedExpense = await prisma.expense.update({
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

    revalidatePath("/operations/expenses");
    return { success: true, expense: updatedExpense };
  } catch (error) {
    console.error("Failed to update expense:", error);
    return { success: false, error: "Failed to update expense" };
  }
}

export async function deleteExpense(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const expense = await prisma.expense.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { tripExpenses: true },
    });

    if (!expense) {
      return { success: false, error: "Expense not found" };
    }

    // Cascade delete will handle tripExpenses
    await prisma.expense.delete({ where: { id } });

    revalidatePath("/operations/expenses");
    for (const te of expense.tripExpenses) {
      revalidatePath(`/operations/trips/${te.tripId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return { success: false, error: "Failed to delete expense" };
  }
}

export async function exportOperationsExpensesPDF() {
  const session = await requireAuth();

  try {
    const expenses = await prisma.expense.findMany({
      where: { organizationId: session.organizationId },
      include: {
        category: { select: { name: true } },
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

    const analytics = {
      totalExpenses: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
      pendingAmount: 0,
      paidAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pdfBytes = generateOperationsExpenseReportPDF({
      expenses: expenses.map((e) => ({
        description: e.description || "No description",
        amount: e.amount,
        date: e.date,
        status: "Recorded",
        category: e.category?.name || "Uncategorized",
        tripTruck: e.tripExpenses[0]?.trip?.truck?.registrationNo || "N/A",
      })),
      analytics,
      period: {
        startDate: startOfMonth,
        endDate: now,
      },
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");

    return {
      success: true,
      data: base64,
      filename: `operations-expenses-report-${now.toISOString().split("T")[0]}.pdf`,
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
