"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole, requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { resolvePeriod, type PeriodInput } from "@/lib/period-range";
import { generateOperationsExpenseReportPDF } from "@/lib/reports/pdf-report-generator";
import {
  notifyExpenseCreated,
  notifyExpenseUpdated,
  notifyExpenseDeleted,
  notifyIfAccountOverdrawn,
} from "@/lib/notifications";
import { InsufficientBalanceError } from "@/lib/accounts";
import { isExpenseUnit } from "@/lib/expense-units";
import { debitAccountForExpense, creditAccountForExpense } from "@/lib/accounts-server";
import { handleActionError } from "@/lib/error-messages";

/** The links as a tidy set, with the single `tripId` folded in. */
function linksFrom(data: {
  truckIds?: string[];
  trailerIds?: string[];
  tripIds?: string[];
  driverIds?: string[];
  tripId?: string;
}) {
  const trips = data.tripIds ?? (data.tripId ? [data.tripId] : undefined);
  return {
    truckIds: data.truckIds,
    trailerIds: data.trailerIds,
    tripIds: trips,
    driverIds: data.driverIds,
  };
}

/** True when nothing in the fleet would carry this expense. */
function linksNothing(links: ReturnType<typeof linksFrom>) {
  return (
    (links.truckIds?.length ?? 0) === 0 &&
    (links.trailerIds?.length ?? 0) === 0 &&
    (links.tripIds?.length ?? 0) === 0 &&
    (links.driverIds?.length ?? 0) === 0
  );
}

/**
 * The account an expense actually draws on: its own if one was chosen, else
 * whatever its category normally draws on. Mirrors the finance action.
 */
function drawsOn(
  accountId: string | null | undefined,
  category: { defaultAccountId: string | null } | null | undefined,
): string | null {
  return accountId ?? category?.defaultAccountId ?? null;
}

/** A blank, a zero or a negative means "not recorded", not 0. */
function normaliseQuantity(quantity: number | null | undefined): number | null {
  if (quantity === null || quantity === undefined) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return Math.round(quantity * 1000) / 1000;
}

/** A unit without a quantity says nothing, so it is dropped with it. */
function normaliseUnit(
  unit: string | null | undefined,
  quantity: number | null | undefined,
): string | null {
  if (normaliseQuantity(quantity) === null) return null;
  return isExpenseUnit(unit) ? unit : null;
}

export async function createExpense(data: {
  description?: string;
  amount: number;
  /** What the money bought — 420 litres, 4 tyres. See lib/expense-units.ts. */
  quantity?: number | null;
  unit?: string | null;
  date: Date;
  categoryId: string;
  /** Kept for the trip page's "add an expense to this trip" link. */
  tripId?: string;
  /**
   * What this expense belongs to. Until 13 Oct this form could only name a
   * trip, so an expense recorded here reached no truck, no trailer and no
   * driver — dropped from the truck's costs, the fuel and maintenance
   * figures, driver performance and every report built on them, while still
   * counting in the company total. The attribution could never add up.
   */
  truckIds?: string[];
  trailerIds?: string[];
  tripIds?: string[];
  driverIds?: string[];
  /** An overhead the fleet does not carry — the only way to link nothing. */
  isBusinessExpense?: boolean;
  vendor?: string;
  reference?: string;
  receiptUrl?: string;
  notes?: string;
  /**
   * Which of the three accounts the money came out of. Overrides the
   * category's default; null means it did not come out of one of them.
   */
  accountId?: string | null;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  // The same rule the finance form has always enforced: an expense belongs to
  // something, or is declared an overhead. Anything else is an orphan that
  // shows up in the company total and in none of the attribution.
  const links = linksFrom(data);
  if (!data.isBusinessExpense && linksNothing(links)) {
    return {
      success: false as const,
      error:
        "Say what this expense belongs to — a truck, trailer, trip or driver — or mark it as a business overhead.",
    };
  }

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
          quantity: normaliseQuantity(data.quantity),
          unit: normaliseUnit(data.unit, data.quantity),
          description: data.description,
          date: data.date,
          vendor: data.vendor,
          reference: data.reference,
          receiptUrl: data.receiptUrl,
          notes: data.notes,
          accountId: drawsOn(data.accountId, category),
          isBusinessExpense: data.isBusinessExpense ?? false,
          truckExpenses: links.truckIds?.length
            ? { create: links.truckIds.map((truckId) => ({ truckId })) }
            : undefined,
          trailerExpenses: links.trailerIds?.length
            ? { create: links.trailerIds.map((trailerId) => ({ trailerId })) }
            : undefined,
          tripExpenses: links.tripIds?.length
            ? { create: links.tripIds.map((tripId) => ({ tripId })) }
            : undefined,
          driverExpenses: links.driverIds?.length
            ? { create: links.driverIds.map((driverId) => ({ driverId })) }
            : undefined,
        },
      });

      const drawnFrom = drawsOn(data.accountId, category);
      if (drawnFrom) {
        await debitAccountForExpense(tx, {
          accountId: drawnFrom,
          amount: data.amount,
          expenseId: created.id,
          description: data.description || category.name,
          date: data.date,
          createdById: session.user.id,
        });
      }

      return created;
    });

    // An expense paid out of an account can take it below zero now — the
    // person recording it is no longer shown the balance, so refusing would
    // either name the figure or stop the work. The owner is told instead.
    const drawnFromForNotice = drawsOn(data.accountId, category);
    if (drawnFromForNotice) {
      await notifyIfAccountOverdrawn({
        organizationId: session.organizationId,
        accountId: drawnFromForNotice,
        actorName: session.user.name,
        actorEmail: session.user.email,
        what: `an expense of $${data.amount.toFixed(2)} — ${data.description || category.name}`,
      });
    }

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
    quantity?: number | null;
    unit?: string | null;
    date?: Date;
    categoryId?: string;
    tripId?: string;
    truckIds?: string[];
    trailerIds?: string[];
    tripIds?: string[];
    driverIds?: string[];
    isBusinessExpense?: boolean;
    vendor?: string;
    reference?: string;
    receiptUrl?: string;
    notes?: string;
    accountId?: string | null;
  }
,
  /**
   * Why the change is wanted. Required for anyone but an admin, whose edit
   * becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an admin
  // accepts or refuses. Everything below runs either for an admin, or while
  // an approved request is being replayed.
  const gate = await gateChange({
    entityType: "expense",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const expense = await prisma.expense.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        truckExpenses: true,
        trailerExpenses: true,
        tripExpenses: true,
        driverExpenses: true,
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
      // Credited back to whatever it was taken from, which may not be the
      // category's default any more if either was changed since.
      const previouslyDrawnFrom = drawsOn(expense.accountId, expense.category);
      if (previouslyDrawnFrom) {
        await creditAccountForExpense(tx, {
          accountId: previouslyDrawnFrom,
          amount: expense.amount,
          expenseId: id,
          description: "Expense updated (reversal)",
          // The expense's own date, so a correction stays in the period the
          // money actually left — see the same note in the finance action.
          date: expense.date,
          createdById: session.user.id,
        });
      }
      const nowDrawnFrom =
        data.accountId !== undefined
          ? drawsOn(data.accountId, newCategory)
          : drawsOn(expense.accountId, newCategory);
      if (nowDrawnFrom) {
        await debitAccountForExpense(tx, {
          accountId: nowDrawnFrom,
          amount: newAmount,
          expenseId: id,
          description: data.description || newCategory?.name || "Expense",
          date: data.date,
          createdById: session.user.id,
        });
      }

      return tx.expense.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          amount: data.amount,
          quantity: normaliseQuantity(data.quantity),
          unit: normaliseUnit(data.unit, data.quantity),
          description: data.description,
          date: data.date,
          vendor: data.vendor,
          reference: data.reference,
          receiptUrl: data.receiptUrl,
          notes: data.notes,
          accountId: nowDrawnFrom,
          ...(data.isBusinessExpense !== undefined && {
            isBusinessExpense: data.isBusinessExpense,
          }),
        },
        include: { category: { select: { name: true } } },
      });
    });

    const changedDrawnFrom =
      data.accountId !== undefined
        ? drawsOn(data.accountId, newCategory)
        : drawsOn(expense.accountId, newCategory);
    if (changedDrawnFrom) {
      await notifyIfAccountOverdrawn({
        organizationId: session.organizationId,
        accountId: changedDrawnFrom,
        actorName: session.user.name,
        actorEmail: session.user.email,
        what: `an expense changed to $${newAmount.toFixed(2)} — ${data.description || newCategory?.name || "expense"}`,
      });
    }

    // Rewrite only the kinds of link the caller actually sent.
    //
    // The old code read `tripExpenses[0]`, deleted every trip row and created
    // one: an expense shared across three trips came back from any edit —
    // even a change of amount — attached to one. Each list below is replaced
    // wholesale when given and left alone when undefined.
    const links = linksFrom(data);
    const touched: string[] = [];

    if (links.truckIds) {
      const before = expense.truckExpenses.map((row) => row.truckId);
      await prisma.truckExpense.deleteMany({ where: { expenseId: id } });
      if (links.truckIds.length) {
        await prisma.truckExpense.createMany({
          data: links.truckIds.map((truckId) => ({ truckId, expenseId: id })),
        });
      }
      touched.push(
        ...[...new Set([...before, ...links.truckIds])].map((truckId) => `/fleet/trucks/${truckId}`),
      );
    }
    if (links.trailerIds) {
      const before = expense.trailerExpenses.map((row) => row.trailerId);
      await prisma.trailerExpense.deleteMany({ where: { expenseId: id } });
      if (links.trailerIds.length) {
        await prisma.trailerExpense.createMany({
          data: links.trailerIds.map((trailerId) => ({ trailerId, expenseId: id })),
        });
      }
      touched.push(
        ...[...new Set([...before, ...links.trailerIds])].map(
          (trailerId) => `/fleet/trailers/${trailerId}`,
        ),
      );
    }
    if (links.tripIds) {
      const before = expense.tripExpenses.map((row) => row.tripId);
      await prisma.tripExpense.deleteMany({ where: { expenseId: id } });
      if (links.tripIds.length) {
        await prisma.tripExpense.createMany({
          data: links.tripIds.map((tripId) => ({ tripId, expenseId: id })),
        });
      }
      touched.push(
        ...[...new Set([...before, ...links.tripIds])].map(
          (tripId) => `/operations/trips/${tripId}`,
        ),
      );
    }
    if (links.driverIds) {
      const before = expense.driverExpenses.map((row) => row.driverId);
      await prisma.driverExpense.deleteMany({ where: { expenseId: id } });
      if (links.driverIds.length) {
        await prisma.driverExpense.createMany({
          data: links.driverIds.map((driverId) => ({ driverId, expenseId: id })),
        });
      }
      touched.push(
        ...[...new Set([...before, ...links.driverIds])].map(
          (driverId) => `/fleet/drivers/${driverId}`,
        ),
      );
    }

    for (const path of new Set(touched)) {
      revalidatePath(path);
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
      const refundTo = drawsOn(expense.accountId, expense.category);
      if (refundTo) {
        await creditAccountForExpense(tx, {
          accountId: refundTo,
          amount: expense.amount,
          expenseId: id,
          description: expense.description || expense.category.name || "Expense deleted",
          date: expense.date,
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
  const session = await assertRole(["admin"]);

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
