import { prisma } from "@/lib/prisma";
import { isDebitTransaction } from "@/lib/accounts";

/** Money, to the cent. */
const round2 = (value: number) => Math.round(value * 100) / 100;
import { earnedRevenueWhere } from "@/lib/metrics/revenue";
import { getTruckCostTotals } from "@/lib/metrics/truck-costs";
import type {
  ProfitPerUnitData,
  RevenueData,
  ExpenseData,
  CustomerStatementData,
  TripSummaryData,
  TruckProfitabilityData,
  AccountLedgerData,
} from "./csv-generator";

/**
 * Fetch Profit Per Unit data
 * Calculates revenue, expenses, and profit for each truck
 */
export async function fetchProfitPerUnitData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<ProfitPerUnitData[]> {
  const trucks = await prisma.truck.findMany({
    where: { organizationId },
    include: {
      trips: {
        // The one definition of earned revenue, shared with the dashboard and
        // the P&L. Matching on endDate alone silently dropped a trip marked
        // completed without one, so this report and the dashboard could
        // disagree about the same truck.
        where: earnedRevenueWhere(organizationId, startDate, endDate),
        select: { id: true, revenue: true },
      },
    },
  });

  // Costs come from the one cost engine (lib/metrics/truck-costs.ts), which
  // dedupes a cost entered against both a truck and one of its trips and
  // splits a shared cost between what it names. This used to add the trip
  // expenses to the truck expenses with neither, and its trip side carried no
  // date filter at all — so a truck could be shown a loss made of last year's
  // fuel counted twice.
  const costs = await getTruckCostTotals(
    organizationId,
    trucks.map((truck) => truck.id),
    { from: startDate, to: endDate },
  );

  return trucks.map((truck) => {
    const totalRevenue = truck.trips.reduce((sum, trip) => sum + trip.revenue, 0);
    const totalExpenses = costs.get(truck.id)?.total ?? 0;
    const profit = totalRevenue - totalExpenses;

    return {
      registrationNo: truck.registrationNo,
      make: truck.make,
      model: truck.model,
      trips: truck.trips.length,
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
    };
  });
}

/**
 * Fetch Revenue data
 * Gets all invoices with customer and trip information
 */
export async function fetchRevenueData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<RevenueData[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
      // "overdue" was missing, so an invoice that went past its due date
      // dropped out of the revenue report while still appearing on the
      // customer's statement. Only drafts and cancellations are excluded.
      status: { in: ["sent", "paid", "partial", "overdue"] },
    },
    include: {
      customer: { select: { name: true } },
      // The trip the invoice was raised for. The column used to read
      // `lineItems[0].description`, and nothing in the app has ever written an
      // invoice line item, so it printed "-" on every row of every revenue
      // report ever run.
      trip: { select: { originCity: true, destinationCity: true, scheduledDate: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  return invoices.map((invoice) => ({
    date: invoice.issueDate,
    customer: invoice.customer.name,
    invoiceNo: invoice.invoiceNumber,
    trip: invoice.trip
      ? `${invoice.trip.originCity} → ${invoice.trip.destinationCity}`
      : "Not linked to a trip",
    amount: invoice.total,
  }));
}

/**
 * Fetch Expense data
 * Gets all expenses with category and truck information
 */
/**
 * @param scope narrows the report to one truck, trailer or trip. Without it
 *              this returns every expense in the period, as it always has —
 *              which is why there was no way to run an expenses-only report
 *              for a single truck before.
 */
export async function fetchExpenseData(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  scope?: { truckId?: string; trailerId?: string; tripId?: string }
): Promise<ExpenseData[]> {
  const expenses = await prisma.expense.findMany({
    where: {
      organizationId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      ...(scope?.truckId ? { truckExpenses: { some: { truckId: scope.truckId } } } : {}),
      ...(scope?.trailerId ? { trailerExpenses: { some: { trailerId: scope.trailerId } } } : {}),
      ...(scope?.tripId ? { tripExpenses: { some: { tripId: scope.tripId } } } : {}),
    },
    include: {
      category: { select: { name: true } },
      truckExpenses: {
        include: {
          truck: { select: { registrationNo: true } },
        },
      },
      trailerExpenses: {
        include: {
          trailer: { select: { registrationNo: true } },
        },
      },
      tripExpenses: {
        include: {
          trip: { select: { originCity: true, destinationCity: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return expenses.map((expense) => {
    const truck = expense.truckExpenses[0]?.truck;
    const trailer = expense.trailerExpenses[0]?.trailer;
    const trip = expense.tripExpenses[0]?.trip;

    return {
      date: expense.date,
      category: expense.category.name,
      // The finance form writes its free text into `notes` and has never
      // written `description`, so this column printed "-" on every
      // finance-side expense — most of them. Whichever text exists is shown,
      // and the note travels in its own column when both do.
      description: expense.description || expense.notes || "-",
      notes: expense.description && expense.notes ? expense.notes : "-",
      truck: truck?.registrationNo || "-",
      trailer: trailer?.registrationNo || "-",
      trip: trip ? `${trip.originCity} → ${trip.destinationCity}` : "-",
      vendor: expense.vendor || "-",
      reference: expense.reference || "-",
      amount: expense.amount,
    };
  });
}

/**
 * Fetch Customer Statement data
 * Gets all transactions for a specific customer
 */
export async function fetchCustomerStatementData(
  organizationId: string,
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  customer: { name: string; address?: string; email?: string };
  entries: CustomerStatementData[];
  openingBalance: number;
  closingBalance: number;
}> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      name: true,
      address: true,
      email: true,
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Get invoices before period for opening balance
  const priorInvoices = await prisma.invoice.aggregate({
    where: {
      customerId,
      issueDate: { lt: startDate },
      status: { in: ["sent", "paid", "partial", "overdue"] },
    },
    _sum: { total: true },
  });

  const priorPayments = await prisma.payment.aggregate({
    where: {
      customerId,
      paymentDate: { lt: startDate },
    },
    _sum: { amount: true },
  });

  const openingBalance = (priorInvoices._sum.total || 0) - (priorPayments._sum.amount || 0);

  // Get invoices in period
  const invoices = await prisma.invoice.findMany({
    where: {
      customerId,
      issueDate: { gte: startDate, lte: endDate },
      status: { in: ["sent", "paid", "partial", "overdue"] },
    },
    orderBy: { issueDate: "asc" },
  });
  // Both carry a note that was typed and then never printed anywhere. On a
  // statement it is the line that explains the line: "deposit, balance on
  // delivery", "paid in cash at the depot".


  // Get payments in period
  const payments = await prisma.payment.findMany({
    where: {
      customerId,
      paymentDate: { gte: startDate, lte: endDate },
    },
    orderBy: { paymentDate: "asc" },
  });

  // Combine and sort entries
  const entries: CustomerStatementData[] = [];
  let runningBalance = openingBalance;

  // Merge invoices and payments by date
  const allTransactions = [
    ...invoices.map((inv) => ({
      date: inv.issueDate,
      type: "INVOICE" as const,
      reference: inv.invoiceNumber,
      description: inv.notes ? `Invoice ${inv.invoiceNumber} — ${inv.notes}` : `Invoice ${inv.invoiceNumber}`,
      debit: inv.total,
      credit: 0,
    })),
    ...payments.map((pay) => ({
      date: pay.paymentDate,
      type: "PAYMENT" as const,
      reference: pay.reference || "-",
      description: pay.notes ? `Payment - ${pay.method} — ${pay.notes}` : `Payment - ${pay.method}`,
      debit: 0,
      credit: pay.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const transaction of allTransactions) {
    runningBalance = runningBalance + transaction.debit - transaction.credit;
    entries.push({
      ...transaction,
      balance: runningBalance,
    });
  }

  return {
    customer: {
      name: customer.name,
      address: customer.address || undefined,
      email: customer.email || undefined,
    },
    entries,
    openingBalance,
    closingBalance: runningBalance,
  };
}

/**
 * Fetch Trip Summary data
 * Gets all trips with revenue and expense details
 */
export async function fetchTripSummaryData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<TripSummaryData[]> {
  const trips = await prisma.trip.findMany({
    where: {
      organizationId,
      scheduledDate: {
        gte: startDate,
        lte: endDate,
      },
      // A cancelled trip earned nothing and a scheduled one has not earned it
      // yet. Counting both is why this report's revenue could not be
      // reconciled with the P&L, the trip P&L or the dashboard, all of which
      // use lib/metrics/revenue.
      status: { notIn: ["cancelled"] },
    },
    include: {
      truck: { select: { registrationNo: true } },
      driver: { select: { firstName: true, lastName: true } },
      tripExpenses: {
        include: {
          // How many trips the cost covers, so a shared one can be split.
          expense: { include: { _count: { select: { tripExpenses: true } } } },
        },
      },
    },
    orderBy: { scheduledDate: "desc" },
  });

  return trips.map((trip, index) => {
    // A cost booked against three trips is a third of it each, which is how
    // the trip P&L has always read it. This report charged every trip the full
    // amount, so the same trip printed two different profits depending on
    // which report you ran.
    const expenses =
      Math.round(
        trip.tripExpenses.reduce(
          (sum, te) => sum + te.expense.amount / (te.expense._count.tripExpenses || 1),
          0,
        ) * 100,
      ) / 100;
    const profit = Math.round((trip.revenue - expenses) * 100) / 100;

    return {
      tripNumber: `TRP-${String(index + 1).padStart(4, "0")}`,
      date: trip.scheduledDate,
      origin: trip.originCity,
      destination: trip.destinationCity,
      truck: trip.truck.registrationNo,
      driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
      revenue: trip.revenue,
      expenses,
      profit,
      notes: trip.notes || "-",
    };
  });
}

/**
 * Fetch Truck Profitability data
 * Revenue vs. expenses (broken down by category) for a single truck
 */
export async function fetchTruckProfitabilityData(
  organizationId: string,
  truckId: string,
  startDate: Date,
  endDate: Date
): Promise<TruckProfitabilityData> {
  const truck = await prisma.truck.findFirst({
    where: { id: truckId, organizationId },
    select: { registrationNo: true, make: true, model: true },
  });

  if (!truck) {
    throw new Error("Truck not found");
  }

  const trips = await prisma.trip.findMany({
    where: earnedRevenueWhere(organizationId, startDate, endDate, { truckId }),
    select: { id: true, revenue: true },
  });

  const revenue = trips.reduce((sum, trip) => sum + trip.revenue, 0);

  // Through the one cost engine, which dedupes a cost booked against both this
  // truck and one of its trips and splits a cost shared with other trucks.
  // Summing both sides, as this used to, charged the same fuel twice.
  const costs = await getTruckCostTotals(organizationId, [truckId], {
    from: startDate,
    to: endDate,
  });

  const expensesByCategory = Array.from(costs.get(truckId)?.byCategory ?? [])
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = expensesByCategory.reduce((sum, c) => sum + c.amount, 0);
  const profit = revenue - totalExpenses;

  return {
    truck,
    trips: trips.length,
    revenue,
    expensesByCategory,
    totalExpenses,
    profit,
    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}

/**
 * Fetch Account Ledger data — a running ledger + P&L view for the three
 * accounts (Cash/Bank/Petty Cash): opening balance -> usage -> remaining.
 *
 * Opening and closing figures are worked out from the entries themselves:
 * the opening balance plus everything in, less everything out. They used to
 * be read from `AccountTransaction.balanceAfter`, which is the balance at the
 * moment the row was *written* — so one backdated entry, or a correction
 * dated to the expense it reverses, made every opening and closing figure
 * after it disagree with the account. The same arithmetic as
 * `recomputeAccountBalance`, over a date window.
 */
export async function fetchAccountLedgerData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<AccountLedgerData[]> {
  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId },
    orderBy: { type: "asc" },
  });

  const results: AccountLedgerData[] = [];

  for (const account of accounts) {
    const [priorTx, periodTx] = await Promise.all([
      prisma.accountTransaction.findMany({
        where: { accountId: account.id, date: { lt: startDate } },
        select: { type: true, amount: true },
      }),
      prisma.accountTransaction.findMany({
        where: { accountId: account.id, date: { gte: startDate, lte: endDate } },
        orderBy: { date: "asc" },
        include: {
          // The expense behind the entry, so the breakdown can be grouped by
          // what the money was for.
          expense: { select: { category: { select: { name: true } } } },
        },
      }),
    ]);

    const movement = (rows: Array<{ type: string; amount: number }>) =>
      rows.reduce(
        (sum, row) => sum + (isDebitTransaction(row.type) ? -row.amount : row.amount),
        0,
      );

    const openingBalance = round2(account.startingBalance + movement(priorTx));

    const totalDebits = periodTx
      .filter((t) => isDebitTransaction(t.type))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = periodTx
      .filter((t) => !isDebitTransaction(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    const closingBalance = round2(openingBalance + movement(periodTx));

    // Grouped by the expense's category, not by its description. The
    // description is `notes || category name`, so every finance-side expense
    // with a note of its own collapsed into one line of the breakdown and the
    // rest into another — a breakdown that explained nothing.
    const breakdownMap = new Map<string, number>();
    for (const t of periodTx.filter((t) => t.type === "expense_debit")) {
      const key = t.expense?.category?.name || t.description || "Expense";
      breakdownMap.set(key, (breakdownMap.get(key) || 0) + t.amount);
    }

    results.push({
      accountType: account.type,
      accountName: account.name,
      openingBalance,
      totalDebits,
      totalCredits,
      closingBalance,
      expenseBreakdown: Array.from(breakdownMap.entries())
        .map(([description, amount]) => ({ description, amount }))
        .sort((a, b) => b.amount - a.amount),
    });
  }

  return results;
}
