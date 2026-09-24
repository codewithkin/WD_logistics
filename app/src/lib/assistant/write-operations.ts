import "server-only";

/**
 * The operations that change data.
 *
 * Kept apart from the read ones so the difference is visible at a glance, and
 * so every entry here can be held to the same three rules:
 *
 * 1. **It calls the app's own server action**, never Prisma directly. Booking
 *    an expense by message must debit the right account, respect the approval
 *    flow and fire the same notifications as booking one on the web. The only
 *    way to guarantee that is to run the same code.
 * 2. **It states the role it needs**, and the dispatcher enforces it. A phone
 *    number is not a session.
 * 3. **It is reversible or trivial.** Deleting records and moving money
 *    between accounts are deliberately absent — those stay in the web app,
 *    where there is a confirmation dialog and an audit trail the person can
 *    see. A chat interface is the wrong place to destroy something.
 */

import { z } from "zod";
import type { PaymentMethod, TripStatus } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

/**
 * Finds a record the user referred to by name, so they can say "the Beira
 * truck" rather than a cuid. Returns a disambiguation error when the phrase
 * matches several — guessing would put an expense on the wrong truck.
 */
async function resolveOne<T extends { id: string }>(
  candidates: T[],
  label: (row: T) => string,
  what: string,
): Promise<{ ok: true; row: T } | { ok: false; error: string }> {
  if (candidates.length === 0) {
    return { ok: false, error: `No ${what} matched that.` };
  }
  if (candidates.length > 1) {
    // Callers fetch one more row than they show, so a full page means "at
    // least this many" rather than an exact count. Naming a number and then
    // listing fewer names reads as a bug to whoever is asking.
    const shown = candidates.slice(0, 5).map(label);
    const more = candidates.length > shown.length;
    return {
      ok: false,
      error: more
        ? `That matches several ${what}s: ${shown.join(", ")}, and more. Which one?`
        : `That matches ${shown.length} ${what}s: ${shown.join(", ")}. Which one?`,
    };
  }
  return { ok: true, row: candidates[0] };
}

async function findTruck(ctx: OperationContext, phrase: string) {
  const rows = await prisma.truck.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { registrationNo: { contains: phrase, mode: "insensitive" } },
        { make: { contains: phrase, mode: "insensitive" } },
        { model: { contains: phrase, mode: "insensitive" } },
      ],
    },
    select: { id: true, registrationNo: true },
    take: 6,
  });
  return resolveOne(rows, (r) => r.registrationNo, "truck");
}

async function findDriver(ctx: OperationContext, phrase: string) {
  // A driver's name is split across two columns, but nobody messaging the
  // assistant types "Mutua" when they mean Daniel Mutua. Each word is matched
  // against both columns and every word has to land somewhere, so "Daniel
  // Mutua" and "mutua daniel" both resolve while "Daniel" alone still asks.
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return resolveOne([] as Array<{ id: string; firstName: string; lastName: string }>,
      (r) => `${r.firstName} ${r.lastName}`, "driver");
  }

  const rows = await prisma.driver.findMany({
    where: {
      organizationId: ctx.organizationId,
      AND: words.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" as const } },
          { lastName: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, firstName: true, lastName: true },
    take: 6,
  });
  return resolveOne(rows, (r) => `${r.firstName} ${r.lastName}`, "driver");
}

async function findCustomer(ctx: OperationContext, phrase: string) {
  const rows = await prisma.customer.findMany({
    where: {
      organizationId: ctx.organizationId,
      name: { contains: phrase, mode: "insensitive" },
    },
    select: { id: true, name: true },
    take: 6,
  });
  return resolveOne(rows, (r) => r.name, "customer");
}

async function findCategory(ctx: OperationContext, phrase: string) {
  const rows = await prisma.expenseCategory.findMany({
    where: {
      organizationId: ctx.organizationId,
      name: { contains: phrase, mode: "insensitive" },
    },
    select: { id: true, name: true },
    take: 6,
  });
  return resolveOne(rows, (r) => r.name, "expense category");
}

export const writeOperations: Operation[] = [
  {
    name: "record_expense",
    description:
      "Record an expense. Say what it was for, the amount, and optionally which truck, trip or driver it belongs to. Money is debited from the category's account, exactly as it is on the web.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      amount: z.number().positive().describe("Amount in dollars"),
      category: z.string().describe("Expense category name, e.g. 'Fuel'"),
      description: z.string().describe("What the money was spent on"),
      truck: z.string().optional().describe("Truck registration, if it belongs to one"),
      driver: z.string().optional().describe("Driver name, if it belongs to one"),
      date: z.string().optional().describe("ISO date; defaults to today"),
      vendor: z.string().optional(),
      isBusinessExpense: z
        .boolean()
        .optional()
        .describe("True for general overheads not tied to a truck, trip or driver"),
      receiptUrl: z
        .string()
        .optional()
        .describe(
          "URL of a receipt the sender photographed. Use the one given in the message; never invent it.",
        ),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        amount: number;
        category: string;
        description: string;
        truck?: string;
        driver?: string;
        date?: string;
        vendor?: string;
        isBusinessExpense?: boolean;
        receiptUrl?: string;
      };

      const category = await findCategory(ctx, a.category);
      if (!category.ok) return { error: category.error };

      const truckIds: string[] = [];
      if (a.truck) {
        const truck = await findTruck(ctx, a.truck);
        if (!truck.ok) return { error: truck.error };
        truckIds.push(truck.row.id);
      }

      const driverIds: string[] = [];
      if (a.driver) {
        const driver = await findDriver(ctx, a.driver);
        if (!driver.ok) return { error: driver.error };
        driverIds.push(driver.row.id);
      }

      // An expense must belong to something, or be flagged as an overhead —
      // the same rule the web form enforces.
      const isBusiness =
        a.isBusinessExpense ?? (truckIds.length === 0 && driverIds.length === 0);

      const { createExpense } = await import(
        "@/app/(dashboard)/finance/expenses/actions"
      );

      // The expense form keeps its free text in `notes`; there is no separate
      // description or vendor column. Folding the vendor in rather than
      // dropping it keeps "diesel, Redan Msasa" readable on the expense list.
      const notes = a.vendor ? `${a.description} (${a.vendor})` : a.description;

      const result = await createExpense({
        categoryId: category.row.id,
        amount: a.amount,
        date: a.date ? new Date(a.date) : new Date(),
        notes,
        receiptUrl: a.receiptUrl,
        isBusinessExpense: isBusiness,
        truckIds,
        trailerIds: [],
        tripIds: [],
        driverIds,
      });

      return result.success
        ? {
            recorded: true,
            amount: a.amount,
            category: category.row.name,
            truck: a.truck ?? null,
            driver: a.driver ?? null,
            receiptAttached: Boolean(a.receiptUrl),
          }
        : { error: result.error ?? "Could not record the expense." };
    },
  },

  {
    name: "create_trip",
    description:
      "Schedule a trip. Needs a route, a truck, a driver and a date. The driver is messaged automatically, and the result of that is reported back.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      origin: z.string().describe("Origin city"),
      destination: z.string().describe("Destination city"),
      truck: z.string().describe("Truck registration"),
      driver: z.string().describe("Driver name"),
      scheduledDate: z.string().describe("ISO date the trip is scheduled for"),
      customer: z.string().optional(),
      revenue: z.number().optional().describe("Agreed price, if known"),
      estimatedMileage: z.number().optional(),
      loadDescription: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | number | undefined>;

      const truck = await findTruck(ctx, a.truck as string);
      if (!truck.ok) return { error: truck.error };
      const driver = await findDriver(ctx, a.driver as string);
      if (!driver.ok) return { error: driver.error };

      let customerId: string | undefined;
      if (a.customer) {
        const customer = await findCustomer(ctx, a.customer as string);
        if (!customer.ok) return { error: customer.error };
        customerId = customer.row.id;
      }

      const { createTrip } = await import("@/app/(dashboard)/operations/trips/actions");

      const result = await createTrip({
        originCity: a.origin as string,
        destinationCity: a.destination as string,
        truckId: truck.row.id,
        driverId: driver.row.id,
        customerId,
        scheduledDate: new Date(a.scheduledDate as string),
        estimatedMileage: (a.estimatedMileage as number) ?? 0,
        revenue: (a.revenue as number) ?? 0,
        loadDescription: a.loadDescription as string | undefined,
      });

      if (!result.success) {
        return { error: result.error ?? "Could not create the trip." };
      }

      const notify = (result as { notify?: { status: string; error?: string } }).notify;
      return {
        created: true,
        route: `${a.origin} → ${a.destination}`,
        truck: truck.row.registrationNo,
        driver: `${driver.row.firstName} ${driver.row.lastName}`,
        // Reported rather than hidden: the trip existing and the driver
        // knowing about it are two different things.
        driverMessaged: notify?.status === "sent",
        driverMessageProblem: notify?.status === "sent" ? null : notify?.error ?? null,
      };
    },
  },

  {
    name: "log_maintenance",
    description:
      "Report a fault on a truck or trailer, so the workshop sees it. Optionally assign it to a workshop worker.",
    requires: "staff",
    writes: true,
    schema: z.object({
      vehicle: z.string().describe("Truck or trailer registration"),
      notes: z.string().describe("What is wrong"),
      date: z.string().optional().describe("ISO date it is scheduled for; defaults to today"),
    }),
    handler: async (args, ctx) => {
      const a = args as { vehicle: string; notes: string; date?: string };

      const truck = await prisma.truck.findFirst({
        where: {
          organizationId: ctx.organizationId,
          registrationNo: { contains: a.vehicle, mode: "insensitive" },
        },
        select: { id: true, registrationNo: true },
      });
      const trailer = truck
        ? null
        : await prisma.trailer.findFirst({
            where: {
              organizationId: ctx.organizationId,
              registrationNo: { contains: a.vehicle, mode: "insensitive" },
            },
            select: { id: true, registrationNo: true },
          });

      if (!truck && !trailer) {
        return { error: `No truck or trailer matched "${a.vehicle}".` };
      }

      const { createMaintenanceRequest } = await import(
        "@/app/(dashboard)/maintenance/actions"
      );

      const result = await createMaintenanceRequest({
        vehicleType: truck ? "truck" : "trailer",
        vehicleId: truck ? truck.id : trailer!.id,
        notes: a.notes,
        date: a.date ? new Date(a.date) : new Date(),
      });

      return result.success
        ? {
            logged: true,
            vehicle: truck?.registrationNo ?? trailer!.registrationNo,
            notes: a.notes,
          }
        : { error: result.error ?? "Could not log the fault." };
    },
  },

  {
    name: "record_payment",
    description:
      "Record a payment received from a customer, optionally against an invoice. The invoice balance is recalculated.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      customer: z.string().describe("Customer name"),
      amount: z.number().positive(),
      method: z
        .enum(["cash", "bank_transfer", "check", "mobile_money", "other"])
        .optional()
        .describe("How it was paid; defaults to cash"),
      invoiceNumber: z.string().optional().describe("Invoice this settles, if any"),
      date: z.string().optional().describe("ISO date; defaults to today"),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, string | number | undefined>;

      const customer = await findCustomer(ctx, a.customer as string);
      if (!customer.ok) return { error: customer.error };

      let invoiceId: string | undefined;
      if (a.invoiceNumber) {
        const invoice = await prisma.invoice.findFirst({
          where: {
            organizationId: ctx.organizationId,
            invoiceNumber: { contains: a.invoiceNumber as string, mode: "insensitive" },
          },
          select: { id: true, invoiceNumber: true, customerId: true },
        });
        if (!invoice) {
          return { error: `No invoice matched "${a.invoiceNumber}".` };
        }
        if (invoice.customerId !== customer.row.id) {
          return {
            error: `Invoice ${invoice.invoiceNumber} belongs to a different customer.`,
          };
        }
        invoiceId = invoice.id;
      }

      const { createPayment } = await import(
        "@/app/(dashboard)/finance/payments/actions"
      );

      const result = await createPayment({
        customerId: customer.row.id,
        invoiceId,
        amount: a.amount as number,
        paymentDate: a.date ? new Date(a.date as string) : new Date(),
        method: (a.method as PaymentMethod | undefined) ?? "cash",
        notes: a.notes as string | undefined,
      });

      return result.success
        ? {
            recorded: true,
            customer: customer.row.name,
            amount: a.amount,
            invoice: a.invoiceNumber ?? null,
          }
        : { error: result.error ?? "Could not record the payment." };
    },
  },

  {
    name: "update_trip_status",
    description:
      "Move a trip on — mark it started, completed or cancelled. Completing a trip is what makes its revenue count.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      tripId: z.string().describe("The trip's id, from list_trips"),
      status: z
        .enum(["scheduled", "in_progress", "completed", "cancelled"])
        .describe("The new status"),
    }),
    handler: async (args, ctx) => {
      const a = args as { tripId: string; status: TripStatus };

      const trip = await prisma.trip.findFirst({
        where: { id: a.tripId, organizationId: ctx.organizationId },
        select: { id: true, originCity: true, destinationCity: true, status: true },
      });
      if (!trip) return { error: "No trip with that id." };

      const { updateTrip } = await import("@/app/(dashboard)/operations/trips/actions");

      // Goes through the same action as the web UI, which means the edit-
      // request gate applies: a non-admin's change becomes a request.
      const result = await updateTrip(
        a.tripId,
        { status: a.status },
        `Status changed to ${a.status} by ${ctx.actorName} over WhatsApp`,
      );

      const pending = (result as { pendingApproval?: boolean }).pendingApproval;
      return result.success
        ? {
            updated: !pending,
            sentForApproval: Boolean(pending),
            trip: `${trip.originCity} → ${trip.destinationCity}`,
            status: a.status,
          }
        : { error: result.error ?? "Could not update the trip." };
    },
  },

  {
    name: "notify_driver",
    description:
      "Send (or resend) the trip message to a driver, and report whether it arrived.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      tripId: z.string().describe("The trip's id, from list_trips"),
    }),
    handler: async (args, ctx) => {
      const a = args as { tripId: string };

      const trip = await prisma.trip.findFirst({
        where: { id: a.tripId, organizationId: ctx.organizationId },
        include: {
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              whatsappNumber: true,
            },
          },
          truck: { select: { registrationNo: true } },
          customer: { select: { name: true } },
          organization: { select: { name: true } },
        },
      });
      if (!trip) return { error: "No trip with that id." };

      const { driverWhatsAppNumber, sendTripMessage } = await import(
        "@/lib/whatsapp/trip-messages"
      );
      const { buildTripMessage } = await import(
        "@/app/(dashboard)/operations/trips/_lib/message-template"
      );

      const target = driverWhatsAppNumber(trip.driver);
      if (!target) {
        return {
          error: `${trip.driver.firstName} has no WhatsApp or phone number on record.`,
        };
      }

      const outcome = await sendTripMessage({
        tripId: trip.id,
        organizationId: ctx.organizationId,
        driverId: trip.driver.id,
        driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
        phone: target.number,
        message: buildTripMessage(trip),
        trigger: "manual",
      });

      return {
        status: outcome.status,
        driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
        sentTo: outcome.recipientPhone,
        problem: outcome.error ?? null,
      };
    },
  },

  {
    name: "adjust_stock",
    description:
      "Take parts out of the warehouse or put them back, with a reason. Use a negative quantity to remove.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      item: z.string().describe("Part name or number"),
      quantity: z.number().describe("Positive to add, negative to remove"),
      reason: z.string().describe("Why — this is the paper trail"),
    }),
    handler: async (args, ctx) => {
      const a = args as { item: string; quantity: number; reason: string };

      const rows = await prisma.inventoryItem.findMany({
        where: {
          organizationId: ctx.organizationId,
          OR: [
            { name: { contains: a.item, mode: "insensitive" } },
            { sku: { contains: a.item, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, quantity: true },
        take: 6,
      });
      const found = await resolveOne(rows, (r) => r.name, "part");
      if (!found.ok) return { error: found.error };

      if (a.quantity < 0 && found.row.quantity + a.quantity < 0) {
        return {
          error: `Only ${found.row.quantity} of ${found.row.name} in stock; cannot remove ${Math.abs(a.quantity)}.`,
        };
      }

      // Two separate actions rather than one with a sign, because taking
      // stock out records where it went and putting it back records where it
      // came from — different paper trails.
      const { addStock, takeOutStock } = await import(
        "@/app/(dashboard)/inventory/actions"
      );
      const attributed = `${a.reason} (by ${ctx.actorName} over WhatsApp)`;

      const result =
        a.quantity > 0
          ? await addStock({
              inventoryItemId: found.row.id,
              quantity: a.quantity,
              reason: attributed,
            })
          : await takeOutStock({
              inventoryItemId: found.row.id,
              quantity: Math.abs(a.quantity),
              destination: "Requested over WhatsApp",
              reason: attributed,
            });

      if (!result.success) {
        return { error: result.error ?? "Could not adjust the stock." };
      }

      // Read the level back rather than reporting `before + change`. If the
      // action clamped or adjusted anything, the number the driver is told is
      // the number actually on the shelf.
      const after = await prisma.inventoryItem.findUnique({
        where: { id: found.row.id },
        select: { quantity: true },
      });

      return {
        adjusted: true,
        item: found.row.name,
        change: a.quantity,
        newQuantity: after?.quantity ?? found.row.quantity + a.quantity,
      };
    },
  },
];
