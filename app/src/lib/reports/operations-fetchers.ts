import "server-only";

/**
 * Data for the remaining five reports: customer profitability, expense
 * categories, document expiry, inventory valuation and per-trip P&L.
 *
 * Two of these answer questions nothing else in the app could: which
 * customers are actually worth having, and what is about to expire. The
 * other three bring existing on-screen views into a form that can be printed
 * or sent to an accountant.
 */

import { prisma } from "@/lib/prisma";
import { earnedRevenueWhere } from "@/lib/metrics/revenue";
import { costKindLabel } from "@/lib/metrics/cost-kinds";
import { EXPIRY_FIELDS, type ExpiryEntityType } from "@/lib/expiry-reminders";

const round = (value: number) => Math.round(value * 100) / 100;
const share = (part: number, whole: number) =>
  whole === 0 ? 0 : round((part / whole) * 100);

// ---------------------------------------------------------------------------
// Customer profitability

export interface CustomerProfitabilityRow {
  customer: string;
  contact: string | null;
  phone: string | null;
  trips: number;
  kilometres: number;
  revenue: number;
  /** Trip costs booked against this customer's trips. */
  tripCosts: number;
  profit: number;
  margin: number | null;
  averageRate: number | null;
  ratePerKm: number | null;
  invoiced: number;
  outstanding: number;
  shareOfRevenue: number;
}

export interface CustomerProfitabilityData {
  from: Date;
  to: Date;
  rows: CustomerProfitabilityRow[];
  totals: {
    trips: number;
    revenue: number;
    tripCosts: number;
    profit: number;
    outstanding: number;
  };
}

export async function fetchCustomerProfitabilityData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<CustomerProfitabilityData> {
  const [customers, trips, tripExpenseLinks, invoices] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId },
      select: { id: true, name: true, contactPerson: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, from, to),
      select: {
        id: true,
        customerId: true,
        revenue: true,
        actualMileage: true,
        estimatedMileage: true,
      },
    }),
    prisma.tripExpense.findMany({
      where: { expense: { organizationId, date: { gte: from, lte: to } } },
      select: {
        tripId: true,
        expense: { select: { id: true, amount: true } },
        trip: { select: { customerId: true } },
      },
    }),
    prisma.invoice.findMany({
      where: {
        organizationId,
        status: { notIn: ["cancelled"] },
        issueDate: { gte: from, lte: to },
      },
      select: { customerId: true, total: true, balance: true },
    }),
  ]);

  // A trip cost shared across several trips is split between them, so a
  // customer is not charged for another customer's share.
  const splitCount = new Map<string, number>();
  for (const link of tripExpenseLinks) {
    splitCount.set(link.expense.id, (splitCount.get(link.expense.id) ?? 0) + 1);
  }

  const costByCustomer = new Map<string, number>();
  for (const link of tripExpenseLinks) {
    const customerId = link.trip?.customerId;
    if (!customerId) continue;
    costByCustomer.set(
      customerId,
      (costByCustomer.get(customerId) ?? 0) +
        link.expense.amount / (splitCount.get(link.expense.id) || 1),
    );
  }

  const statsByCustomer = new Map<
    string,
    { trips: number; km: number; revenue: number }
  >();
  for (const trip of trips) {
    if (!trip.customerId) continue;
    const row = statsByCustomer.get(trip.customerId) ?? {
      trips: 0,
      km: 0,
      revenue: 0,
    };
    row.trips += 1;
    row.km += trip.actualMileage ?? trip.estimatedMileage ?? 0;
    row.revenue += trip.revenue || 0;
    statsByCustomer.set(trip.customerId, row);
  }

  const invoicedByCustomer = new Map<string, { total: number; balance: number }>();
  for (const invoice of invoices) {
    const row = invoicedByCustomer.get(invoice.customerId) ?? {
      total: 0,
      balance: 0,
    };
    row.total += invoice.total;
    row.balance += invoice.balance;
    invoicedByCustomer.set(invoice.customerId, row);
  }

  const totalRevenue = round(
    Array.from(statsByCustomer.values()).reduce((s, r) => s + r.revenue, 0),
  );

  const rows: CustomerProfitabilityRow[] = customers
    .map((customer) => {
      const stats = statsByCustomer.get(customer.id) ?? {
        trips: 0,
        km: 0,
        revenue: 0,
      };
      const revenue = round(stats.revenue);
      const tripCosts = round(costByCustomer.get(customer.id) ?? 0);
      const profit = round(revenue - tripCosts);
      const billing = invoicedByCustomer.get(customer.id) ?? {
        total: 0,
        balance: 0,
      };

      return {
        customer: customer.name,
        contact: customer.contactPerson,
        phone: customer.phone,
        trips: stats.trips,
        kilometres: round(stats.km),
        revenue,
        tripCosts,
        profit,
        margin: revenue > 0 ? share(profit, revenue) : null,
        averageRate: stats.trips > 0 ? round(revenue / stats.trips) : null,
        ratePerKm: stats.km > 0 ? round(revenue / stats.km) : null,
        invoiced: round(billing.total),
        outstanding: round(billing.balance),
        shareOfRevenue: share(revenue, totalRevenue),
      };
    })
    .filter((row) => row.trips > 0 || row.invoiced > 0 || row.outstanding > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    from,
    to,
    rows,
    totals: {
      trips: rows.reduce((s, r) => s + r.trips, 0),
      revenue: round(rows.reduce((s, r) => s + r.revenue, 0)),
      tripCosts: round(rows.reduce((s, r) => s + r.tripCosts, 0)),
      profit: round(rows.reduce((s, r) => s + r.profit, 0)),
      outstanding: round(rows.reduce((s, r) => s + r.outstanding, 0)),
    },
  };
}

// ---------------------------------------------------------------------------
// Expense categories

export interface ExpenseCategoryRow {
  category: string;
  kind: string;
  account: string | null;
  entries: number;
  total: number;
  average: number;
  largest: number;
  share: number;
  /** Where the money was booked — how many of each link type. */
  againstTrucks: number;
  againstTrips: number;
  againstDrivers: number;
  overheads: number;
}

export interface ExpenseCategoryReportData {
  from: Date;
  to: Date;
  total: number;
  entries: number;
  rows: ExpenseCategoryRow[];
  /** Totals grouped by cost kind (fuel, maintenance, tyres …). */
  byKind: Array<{ kind: string; total: number; share: number }>;
  monthly: Array<{ month: string; total: number }>;
}

export async function fetchExpenseCategoryReportData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<ExpenseCategoryReportData> {
  const [categories, expenses] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        kind: true,
        defaultAccount: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.expense.findMany({
      where: { organizationId, date: { gte: from, lte: to } },
      select: {
        categoryId: true,
        amount: true,
        date: true,
        isBusinessExpense: true,
        _count: {
          select: {
            truckExpenses: true,
            tripExpenses: true,
            driverExpenses: true,
          },
        },
      },
    }),
  ]);

  const byCategory = new Map<
    string,
    {
      entries: number;
      total: number;
      largest: number;
      trucks: number;
      trips: number;
      drivers: number;
      overheads: number;
    }
  >();
  const monthly = new Map<string, number>();

  for (const expense of expenses) {
    const key = expense.categoryId ?? "__none__";
    const row = byCategory.get(key) ?? {
      entries: 0,
      total: 0,
      largest: 0,
      trucks: 0,
      trips: 0,
      drivers: 0,
      overheads: 0,
    };
    row.entries += 1;
    row.total += expense.amount;
    row.largest = Math.max(row.largest, expense.amount);
    row.trucks += expense._count.truckExpenses > 0 ? 1 : 0;
    row.trips += expense._count.tripExpenses > 0 ? 1 : 0;
    row.drivers += expense._count.driverExpenses > 0 ? 1 : 0;
    row.overheads += expense.isBusinessExpense ? 1 : 0;
    byCategory.set(key, row);

    const monthKey = expense.date.toISOString().slice(0, 7);
    monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + expense.amount);
  }

  const total = round(expenses.reduce((s, e) => s + e.amount, 0));

  const rows: ExpenseCategoryRow[] = categories
    .map((category) => {
      const row = byCategory.get(category.id);
      if (!row) return null;
      return {
        category: category.name,
        kind: costKindLabel(category.kind),
        account: category.defaultAccount?.name ?? null,
        entries: row.entries,
        total: round(row.total),
        average: round(row.total / row.entries),
        largest: round(row.largest),
        share: share(row.total, total),
        againstTrucks: row.trucks,
        againstTrips: row.trips,
        againstDrivers: row.drivers,
        overheads: row.overheads,
      };
    })
    .filter((row): row is ExpenseCategoryRow => row !== null)
    .sort((a, b) => b.total - a.total);

  // Expenses whose category was deleted still spent money; they are shown
  // rather than quietly dropped, so the rows re-sum to the total.
  const orphan = byCategory.get("__none__");
  if (orphan) {
    rows.push({
      category: "Uncategorised",
      kind: "Other",
      account: null,
      entries: orphan.entries,
      total: round(orphan.total),
      average: round(orphan.total / orphan.entries),
      largest: round(orphan.largest),
      share: share(orphan.total, total),
      againstTrucks: orphan.trucks,
      againstTrips: orphan.trips,
      againstDrivers: orphan.drivers,
      overheads: orphan.overheads,
    });
  }

  const kindTotals = new Map<string, number>();
  for (const row of rows) {
    kindTotals.set(row.kind, (kindTotals.get(row.kind) ?? 0) + row.total);
  }

  return {
    from,
    to,
    total,
    entries: expenses.length,
    rows,
    byKind: Array.from(kindTotals.entries())
      .map(([kind, amount]) => ({
        kind,
        total: round(amount),
        share: share(amount, total),
      }))
      .sort((a, b) => b.total - a.total),
    monthly: Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => ({
        month: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        }),
        total: round(amount),
      })),
  };
}

// ---------------------------------------------------------------------------
// Document expiry

export interface DocumentExpiryRow {
  subject: string;
  entity: "Truck" | "Trailer" | "Driver";
  document: string;
  expiresOn: Date;
  daysRemaining: number;
  expired: boolean;
}

export interface DocumentExpiryReportData {
  asOf: Date;
  withinDays: number;
  expired: number;
  dueSoon: number;
  rows: DocumentExpiryRow[];
  /** Documents with no expiry date recorded at all — a blind spot. */
  missing: Array<{ subject: string; entity: string; document: string }>;
}

const ENTITY_LABEL: Record<ExpiryEntityType, "Truck" | "Trailer" | "Driver"> = {
  truck: "Truck",
  trailer: "Trailer",
  driver: "Driver",
};

export async function fetchDocumentExpiryReportData(
  organizationId: string,
  asOf: Date,
  withinDays = 90,
): Promise<DocumentExpiryReportData> {
  const horizon = new Date(asOf.getTime() + withinDays * 86_400_000);

  const [trucks, trailers, drivers] = await Promise.all([
    prisma.truck.findMany({
      where: { organizationId },
      select: {
        registrationNo: true,
        crossBorderInsuranceExpiration: true,
        crossBorderPermitExpiration: true,
        vehicleLicenseExpiration: true,
        certificateOfFitnessExpiration: true,
      },
    }),
    prisma.trailer.findMany({
      where: { organizationId },
      select: { registrationNo: true, licenseExpiration: true },
    }),
    prisma.driver.findMany({
      where: { organizationId },
      select: {
        firstName: true,
        lastName: true,
        licenseExpiration: true,
        passportExpiration: true,
        defenseCertificateExpiration: true,
        internationalDrivingPermitExpiration: true,
      },
    }),
  ]);

  const rows: DocumentExpiryRow[] = [];
  const missing: DocumentExpiryReportData["missing"] = [];

  // EXPIRY_FIELDS is the same registry the reminder cron walks, so a document
  // added there appears here without touching this file.
  const consider = (
    entity: ExpiryEntityType,
    subject: string,
    record: Record<string, unknown>,
  ) => {
    for (const definition of EXPIRY_FIELDS[entity]) {
      const value = record[definition.field];
      if (!(value instanceof Date)) {
        missing.push({
          subject,
          entity: ENTITY_LABEL[entity],
          document: definition.label,
        });
        continue;
      }
      if (value > horizon) continue;

      const daysRemaining = Math.ceil(
        (value.getTime() - asOf.getTime()) / 86_400_000,
      );
      rows.push({
        subject,
        entity: ENTITY_LABEL[entity],
        document: definition.label,
        expiresOn: value,
        daysRemaining,
        expired: daysRemaining < 0,
      });
    }
  };

  for (const truck of trucks) {
    consider("truck", truck.registrationNo, truck as Record<string, unknown>);
  }
  for (const trailer of trailers) {
    consider("trailer", trailer.registrationNo, trailer as Record<string, unknown>);
  }
  for (const driver of drivers) {
    consider(
      "driver",
      `${driver.firstName} ${driver.lastName}`,
      driver as Record<string, unknown>,
    );
  }

  rows.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    asOf,
    withinDays,
    expired: rows.filter((r) => r.expired).length,
    dueSoon: rows.filter((r) => !r.expired).length,
    rows,
    missing: missing.sort(
      (a, b) => a.entity.localeCompare(b.entity) || a.subject.localeCompare(b.subject),
    ),
  };
}

// ---------------------------------------------------------------------------
// Inventory valuation

export interface InventoryValuationRow {
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  quantity: number;
  minQuantity: number;
  unitCost: number | null;
  value: number;
  belowMinimum: boolean;
  location: string | null;
}

export interface InventoryValuationData {
  asOf: Date;
  from: Date;
  to: Date;
  totalValue: number;
  itemCount: number;
  belowMinimum: number;
  /** Items carrying stock but no unit cost — they value at nothing. */
  unpriced: number;
  rows: InventoryValuationRow[];
  movements: Array<{
    date: Date;
    item: string;
    type: string;
    quantity: number;
    value: number | null;
    destination: string | null;
    reason: string | null;
  }>;
  movementTotals: { in: number; out: number; inValue: number; outValue: number };
}

export async function fetchInventoryValuationData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<InventoryValuationData> {
  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { organizationId },
      select: {
        name: true,
        sku: true,
        category: true,
        unit: true,
        quantity: true,
        minQuantity: true,
        unitCost: true,
        location: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { organizationId, createdAt: { gte: from, lte: to } },
      select: {
        createdAt: true,
        type: true,
        quantity: true,
        unitCost: true,
        destination: true,
        reason: true,
        inventoryItem: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: InventoryValuationRow[] = items.map((item) => ({
    name: item.name,
    sku: item.sku,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    unitCost: item.unitCost,
    value: round((item.unitCost ?? 0) * item.quantity),
    belowMinimum: item.quantity <= item.minQuantity,
    location: item.location,
  }));

  const movementRows = movements.map((movement) => ({
    date: movement.createdAt,
    item: movement.inventoryItem.name,
    type: movement.type,
    quantity: movement.quantity,
    // The cost recorded at the time of the movement, so repricing the item
    // later does not rewrite history.
    value:
      movement.unitCost === null
        ? null
        : round(movement.unitCost * movement.quantity),
    destination: movement.destination,
    reason: movement.reason,
  }));

  return {
    asOf: to,
    from,
    to,
    totalValue: round(rows.reduce((s, r) => s + r.value, 0)),
    itemCount: rows.length,
    belowMinimum: rows.filter((r) => r.belowMinimum).length,
    unpriced: rows.filter((r) => r.unitCost === null && r.quantity > 0).length,
    rows: rows.sort((a, b) => b.value - a.value),
    movements: movementRows,
    movementTotals: {
      in: movementRows
        .filter((m) => m.type === "in")
        .reduce((s, m) => s + m.quantity, 0),
      out: movementRows
        .filter((m) => m.type === "out")
        .reduce((s, m) => s + m.quantity, 0),
      inValue: round(
        movementRows
          .filter((m) => m.type === "in")
          .reduce((s, m) => s + (m.value ?? 0), 0),
      ),
      outValue: round(
        movementRows
          .filter((m) => m.type === "out")
          .reduce((s, m) => s + (m.value ?? 0), 0),
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Trip profit and loss

export interface TripPnLRow {
  date: Date;
  route: string;
  truck: string;
  driver: string;
  customer: string;
  status: string;
  kilometres: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
  profitPerKm: number | null;
}

export interface TripPnLData {
  from: Date;
  to: Date;
  rows: TripPnLRow[];
  totals: {
    trips: number;
    kilometres: number;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number | null;
  };
  /** The five thinnest trips, which is where the money is being lost. */
  worst: TripPnLRow[];
}

export async function fetchTripPnLData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<TripPnLData> {
  const [trips, links] = await Promise.all([
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, from, to),
      select: {
        id: true,
        originCity: true,
        destinationCity: true,
        endDate: true,
        scheduledDate: true,
        status: true,
        revenue: true,
        actualMileage: true,
        estimatedMileage: true,
        truck: { select: { registrationNo: true } },
        driver: { select: { firstName: true, lastName: true } },
        customer: { select: { name: true } },
      },
      orderBy: { scheduledDate: "desc" },
    }),
    prisma.tripExpense.findMany({
      where: { expense: { organizationId } },
      select: { tripId: true, expense: { select: { id: true, amount: true } } },
    }),
  ]);

  // Costs are attributed to the trip they were booked against regardless of
  // the expense's own date: a fuel bill paid after the trip ended is still
  // that trip's cost.
  const splitCount = new Map<string, number>();
  for (const link of links) {
    splitCount.set(link.expense.id, (splitCount.get(link.expense.id) ?? 0) + 1);
  }
  const costByTrip = new Map<string, number>();
  for (const link of links) {
    costByTrip.set(
      link.tripId,
      (costByTrip.get(link.tripId) ?? 0) +
        link.expense.amount / (splitCount.get(link.expense.id) || 1),
    );
  }

  const rows: TripPnLRow[] = trips.map((trip) => {
    const revenue = round(trip.revenue || 0);
    const expenses = round(costByTrip.get(trip.id) ?? 0);
    const profit = round(revenue - expenses);
    const kilometres = trip.actualMileage ?? trip.estimatedMileage ?? 0;

    return {
      date: trip.endDate ?? trip.scheduledDate,
      route: `${trip.originCity} - ${trip.destinationCity}`,
      truck: trip.truck?.registrationNo ?? "—",
      driver: trip.driver
        ? `${trip.driver.firstName} ${trip.driver.lastName}`
        : "—",
      customer: trip.customer?.name ?? "—",
      status: trip.status,
      kilometres,
      revenue,
      expenses,
      profit,
      margin: revenue > 0 ? share(profit, revenue) : null,
      profitPerKm: kilometres > 0 ? round(profit / kilometres) : null,
    };
  });

  const revenue = round(rows.reduce((s, r) => s + r.revenue, 0));
  const expenses = round(rows.reduce((s, r) => s + r.expenses, 0));
  const profit = round(revenue - expenses);

  return {
    from,
    to,
    rows,
    totals: {
      trips: rows.length,
      kilometres: round(rows.reduce((s, r) => s + r.kilometres, 0)),
      revenue,
      expenses,
      profit,
      margin: revenue > 0 ? share(profit, revenue) : null,
    },
    worst: [...rows].sort((a, b) => a.profit - b.profit).slice(0, 5),
  };
}
