import "server-only";

/**
 * Everything the WhatsApp assistant can do, and who is allowed to do it.
 *
 * The agent has no database access by design — it reaches the app over HTTP.
 * Rather than a route file per capability, this is one registry: each entry
 * declares the role it needs, the arguments it takes, and a handler that
 * calls the *same* code the web UI calls. That matters for two reasons.
 *
 * First, authorisation. A message from a phone is not a session, so every
 * operation has to state the role it requires and the dispatcher has to check
 * it against the contact's own role. Getting that wrong would hand the
 * company's finances to anyone who knows the bot's number.
 *
 * Second, correctness. Recording an expense by message has to do everything
 * recording one on the web does — debit the right account, respect the
 * approval flow, fire the notifications. Handlers therefore call the existing
 * server actions and metrics modules rather than writing to Prisma directly,
 * so the two paths cannot drift.
 *
 * Adding a capability means adding an entry here and a matching tool in
 * `agent/src/tools/app-tools.ts`.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getEarnedRevenue, getCashCollected } from "@/lib/metrics/revenue";
import { getTruckCostBreakdown, getFleetCostRanking } from "@/lib/metrics/truck-costs";
import { getDriverPerformance } from "@/lib/metrics/driver-snapshots";
import { getDateRangeFromParams } from "@/lib/period-utils";

/** Roles, weakest first. A contact may run anything at or below their level. */
const ROLE_RANK: Record<string, number> = {
  readonly: 0,
  staff: 1,
  supervisor: 2,
  admin: 3,
};

export function roleAllows(contactRole: string, required: string): boolean {
  return (ROLE_RANK[contactRole] ?? -1) >= (ROLE_RANK[required] ?? 99);
}

/**
 * The weaker of two roles.
 *
 * A contact's role and their dashboard account's role are set in different
 * places by different people. Whichever grants less is the one that counts, so
 * a generous entry on the contact list can never hand somebody more than their
 * login already gives them.
 */
export function weakerRole(a: string, b: string): string {
  return (ROLE_RANK[a] ?? -1) <= (ROLE_RANK[b] ?? -1) ? a : b;
}

/**
 * Whether this caller may see money at all.
 *
 * Settings tells an admin that the `readonly` level "changes nothing, sees no
 * money", and that is the promise the person granting it is relying on. It was
 * not true: `list_trips` returned each trip's revenue and `list_customers`
 * returned each customer's outstanding balance, so a yard hand could ask for
 * the month's trips and add them up. Hiding the financial *tools* is not
 * enough when an operational tool carries the figures.
 *
 * Staff and above keep these — staff are promised invoices, supervisors record
 * payments, and neither is possible without amounts. The heavier financial
 * operations (summary, truck costs, fleet ranking, driver performance) stay
 * admin-only, matching lib/permissions.canViewFinancialData.
 */
function seesMoney(role: string): boolean {
  return role !== "readonly";
}

export interface OperationContext {
  organizationId: string;
  /** The contact's role, already resolved from their phone number. */
  role: string;
  /** Their name, for attributing writes. */
  actorName: string;
  /** Linked dashboard user, where the admin has connected one. */
  actorUserId: string | null;
}

export interface Operation {
  name: string;
  description: string;
  /** Minimum role. */
  requires: "readonly" | "staff" | "supervisor" | "admin";
  /** True when it changes data — used for the audit flag and confirmations. */
  writes?: boolean;
  schema: z.ZodTypeAny;
  handler: (
    args: Record<string, unknown>,
    ctx: OperationContext,
  ) => Promise<unknown>;
}

/** Resolves a period phrase the same way every screen does. */
function resolveRange(period?: string, from?: string, to?: string) {
  return getDateRangeFromParams({ period, from, to }, "1m");
}

const periodArgs = {
  period: z
    .string()
    .optional()
    .describe(
      'Period preset: "7d", "1m", "3m", "6m", "1y", "ytd", "all", or "<n>d|w|m|y". Defaults to 1m.',
    ),
  from: z.string().optional().describe("ISO start date, if an exact range is wanted"),
  to: z.string().optional().describe("ISO end date"),
};

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const readOperations: Operation[] = [
  {
    name: "list_trucks",
    description:
      "List trucks with their status, assigned driver and mileage. Optionally filter by status or search text.",
    requires: "readonly",
    schema: z.object({
      status: z.string().optional().describe("active, in_service, in_repair, inactive, decommissioned"),
      search: z.string().optional().describe("Match on registration, make or model"),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const { status, search, limit } = args as {
        status?: string;
        search?: string;
        limit?: number;
      };
      return prisma.truck.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { registrationNo: { contains: search, mode: "insensitive" } },
                  { make: { contains: search, mode: "insensitive" } },
                  { model: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          registrationNo: true,
          make: true,
          model: true,
          year: true,
          status: true,
          currentMileage: true,
          assignedDriver: { select: { firstName: true, lastName: true } },
        },
        orderBy: { registrationNo: "asc" },
        take: Math.min(limit ?? 20, 50),
      });
    },
  },

  {
    name: "list_drivers",
    description: "List drivers with their status, phone and current truck.",
    requires: "readonly",
    schema: z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const { status, search, limit } = args as {
        status?: string;
        search?: string;
        limit?: number;
      };
      return prisma.driver.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          licenseNumber: true,
          licenseExpiration: true,
          assignedTruck: { select: { registrationNo: true } },
        },
        orderBy: { firstName: "asc" },
        take: Math.min(limit ?? 20, 50),
      });
    },
  },

  {
    name: "list_trips",
    description:
      "List trips in a period, optionally filtered by status, truck, driver or customer.",
    requires: "readonly",
    schema: z.object({
      ...periodArgs,
      status: z.string().optional().describe("scheduled, in_progress, completed, cancelled"),
      truckId: z.string().optional(),
      driverId: z.string().optional(),
      customerId: z.string().optional(),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | number | undefined>;
      const range = resolveRange(a.period as string, a.from as string, a.to as string);
      const trips = await prisma.trip.findMany({
        where: {
          organizationId: ctx.organizationId,
          scheduledDate: { gte: range.from, lte: range.to },
          ...(a.status ? { status: a.status as string } : {}),
          ...(a.truckId ? { truckId: a.truckId as string } : {}),
          ...(a.driverId ? { driverId: a.driverId as string } : {}),
          ...(a.customerId ? { customerId: a.customerId as string } : {}),
        },
        select: {
          id: true,
          originCity: true,
          destinationCity: true,
          scheduledDate: true,
          status: true,
          revenue: true,
          driverNotified: true,
          truck: { select: { registrationNo: true } },
          driver: { select: { firstName: true, lastName: true } },
          customer: { select: { name: true } },
        },
        orderBy: { scheduledDate: "desc" },
        take: Math.min((a.limit as number) ?? 20, 50),
      });

      if (seesMoney(ctx.role)) return trips;
      // The key is omitted rather than zeroed: a zero reads as "this trip
      // earned nothing", which is worse than it plainly not being there.
      return trips.map((trip) => ({
        id: trip.id,
        originCity: trip.originCity,
        destinationCity: trip.destinationCity,
        scheduledDate: trip.scheduledDate,
        status: trip.status,
        driverNotified: trip.driverNotified,
        truck: trip.truck,
        driver: trip.driver,
        customer: trip.customer,
      }));
    },
  },

  {
    name: "list_customers",
    description:
      "List customers. Their outstanding balance is included for staff and above.",
    requires: "readonly",
    schema: z.object({
      search: z.string().optional(),
      owingOnly: z.boolean().optional().describe("Only those who owe money"),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const a = args as { search?: string; owingOnly?: boolean; limit?: number };
      const customers = await prisma.customer.findMany({
        where: {
          organizationId: ctx.organizationId,
          // "Who owes us" is itself a financial question; for a readonly
          // caller the filter is ignored rather than answered indirectly.
          ...(a.owingOnly && seesMoney(ctx.role) ? { balance: { gt: 0 } } : {}),
          ...(a.search
            ? { name: { contains: a.search, mode: "insensitive" } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          balance: true,
          status: true,
        },
        orderBy: { name: "asc" },
        take: Math.min(a.limit ?? 20, 50),
      });

      if (seesMoney(ctx.role)) return customers;
      return customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        status: customer.status,
      }));
    },
  },

  {
    name: "list_invoices",
    description: "List invoices, optionally only unpaid or overdue ones.",
    requires: "staff",
    schema: z.object({
      ...periodArgs,
      status: z.string().optional(),
      unpaidOnly: z.boolean().optional(),
      customerId: z.string().optional(),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | number | boolean | undefined>;
      const range = resolveRange(a.period as string, a.from as string, a.to as string);
      return prisma.invoice.findMany({
        where: {
          organizationId: ctx.organizationId,
          issueDate: { gte: range.from, lte: range.to },
          ...(a.status ? { status: a.status as string } : {}),
          ...(a.unpaidOnly ? { balance: { gt: 0 } } : {}),
          ...(a.customerId ? { customerId: a.customerId as string } : {}),
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          balance: true,
          status: true,
          issueDate: true,
          dueDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { issueDate: "desc" },
        take: Math.min((a.limit as number) ?? 20, 50),
      });
    },
  },

  {
    name: "list_maintenance",
    description: "Workshop jobs — open, assigned, in progress or fixed.",
    requires: "readonly",
    schema: z.object({
      status: z.string().optional(),
      openOnly: z.boolean().optional().default(true),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const a = args as { status?: string; openOnly?: boolean; limit?: number };
      return prisma.maintenanceRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(a.status
            ? { status: a.status }
            : a.openOnly !== false
              ? { status: { in: ["open", "assigned", "in_progress"] } }
              : {}),
        },
        select: {
          id: true,
          notes: true,
          date: true,
          status: true,
          fixedNotes: true,
          truck: { select: { registrationNo: true } },
          trailer: { select: { registrationNo: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: Math.min(a.limit ?? 20, 50),
      });
    },
  },

  {
    name: "list_inventory",
    description: "Parts in the warehouse, with quantities and reorder levels.",
    requires: "readonly",
    schema: z.object({
      lowStockOnly: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().optional().default(20),
    }),
    handler: async (args, ctx) => {
      const a = args as { lowStockOnly?: boolean; search?: string; limit?: number };
      const items = await prisma.inventoryItem.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(a.search
            ? {
                OR: [
                  { name: { contains: a.search, mode: "insensitive" } },
                  { sku: { contains: a.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          minQuantity: true,
          unit: true,
          location: true,
        },
        orderBy: { name: "asc" },
        take: Math.min(a.limit ?? 20, 50),
      });
      // "Low stock" compares two columns, which Prisma cannot express in a
      // where clause; filter after fetching.
      return a.lowStockOnly
        ? items.filter((item) => item.quantity <= item.minQuantity)
        : items;
    },
  },

  {
    name: "get_financial_summary",
    description:
      "Revenue, cash collected, expenses and profit for a period. The headline numbers.",
    requires: "admin",
    schema: z.object(periodArgs),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | undefined>;
      const range = resolveRange(a.period, a.from, a.to);
      const [revenue, cash, expenses, outstanding] = await Promise.all([
        getEarnedRevenue(ctx.organizationId, range.from, range.to),
        getCashCollected(ctx.organizationId, range.from, range.to),
        prisma.expense.aggregate({
          where: {
            organizationId: ctx.organizationId,
            date: { gte: range.from, lte: range.to },
          },
          _sum: { amount: true },
        }),
        prisma.invoice.aggregate({
          where: { organizationId: ctx.organizationId, balance: { gt: 0 } },
          _sum: { balance: true },
        }),
      ]);
      const totalExpenses = expenses._sum.amount ?? 0;
      return {
        period: range.label,
        // Both measures, labelled — the whole point of lib/metrics/revenue.
        revenueEarned: money(revenue),
        cashCollected: money(cash),
        expenses: money(totalExpenses),
        profit: money(revenue - totalExpenses),
        margin: revenue > 0 ? `${(((revenue - totalExpenses) / revenue) * 100).toFixed(1)}%` : "n/a",
        outstandingFromCustomers: money(outstanding._sum.balance ?? 0),
      };
    },
  },

  {
    name: "get_expense_breakdown",
    description:
      "What the company spent in a period, broken down by expense category and by cost type (fuel, maintenance, tyres, tolls, salaries...). Use this to compare spending between categories — it answers in one call.",
    requires: "admin",
    schema: z.object({ ...periodArgs }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | undefined>;
      const range = resolveRange(a.period, a.from, a.to);

      // The same figures the "Expenses by Category" report prints, so the
      // number quoted over WhatsApp and the number on the PDF are one number.
      const { fetchExpenseCategoryReportData } = await import(
        "@/lib/reports/operations-fetchers"
      );
      const data = await fetchExpenseCategoryReportData(
        ctx.organizationId,
        range.from,
        range.to,
      );

      return {
        period: range.label,
        total: money(data.total),
        entries: data.entries,
        byCostType: data.byKind.map((k) => ({
          type: k.kind,
          amount: money(k.total),
          share: `${k.share.toFixed(1)}%`,
        })),
        byCategory: data.rows.slice(0, 15).map((r) => ({
          category: r.category,
          type: r.kind,
          amount: money(r.total),
          share: `${r.share.toFixed(1)}%`,
        })),
      };
    },
  },

  {
    name: "get_truck_costs",
    description:
      "Where one truck's money goes: category breakdown, fuel per km, workshop downtime, against the fleet average. Answers 'is this truck losing money and why'.",
    requires: "admin",
    schema: z.object({
      truckId: z.string().describe("The truck's id, from list_trucks"),
      ...periodArgs,
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | undefined>;
      const range = resolveRange(a.period, a.from, a.to);
      const b = await getTruckCostBreakdown(ctx.organizationId, a.truckId!, {
        from: range.from,
        to: range.to,
      });
      return {
        period: range.label,
        revenue: money(b.revenue),
        expenses: money(b.expenses),
        profit: money(b.profit),
        margin: b.margin === null ? "n/a" : `${b.margin}%`,
        trips: b.trips,
        kilometres: b.kilometres,
        costPerKm: b.costPerKm === null ? "n/a" : money(b.costPerKm),
        fleetAverageCostPerKm:
          b.fleet.averageCostPerKm === null ? "n/a" : money(b.fleet.averageCostPerKm),
        fuelPerKm: b.fuelPerKm === null ? "n/a" : money(b.fuelPerKm),
        fleetAverageFuelPerKm:
          b.fleet.averageFuelPerKm === null ? "n/a" : money(b.fleet.averageFuelPerKm),
        daysOutOfService: b.downtimeDays,
        openWorkshopJobs: b.openJobs,
        topCategories: b.byCategory.slice(0, 6).map((c) => ({
          category: c.category,
          amount: money(c.amount),
          shareOfThisTruck: `${c.share}%`,
          fleetShare: `${c.fleetShare}%`,
          aboveFleetAverage: c.aboveFleetAverage,
        })),
      };
    },
  },

  {
    name: "get_fleet_ranking",
    description:
      "Every truck ranked by profit, worst first, with the category each over-spends on. Answers 'which truck is the problem'.",
    requires: "admin",
    schema: z.object(periodArgs),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | undefined>;
      const range = resolveRange(a.period, a.from, a.to);
      const rows = await getFleetCostRanking(ctx.organizationId, {
        from: range.from,
        to: range.to,
      });
      return {
        period: range.label,
        trucks: rows.map((row) => ({
          truck: row.registrationNo,
          revenue: money(row.revenue),
          expenses: money(row.expenses),
          profit: money(row.profit),
          costPerKm: row.costPerKm === null ? "n/a" : money(row.costPerKm),
          overSpendsOn: row.worstCategory
            ? `${row.worstCategory.name} (${row.worstCategory.share}% vs fleet ${row.worstCategory.fleetShare}%)`
            : null,
        })),
      };
    },
  },

  {
    name: "get_driver_performance",
    description:
      "A driver's earnings split by the trucks they had, with a cumulative total. Answers 'what has this driver generated'.",
    requires: "admin",
    schema: z.object({
      driverId: z.string().describe("The driver's id, from list_drivers"),
      ...periodArgs,
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | undefined>;
      const range = resolveRange(a.period ?? "3m", a.from, a.to);
      const p = await getDriverPerformance(ctx.organizationId, a.driverId!, {
        from: range.from,
        to: range.to,
      });
      return {
        period: range.label,
        currentTruck: p.current?.registrationNo ?? null,
        cumulative: {
          trips: p.cumulative.trips,
          revenue: money(p.cumulative.revenue),
          expenses: money(p.cumulative.expenses),
          profit: money(p.cumulative.profit),
        },
        byTruck: p.snapshots.map((s) => ({
          truck: s.registrationNo,
          from: s.clippedFrom.toISOString().split("T")[0],
          to: s.endDate ? s.clippedTo.toISOString().split("T")[0] : "present",
          trips: s.trips,
          revenue: money(s.revenue),
          expenses: money(s.expenses),
          profit: money(s.profit),
        })),
      };
    },
  },

  {
    name: "get_account_balances",
    description: "The three account balances: cash, bank and petty cash.",
    requires: "supervisor",
    schema: z.object({}),
    handler: async (_args, ctx) => {
      const accounts = await prisma.financialAccount.findMany({
        where: { organizationId: ctx.organizationId },
        select: { name: true, type: true, balance: true },
        orderBy: { name: "asc" },
      });
      return accounts.map((a) => ({ ...a, balance: money(a.balance) }));
    },
  },

  {
    name: "get_expiring_documents",
    description:
      "Licences, permits, insurance and certificates expiring soon, across trucks, trailers and drivers.",
    requires: "readonly",
    schema: z.object({
      withinDays: z.number().optional().default(60),
    }),
    handler: async (args, ctx) => {
      const days = ((args as { withinDays?: number }).withinDays ?? 60);
      const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const now = new Date();

      const [trucks, trailers, drivers] = await Promise.all([
        prisma.truck.findMany({
          where: {
            organizationId: ctx.organizationId,
            OR: [
              { crossBorderInsuranceExpiration: { lte: cutoff } },
              { crossBorderPermitExpiration: { lte: cutoff } },
              { vehicleLicenseExpiration: { lte: cutoff } },
              { certificateOfFitnessExpiration: { lte: cutoff } },
            ],
          },
          select: {
            registrationNo: true,
            crossBorderInsuranceExpiration: true,
            crossBorderPermitExpiration: true,
            vehicleLicenseExpiration: true,
            certificateOfFitnessExpiration: true,
          },
        }),
        prisma.trailer.findMany({
          where: {
            organizationId: ctx.organizationId,
            licenseExpiration: { lte: cutoff },
          },
          select: { registrationNo: true, licenseExpiration: true },
        }),
        prisma.driver.findMany({
          where: {
            organizationId: ctx.organizationId,
            OR: [
              { licenseExpiration: { lte: cutoff } },
              { passportExpiration: { lte: cutoff } },
              { defenseCertificateExpiration: { lte: cutoff } },
              { internationalDrivingPermitExpiration: { lte: cutoff } },
            ],
          },
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

      // Flatten into one list the model can read out, marking what has already
      // lapsed rather than lumping it in with "expiring".
      const rows: Array<{ subject: string; document: string; expires: string; expired: boolean }> = [];
      const add = (subject: string, document: string, date: Date | null) => {
        if (!date || date > cutoff) return;
        rows.push({
          subject,
          document,
          expires: date.toISOString().split("T")[0],
          expired: date < now,
        });
      };

      for (const t of trucks) {
        add(t.registrationNo, "Cross-border insurance", t.crossBorderInsuranceExpiration);
        add(t.registrationNo, "Cross-border permit", t.crossBorderPermitExpiration);
        add(t.registrationNo, "Vehicle licence", t.vehicleLicenseExpiration);
        add(t.registrationNo, "Certificate of fitness", t.certificateOfFitnessExpiration);
      }
      for (const t of trailers) add(t.registrationNo, "Trailer licence", t.licenseExpiration);
      for (const d of drivers) {
        const name = `${d.firstName} ${d.lastName}`;
        add(name, "Driving licence", d.licenseExpiration);
        add(name, "Passport", d.passportExpiration);
        add(name, "Defensive driving", d.defenseCertificateExpiration);
        add(name, "International permit", d.internationalDrivingPermitExpiration);
      }

      return rows.sort((a, b) => a.expires.localeCompare(b.expires));
    },
  },
];

// Writes live in their own module so the boundary stays visible; they are
// concatenated here because the dispatcher and manifest want one list.
import { writeOperations } from "@/lib/assistant/write-operations";
import { adminOperations } from "@/lib/assistant/admin-operations";
import { crudOperations } from "@/lib/assistant/crud-operations";
import { reportOperations } from "@/lib/assistant/report-operations";
import { messagingOperations } from "@/lib/assistant/messaging-operations";

export const OPERATIONS: Operation[] = [
  ...readOperations,
  ...writeOperations,
  ...adminOperations,
  ...crudOperations,
  ...reportOperations,
  ...messagingOperations,
];

export function findOperation(name: string): Operation | undefined {
  return OPERATIONS.find((operation) => operation.name === name);
}

/** The manifest the agent turns into Mastra tools. */
export function operationManifest(role: string) {
  return OPERATIONS.filter((operation) => roleAllows(role, operation.requires)).map(
    (operation) => ({
      name: operation.name,
      description: operation.description,
      writes: Boolean(operation.writes),
      // `io: "input"` matters. A field written `z.number().optional().default(20)`
      // is optional going in and guaranteed coming out, and the default
      // ("output") view marks it **required** — so every list tool advertised
      // `limit` as mandatory. A model that omitted it had its tool call
      // rejected by the agent's own validation, which killed the whole turn
      // rather than the one call. One model happened always to send `limit`
      // and another did not; that was luck, not correctness.
      schema: z.toJSONSchema(operation.schema, { io: "input" }),
    }),
  );
}
