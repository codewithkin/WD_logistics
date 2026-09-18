import { prisma } from "@/lib/prisma";
import { isDebitTransaction } from "@/lib/accounts";
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
        where: {
          status: "completed",
          endDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          tripExpenses: {
            include: { expense: true },
          },
        },
      },
      truckExpenses: {
        where: {
          expense: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        include: {
          expense: {
            include: { category: true },
          },
        },
      },
    },
  });

  return trucks.map((truck) => {
    const totalRevenue = truck.trips.reduce((sum, trip) => sum + trip.revenue, 0);

    const tripExpenses = truck.trips.reduce(
      (sum, trip) =>
        sum + trip.tripExpenses.reduce((e, te) => e + te.expense.amount, 0),
      0
    );

    const truckExpenses = truck.truckExpenses.reduce(
      (sum, te) => sum + te.expense.amount,
      0
    );

    const totalExpenses = tripExpenses + truckExpenses;
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
      status: { in: ["sent", "paid", "partial"] },
    },
    include: {
      customer: { select: { name: true } },
      lineItems: true,
    },
    orderBy: { issueDate: "desc" },
  });

  return invoices.map((invoice) => ({
    date: invoice.issueDate,
    customer: invoice.customer.name,
    invoiceNo: invoice.invoiceNumber,
    trip: invoice.lineItems[0]?.description || "-",
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
      description: expense.description || "-",
      truck: truck?.registrationNo || "-",
      trailer: trailer?.registrationNo || "-",
      trip: trip ? `${trip.originCity} → ${trip.destinationCity}` : "-",
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
      description: `Invoice ${inv.invoiceNumber}`,
      debit: inv.total,
      credit: 0,
    })),
    ...payments.map((pay) => ({
      date: pay.paymentDate,
      type: "PAYMENT" as const,
      reference: pay.reference || "-",
      description: `Payment - ${pay.method}`,
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
    },
    include: {
      truck: { select: { registrationNo: true } },
      driver: { select: { firstName: true, lastName: true } },
      tripExpenses: {
        include: { expense: true },
      },
    },
    orderBy: { scheduledDate: "desc" },
  });

  return trips.map((trip, index) => {
    const expenses = trip.tripExpenses.reduce((sum, te) => sum + te.expense.amount, 0);
    const profit = trip.revenue - expenses;

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
    where: {
      truckId,
      status: "completed",
      endDate: { gte: startDate, lte: endDate },
    },
    include: {
      tripExpenses: {
        include: { expense: { include: { category: true } } },
      },
    },
  });

  const truckExpenses = await prisma.truckExpense.findMany({
    where: {
      truckId,
      expense: { date: { gte: startDate, lte: endDate } },
    },
    include: { expense: { include: { category: true } } },
  });

  const revenue = trips.reduce((sum, trip) => sum + trip.revenue, 0);

  const categoryTotals = new Map<string, number>();
  const addExpense = (categoryName: string, amount: number) => {
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + amount);
  };

  for (const trip of trips) {
    for (const te of trip.tripExpenses) {
      addExpense(te.expense.category.name, te.expense.amount);
    }
  }
  for (const te of truckExpenses) {
    addExpense(te.expense.category.name, te.expense.amount);
  }

  const expensesByCategory = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
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
 * Opening/closing balances are read from AccountTransaction.balanceAfter
 * snapshots rather than re-summed, so they match the ledger exactly even
 * as floating point amounts accumulate over time.
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
    const priorTx = await prisma.accountTransaction.findFirst({
      where: { accountId: account.id, date: { lt: startDate } },
      orderBy: { date: "desc" },
    });
    const openingBalance = priorTx?.balanceAfter ?? account.startingBalance;

    const periodTx = await prisma.accountTransaction.findMany({
      where: { accountId: account.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });

    const totalDebits = periodTx
      .filter((t) => isDebitTransaction(t.type))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = periodTx
      .filter((t) => !isDebitTransaction(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    const closingBalance = periodTx.length > 0
      ? periodTx[periodTx.length - 1].balanceAfter
      : openingBalance;

    const breakdownMap = new Map<string, number>();
    for (const t of periodTx.filter((t) => t.type === "expense_debit")) {
      const key = t.description || "Expense";
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

/**
 * Get list of customers for dropdown
 */
export async function getCustomerList(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get list of trucks for dropdown
 */
export async function getTruckList(organizationId: string) {
  return prisma.truck.findMany({
    where: { organizationId, status: "active" },
    select: { id: true, registrationNo: true, make: true, model: true },
    orderBy: { registrationNo: "asc" },
  });
}

/** Trailer picker options for the report generator. */
export async function getTrailerList(organizationId: string) {
  return prisma.trailer.findMany({
    where: { organizationId, status: "active" },
    select: { id: true, registrationNo: true, make: true, model: true },
    orderBy: { registrationNo: "asc" },
  });
}

/** Trip picker options for the report generator. */
export async function getTripList(organizationId: string) {
  return prisma.trip.findMany({
    where: { organizationId },
    select: {
      id: true,
      originCity: true,
      destinationCity: true,
      scheduledDate: true,
      truck: { select: { registrationNo: true } },
    },
    orderBy: { scheduledDate: "desc" },
    take: 200,
  });
}
