import { prisma } from "@/lib/prisma";
import type {
  ProfitPerUnitData,
  RevenueData,
  ExpenseData,
  CustomerStatementData,
  TripSummaryData,
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
export async function fetchExpenseData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<ExpenseData[]> {
  const expenses = await prisma.expense.findMany({
    where: {
      organizationId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: { select: { name: true } },
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
    },
    orderBy: { date: "desc" },
  });

  return expenses.map((expense) => {
    const truck = expense.truckExpenses[0]?.truck;
    const trip = expense.tripExpenses[0]?.trip;

    return {
      date: expense.date,
      category: expense.category.name,
      description: expense.description || "-",
      truck: truck?.registrationNo || "-",
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
