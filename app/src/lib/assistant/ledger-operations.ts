import "server-only";

/**
 * The rest of what the web app can do, over the assistant.
 *
 * Accounts, expense categories, employees, and the changes and removals that
 * had no operation — a trip's details beyond its status, a trailer's record,
 * an expense after it was entered, a part put on a truck, a workshop job
 * started, a request withdrawn.
 *
 * As everywhere else here: the web app's own server action does the work, so
 * the edit-request gate, the account movements and the notifications are the
 * ones already written and tested. Records are found by name, and an
 * ambiguous name is a question rather than a guess.
 *
 * **What is deliberately not here**, because the reason matters more than the
 * count:
 *
 *  - **Wiping the organisation's data.** Irreversible, and there is no
 *    "type the name to confirm" over a message.
 *  - **The company's own letterhead, bank details and VAT number.** A typo
 *    goes onto every invoice from then on, and nobody proofreads a phone.
 *  - **The assistant's own contact list.** Granting assistant access through
 *    the assistant is a way to widen access without anyone at a keyboard
 *    noticing.
 *  - **An account's starting balance.** Not an operation — a correction of
 *    the books, which should be made where it can be seen alongside the
 *    ledger it rewrites.
 *
 * Each of those stays in the web app, for admins, as it is.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

async function resolveOne<T extends { id: string }>(
  rows: T[],
  label: (row: T) => string,
  what: string,
): Promise<{ ok: true; row: T } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: false, error: `No ${what} matched that.` };
  if (rows.length > 1) {
    const shown = rows.slice(0, 5).map(label);
    return {
      ok: false,
      error: `That matches ${rows.length} ${what}s: ${shown.join("; ")}${
        rows.length > shown.length ? ", and more" : ""
      }. Which one?`,
    };
  }
  return { ok: true, row: rows[0] };
}

function words(phrase: string, fields: string[]) {
  return {
    AND: phrase
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({
        OR: fields.map((field) => ({
          [field]: { contains: word, mode: "insensitive" as const },
        })),
      })),
  };
}

function whyOverWhatsApp(reason: string, ctx: OperationContext): string {
  const said = (reason ?? "").trim();
  return said
    ? `${said} (${ctx.actorName}, over WhatsApp)`
    : `Changed by ${ctx.actorName} over WhatsApp`;
}

function given<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const findTruck = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.truck.findMany({
      where: { organizationId: ctx.organizationId, ...words(phrase, ["registrationNo", "make", "model"]) },
      select: { id: true, registrationNo: true },
      take: 6,
    }),
    (row) => row.registrationNo,
    "truck",
  );

const findTrailer = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.trailer.findMany({
      where: { organizationId: ctx.organizationId, ...words(phrase, ["registrationNo", "make", "model"]) },
      select: { id: true, registrationNo: true },
      take: 6,
    }),
    (row) => row.registrationNo,
    "trailer",
  );

const findDriver = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.driver.findMany({
      where: { organizationId: ctx.organizationId, ...words(phrase, ["firstName", "lastName", "phone"]) },
      select: { id: true, firstName: true, lastName: true },
      take: 6,
    }),
    (row) => `${row.firstName} ${row.lastName}`,
    "driver",
  );

const findEmployee = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.employee.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...words(phrase, ["firstName", "lastName", "phone", "position"]),
      },
      select: { id: true, firstName: true, lastName: true, position: true },
      take: 6,
    }),
    (row) => `${row.firstName} ${row.lastName} (${row.position})`,
    "employee",
  );

const findCategory = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.expenseCategory.findMany({
      where: { organizationId: ctx.organizationId, ...words(phrase, ["name"]) },
      select: { id: true, name: true },
      take: 6,
    }),
    (row) => row.name,
    "expense category",
  );

const findItem = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.inventoryItem.findMany({
      where: { organizationId: ctx.organizationId, ...words(phrase, ["name", "sku", "category"]) },
      select: { id: true, name: true, quantity: true },
      take: 6,
    }),
    (row) => `${row.name} (${row.quantity} in stock)`,
    "stock item",
  );

const findSupplier = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.supplier.findMany({
      where: { organizationId: ctx.organizationId, ...words(phrase, ["name", "contactPerson"]) },
      select: { id: true, name: true, balance: true },
      take: 6,
    }),
    (row) => row.name,
    "supplier",
  );

/** A trip, by route and optionally date — there is no trip number to quote. */
async function findTrip(ctx: OperationContext, phrase: string, on?: string) {
  const parts = phrase
    .split(/\s+|→|->|\bto\b/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  const date = on ? new Date(on) : null;
  const onDay =
    date && !Number.isNaN(date.getTime())
      ? {
          scheduledDate: {
            gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
          },
        }
      : {};

  const rows = await prisma.trip.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...onDay,
      ...(parts.length > 0
        ? {
            AND: parts.map((part) => ({
              OR: [
                { originCity: { contains: part, mode: "insensitive" as const } },
                { destinationCity: { contains: part, mode: "insensitive" as const } },
              ],
            })),
          }
        : {}),
    },
    select: { id: true, originCity: true, destinationCity: true, scheduledDate: true },
    orderBy: { scheduledDate: "desc" },
    take: 6,
  });

  return resolveOne(
    rows,
    (row) => `${row.originCity} to ${row.destinationCity} on ${day(row.scheduledDate)}`,
    "trip",
  );
}

/** An expense, by what it was for, the supplier, or the category. */
async function findExpense(ctx: OperationContext, phrase: string) {
  const rows = await prisma.expense.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { description: { contains: phrase, mode: "insensitive" } },
        { notes: { contains: phrase, mode: "insensitive" } },
        { vendor: { contains: phrase, mode: "insensitive" } },
        { category: { name: { contains: phrase, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      amount: true,
      date: true,
      description: true,
      category: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 6,
  });
  return resolveOne(
    rows,
    (row) =>
      `${money(row.amount)} on ${day(row.date)} — ${row.description ?? row.category.name}`,
    "expense",
  );
}

/**
 * For the actions that return nothing.
 *
 * The expense-category actions revalidate and fall off the end — they signal
 * failure by throwing a UserFacingError, which the dispatcher turns into a
 * message. Reading `.success` off `void` would be quietly always-falsy, so
 * these are wrapped instead.
 */
async function attempt<T>(
  run: () => Promise<T>,
  onSuccess: () => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    await run();
    return onSuccess();
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "That could not be done.",
    };
  }
}

export const ledgerOperations: Operation[] = [
  // ---------------------------------------------------------------- accounts
  {
    name: "record_money_out",
    description:
      "Take money out of an account — cash handed over, a withdrawal. Needs a short note saying what it is for.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      account: z.enum(ACCOUNT_TYPES),
      amount: z.number().positive(),
      description: z.string().describe("What the money is for. A few words is enough."),
    }),
    handler: async (args) => {
      const a = args as { account: string; amount: number; description: string };
      const { recordAccountMovementAction } = await import(
        "@/app/(dashboard)/finance/accounts/actions"
      );
      const result = await recordAccountMovementAction({
        accountType: a.account as never,
        direction: "withdrawal",
        amount: a.amount,
        description: a.description,
      });
      return result.success
        ? { recorded: true, account: a.account, out: money(a.amount) }
        : { error: result.error ?? "Could not record that." };
    },
  },
  {
    name: "record_money_in",
    description:
      "Put money into an account. Admin only — it is the one movement with no paper trail behind it.",
    requires: "admin",
    writes: true,
    schema: z.object({
      account: z.enum(ACCOUNT_TYPES),
      amount: z.number().positive(),
      description: z.string().describe("Where the money came from"),
    }),
    handler: async (args) => {
      const a = args as { account: string; amount: number; description: string };
      const { recordAccountMovementAction } = await import(
        "@/app/(dashboard)/finance/accounts/actions"
      );
      const result = await recordAccountMovementAction({
        accountType: a.account as never,
        direction: "deposit",
        amount: a.amount,
        description: a.description,
      });
      return result.success
        ? { recorded: true, account: a.account, in: money(a.amount) }
        : { error: result.error ?? "Could not record that." };
    },
  },
  {
    name: "transfer_between_accounts",
    description:
      "Move money between cash and petty cash. Transfers involving the bank are web-only.",
    requires: "admin",
    writes: true,
    schema: z.object({
      from: z.enum(ACCOUNT_TYPES),
      to: z.enum(ACCOUNT_TYPES),
      amount: z.number().positive(),
      description: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as { from: string; to: string; amount: number; description?: string };
      const { transferFundsAction } = await import(
        "@/app/(dashboard)/finance/accounts/actions"
      );
      const result = await transferFundsAction({
        fromType: a.from as never,
        toType: a.to as never,
        amount: a.amount,
        description: a.description,
      });
      return result.success
        ? { transferred: money(a.amount), from: a.from, to: a.to }
        : { error: result.error ?? "Could not make the transfer." };
    },
  },

  // -------------------------------------------------------- expense categories
  {
    name: "create_expense_category",
    description:
      "Add an expense category. Say what it can be booked against — trucks, trips, drivers — and what kind of cost it is.",
    requires: "admin",
    writes: true,
    schema: z.object({
      name: z.string(),
      description: z.string().optional(),
      againstTrucks: z.boolean().optional().describe("Can be booked against a truck"),
      againstTrips: z.boolean().optional(),
      againstDrivers: z.boolean().optional(),
      kind: z
        .enum(["fuel", "maintenance", "tyres", "tolls", "permits", "salaries", "other"])
        .optional()
        .describe("What kind of cost. Drives the fuel and downtime figures on reports."),
    }),
    handler: async (args) => {
      const a = args as {
        name: string;
        description?: string;
        againstTrucks?: boolean;
        againstTrips?: boolean;
        againstDrivers?: boolean;
        kind?: string;
      };
      const { createExpenseCategory } = await import(
        "@/app/(dashboard)/finance/expense-categories/actions"
      );
      return attempt(
        () =>
          createExpenseCategory({
            name: a.name,
            description: a.description,
            isTruck: a.againstTrucks ?? true,
            isTrip: a.againstTrips ?? true,
            isDriver: a.againstDrivers ?? false,
            kind: a.kind ?? null,
          }),
        () => ({ created: true, category: a.name }),
      );
    },
  },
  {
    name: "update_expense_category",
    description: "Change an expense category — its name, what it can be booked against, its kind.",
    requires: "admin",
    writes: true,
    schema: z.object({
      category: z.string().describe("The category to change"),
      name: z.string().optional(),
      description: z.string().optional(),
      againstTrucks: z.boolean().optional(),
      againstTrips: z.boolean().optional(),
      againstDrivers: z.boolean().optional(),
      kind: z
        .enum(["fuel", "maintenance", "tyres", "tolls", "permits", "salaries", "other"])
        .optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, unknown> & { category: string };
      const found = await findCategory(ctx, a.category);
      if (!found.ok) return { error: found.error };

      // The action takes the whole form, so the unchanged fields come from
      // the record as it stands rather than being blanked.
      const current = await prisma.expenseCategory.findUnique({
        where: { id: found.row.id },
        select: {
          name: true,
          description: true,
          isTruck: true,
          isTrip: true,
          isDriver: true,
          color: true,
          icon: true,
          defaultAccountId: true,
          kind: true,
        },
      });
      if (!current) return { error: "That category no longer exists." };

      const { updateExpenseCategory } = await import(
        "@/app/(dashboard)/finance/expense-categories/actions"
      );
      return attempt(
        () =>
          updateExpenseCategory(found.row.id, {
            name: (a.name as string) ?? current.name,
            description: (a.description as string) ?? current.description ?? undefined,
            isTruck: (a.againstTrucks as boolean) ?? current.isTruck,
            isTrip: (a.againstTrips as boolean) ?? current.isTrip,
            isDriver: (a.againstDrivers as boolean) ?? current.isDriver,
            color: current.color ?? undefined,
            icon: current.icon ?? undefined,
            defaultAccountId: current.defaultAccountId,
            kind: (a.kind as string) ?? current.kind,
          }),
        () => ({ updated: true, category: (a.name as string) ?? found.row.name }),
      );
    },
  },
  {
    name: "delete_expense_category",
    description:
      "Remove an expense category. Refused while expenses are still filed under it.",
    requires: "admin",
    writes: true,
    schema: z.object({ category: z.string() }),
    handler: async (args, ctx) => {
      const a = args as { category: string };
      const found = await findCategory(ctx, a.category);
      if (!found.ok) return { error: found.error };

      const { deleteExpenseCategory } = await import(
        "@/app/(dashboard)/finance/expense-categories/actions"
      );
      return attempt(
        () => deleteExpenseCategory(found.row.id),
        () => ({ deleted: true, category: found.row.name }),
      );
    },
  },

  // --------------------------------------------------------------- employees
  {
    name: "create_employee",
    description: "Add an employee — office or yard staff, not a driver and not a login.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      position: z.string().describe("Job title, e.g. 'Workshop foreman'"),
      department: z.string().optional(),
      email: z.string().optional(),
      startDate: z.string().optional().describe("ISO date. Defaults to today."),
      notes: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as Record<string, string | undefined> & {
        firstName: string;
        lastName: string;
        phone: string;
        position: string;
      };
      const { createEmployee } = await import("@/app/(dashboard)/employees/actions");
      const result = await createEmployee({
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        position: a.position,
        department: a.department,
        email: a.email,
        startDate: a.startDate ? new Date(a.startDate) : new Date(),
        status: "active" as never,
        notes: a.notes,
      });
      return result.success
        ? { created: true, employee: `${a.firstName} ${a.lastName}` }
        : { error: (result as { error?: string }).error ?? "Could not add the employee." };
    },
  },
  {
    name: "update_employee",
    description: "Change an employee's details. Only the fields you give are touched.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      employee: z.string().describe("Name, phone or position of the employee"),
      reason: z
        .string()
        .describe("Why the change is wanted. Filed as an edit request for anyone but an admin."),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      position: z.string().optional(),
      department: z.string().optional(),
      status: z.enum(["active", "on_leave", "terminated"]).optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const { employee: phrase, reason, ...rest } = args as {
        employee: string;
        reason: string;
      } & Record<string, string | undefined>;
      const found = await findEmployee(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const { updateEmployee } = await import("@/app/(dashboard)/employees/actions");
      const result = await updateEmployee(
        found.row.id,
        given(rest) as never,
        whyOverWhatsApp(reason, ctx),
      );
      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the employee." };
      }
      return {
        ...(result as Record<string, unknown>),
        employee: `${found.row.firstName} ${found.row.lastName}`,
      };
    },
  },
  {
    name: "delete_employee",
    description: "Remove an employee's record.",
    requires: "admin",
    writes: true,
    schema: z.object({
      employee: z.string(),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as { employee: string; reason?: string };
      const found = await findEmployee(ctx, a.employee);
      if (!found.ok) return { error: found.error };

      const { deleteEmployee } = await import("@/app/(dashboard)/employees/actions");
      const result = await deleteEmployee(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? { deleted: true, employee: `${found.row.firstName} ${found.row.lastName}` }
        : { error: (result as { error?: string }).error ?? "Could not remove the employee." };
    },
  },

  // ---------------------------------------------------------------- expenses
  {
    name: "update_expense",
    description:
      "Change an expense already recorded — its amount, date, or what it was for. The account it was paid from is adjusted to match.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      expense: z.string().describe("What it was for, the supplier, or the category"),
      reason: z
        .string()
        .describe("Why the change is wanted. Filed as an edit request for anyone but an admin."),
      amount: z.number().positive().optional(),
      date: z.string().optional().describe("ISO date"),
      description: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        expense: string;
        reason: string;
        amount?: number;
        date?: string;
        description?: string;
        notes?: string;
      };
      const found = await findExpense(ctx, a.expense);
      if (!found.ok) return { error: found.error };

      const { updateExpense } = await import("@/app/(dashboard)/finance/expenses/actions");
      const result = await updateExpense(
        found.row.id,
        given({
          amount: a.amount,
          date: a.date ? new Date(a.date) : undefined,
          description: a.description,
          notes: a.notes,
        }) as never,
        whyOverWhatsApp(a.reason, ctx),
      );
      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the expense." };
      }
      return {
        ...(result as Record<string, unknown>),
        was: money(found.row.amount),
      };
    },
  },
  {
    name: "delete_expense",
    description:
      "Remove an expense. The account it was paid from is credited back, and any supplier balance with it.",
    requires: "admin",
    writes: true,
    schema: z.object({
      expense: z.string(),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as { expense: string; reason?: string };
      const found = await findExpense(ctx, a.expense);
      if (!found.ok) return { error: found.error };

      const { deleteExpense } = await import("@/app/(dashboard)/finance/expenses/actions");
      const result = (await deleteExpense(
        found.row.id,
        whyOverWhatsApp(a.reason ?? "", ctx),
      )) as { success?: boolean; error?: string } | undefined;
      return result?.success
        ? { deleted: true, amount: money(found.row.amount) }
        : { error: result?.error ?? "Could not remove the expense." };
    },
  },

  // ------------------------------------------------------------------- trips
  {
    name: "update_trip",
    description:
      "Change a trip's details — route, load, mileage, dates, truck or driver. Use update_trip_status when only the status is moving, which is the one change that does not need an admin.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      trip: z.string().describe('The trip, e.g. "Mutare to Beira"'),
      tripDate: z.string().optional().describe("ISO date of the trip, if the route is ambiguous"),
      reason: z
        .string()
        .describe("Why the change is wanted. Filed as an edit request for anyone but an admin."),
      originCity: z.string().optional(),
      destinationCity: z.string().optional(),
      loadDescription: z.string().optional(),
      loadWeight: z.number().optional(),
      estimatedMileage: z.number().optional(),
      actualMileage: z.number().optional(),
      scheduledDate: z.string().optional().describe("ISO date"),
      truck: z.string().optional().describe("Registration of the truck to move it to"),
      driver: z.string().optional().describe("Name of the driver to move it to"),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as Record<string, unknown> & { trip: string; reason: string };
      const found = await findTrip(ctx, a.trip, a.tripDate as string | undefined);
      if (!found.ok) return { error: found.error };

      let truckId: string | undefined;
      if (a.truck) {
        const truck = await findTruck(ctx, a.truck as string);
        if (!truck.ok) return { error: truck.error };
        truckId = truck.row.id;
      }

      let driverId: string | undefined;
      if (a.driver) {
        const driver = await findDriver(ctx, a.driver as string);
        if (!driver.ok) return { error: driver.error };
        driverId = driver.row.id;
      }

      const { updateTrip } = await import("@/app/(dashboard)/operations/trips/actions");
      const result = await updateTrip(
        found.row.id,
        given({
          originCity: a.originCity as string | undefined,
          destinationCity: a.destinationCity as string | undefined,
          loadDescription: a.loadDescription as string | undefined,
          loadWeight: a.loadWeight as number | undefined,
          estimatedMileage: a.estimatedMileage as number | undefined,
          actualMileage: a.actualMileage as number | undefined,
          scheduledDate: a.scheduledDate ? new Date(a.scheduledDate as string) : undefined,
          truckId,
          driverId,
          notes: a.notes as string | undefined,
        }) as never,
        whyOverWhatsApp(a.reason as string, ctx),
      );
      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the trip." };
      }
      return {
        ...(result as Record<string, unknown>),
        trip: `${found.row.originCity} to ${found.row.destinationCity}`,
      };
    },
  },
  {
    name: "delete_trip",
    description: "Remove a trip. Refused if an invoice or expenses are attached to it.",
    requires: "admin",
    writes: true,
    schema: z.object({
      trip: z.string(),
      tripDate: z.string().optional().describe("ISO date, if the route is ambiguous"),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as { trip: string; tripDate?: string; reason?: string };
      const found = await findTrip(ctx, a.trip, a.tripDate);
      if (!found.ok) return { error: found.error };

      const { deleteTrip } = await import("@/app/(dashboard)/operations/trips/actions");
      const result = await deleteTrip(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? {
            deleted: true,
            trip: `${found.row.originCity} to ${found.row.destinationCity}`,
          }
        : { error: (result as { error?: string }).error ?? "Could not remove the trip." };
    },
  },

  // ------------------------------------------------------------------ fleet
  {
    name: "update_trailer",
    description: "Change a trailer's details. Only the fields you give are touched.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      trailer: z.string().describe("Registration of the trailer"),
      reason: z
        .string()
        .describe("Why the change is wanted. Filed as an edit request for anyone but an admin."),
      registrationNo: z.string().optional(),
      make: z.string().optional(),
      model: z.string().optional(),
      type: z.string().optional(),
      status: z.enum(["active", "in_service", "in_repair", "inactive"]).optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const { trailer: phrase, reason, ...rest } = args as {
        trailer: string;
        reason: string;
      } & Record<string, string | undefined>;
      const found = await findTrailer(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const { updateTrailer } = await import("@/app/(dashboard)/fleet/trailers/actions");
      const result = await updateTrailer(
        found.row.id,
        given(rest) as never,
        whyOverWhatsApp(reason, ctx),
      );
      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the trailer." };
      }
      return { ...(result as Record<string, unknown>), trailer: found.row.registrationNo };
    },
  },
  {
    name: "delete_truck",
    description: "Remove a truck. Refused if trips or expenses reference it.",
    requires: "admin",
    writes: true,
    schema: z.object({ truck: z.string(), reason: z.string().optional() }),
    handler: async (args, ctx) => {
      const a = args as { truck: string; reason?: string };
      const found = await findTruck(ctx, a.truck);
      if (!found.ok) return { error: found.error };

      const { deleteTruck } = await import("@/app/(dashboard)/fleet/trucks/actions");
      const result = await deleteTruck(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? { deleted: true, truck: found.row.registrationNo }
        : { error: (result as { error?: string }).error ?? "Could not remove the truck." };
    },
  },
  {
    name: "delete_trailer",
    description: "Remove a trailer. Refused if expenses reference it.",
    requires: "admin",
    writes: true,
    schema: z.object({ trailer: z.string(), reason: z.string().optional() }),
    handler: async (args, ctx) => {
      const a = args as { trailer: string; reason?: string };
      const found = await findTrailer(ctx, a.trailer);
      if (!found.ok) return { error: found.error };

      const { deleteTrailer } = await import("@/app/(dashboard)/fleet/trailers/actions");
      const result = await deleteTrailer(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? { deleted: true, trailer: found.row.registrationNo }
        : { error: (result as { error?: string }).error ?? "Could not remove the trailer." };
    },
  },
  {
    name: "delete_driver",
    description: "Remove a driver. Refused if trips reference them.",
    requires: "admin",
    writes: true,
    schema: z.object({ driver: z.string(), reason: z.string().optional() }),
    handler: async (args, ctx) => {
      const a = args as { driver: string; reason?: string };
      const found = await findDriver(ctx, a.driver);
      if (!found.ok) return { error: found.error };

      const { deleteDriver } = await import("@/app/(dashboard)/fleet/drivers/actions");
      const result = await deleteDriver(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? { deleted: true, driver: `${found.row.firstName} ${found.row.lastName}` }
        : { error: (result as { error?: string }).error ?? "Could not remove the driver." };
    },
  },

  // -------------------------------------------------------------- suppliers
  {
    name: "delete_supplier",
    description: "Remove a supplier. Refused if expenses or payments reference them.",
    requires: "admin",
    writes: true,
    schema: z.object({ supplier: z.string(), reason: z.string().optional() }),
    handler: async (args, ctx) => {
      const a = args as { supplier: string; reason?: string };
      const found = await findSupplier(ctx, a.supplier);
      if (!found.ok) return { error: found.error };

      const { deleteSupplier } = await import("@/app/(dashboard)/suppliers/actions");
      const result = await deleteSupplier(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? { deleted: true, supplier: found.row.name }
        : { error: (result as { error?: string }).error ?? "Could not remove the supplier." };
    },
  },
  {
    name: "adjust_supplier_balance",
    description:
      "Adjust what we owe a supplier by an amount, up or down — an opening balance, or a correction agreed with them. A payment should use pay_supplier instead.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      supplier: z.string(),
      amount: z
        .number()
        .describe("Positive adds to what we owe them, negative reduces it"),
    }),
    handler: async (args, ctx) => {
      const a = args as { supplier: string; amount: number };
      const found = await findSupplier(ctx, a.supplier);
      if (!found.ok) return { error: found.error };

      const { updateSupplierBalance } = await import("@/app/(dashboard)/suppliers/actions");
      const result = await updateSupplierBalance(found.row.id, a.amount);
      return result.success
        ? {
            adjusted: true,
            supplier: found.row.name,
            owedBefore: money(found.row.balance),
            owedNow: money(found.row.balance + a.amount),
          }
        : { error: (result as { error?: string }).error ?? "Could not adjust the balance." };
    },
  },

  // ---------------------------------------------------------------- stock
  {
    name: "allocate_part",
    description: "Put a part from stock onto a truck. Stock drops by the quantity.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      item: z.string().describe("Part name or SKU"),
      truck: z.string().describe("Registration of the truck it went on"),
      quantity: z.number().int().positive(),
      reason: z.string().optional().describe("What it was needed for"),
    }),
    handler: async (args, ctx) => {
      const a = args as { item: string; truck: string; quantity: number; reason?: string };
      if (!ctx.actorUserId) {
        return {
          error:
            "A part has to be booked out against a person, and this number is not linked to an account yet.",
        };
      }

      const item = await findItem(ctx, a.item);
      if (!item.ok) return { error: item.error };
      const truck = await findTruck(ctx, a.truck);
      if (!truck.ok) return { error: truck.error };

      const { allocatePart } = await import("@/app/(dashboard)/inventory/actions");
      const result = await allocatePart({
        inventoryItemId: item.row.id,
        truckId: truck.row.id,
        allocatedById: ctx.actorUserId,
        quantity: a.quantity,
        reason: a.reason,
      });
      return result.success
        ? {
            allocated: true,
            item: item.row.name,
            truck: truck.row.registrationNo,
            quantity: a.quantity,
          }
        : { error: (result as { error?: string }).error ?? "Could not allocate the part." };
    },
  },
  {
    name: "delete_inventory_item",
    description: "Remove a stock item. Refused if it has been allocated or moved.",
    requires: "admin",
    writes: true,
    schema: z.object({ item: z.string(), reason: z.string().optional() }),
    handler: async (args, ctx) => {
      const a = args as { item: string; reason?: string };
      const found = await findItem(ctx, a.item);
      if (!found.ok) return { error: found.error };

      const { deleteInventoryItem } = await import("@/app/(dashboard)/inventory/actions");
      const result = await deleteInventoryItem(
        found.row.id,
        whyOverWhatsApp(a.reason ?? "", ctx),
      );
      return result.success
        ? { deleted: true, item: found.row.name }
        : { error: (result as { error?: string }).error ?? "Could not remove the item." };
    },
  },

  // ------------------------------------------------------------- maintenance
  {
    name: "start_maintenance_job",
    description: "Mark a workshop job as being worked on.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      job: z.string().describe("The vehicle's registration, or words from the fault"),
    }),
    handler: async (args, ctx) => {
      const a = args as { job: string };
      const rows = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { notIn: ["fixed"] },
          OR: [
            { notes: { contains: a.job, mode: "insensitive" } },
            { truck: { registrationNo: { contains: a.job, mode: "insensitive" } } },
            { trailer: { registrationNo: { contains: a.job, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          notes: true,
          truck: { select: { registrationNo: true } },
          trailer: { select: { registrationNo: true } },
        },
        take: 6,
      });
      const found = await resolveOne(
        rows,
        (row) =>
          `${row.truck?.registrationNo ?? row.trailer?.registrationNo ?? "vehicle"}: ${row.notes.slice(0, 40)}`,
        "open job",
      );
      if (!found.ok) return { error: found.error };

      const { startMaintenanceWork } = await import("@/app/(dashboard)/maintenance/actions");
      const result = await startMaintenanceWork(found.row.id);
      return result.success
        ? {
            started: true,
            vehicle: found.row.truck?.registrationNo ?? found.row.trailer?.registrationNo,
          }
        : { error: (result as { error?: string }).error ?? "Could not start the job." };
    },
  },

  {
    name: "update_maintenance_job",
    description:
      "Change an open workshop job — correct the fault, or move the day it is booked for.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      job: z.string().describe("The vehicle's registration, or words from the fault"),
      notes: z.string().optional().describe("The fault, corrected or expanded"),
      date: z.string().optional().describe("ISO date the job is booked for"),
    }),
    handler: async (args, ctx) => {
      const a = args as { job: string; notes?: string; date?: string };
      if (!a.notes && !a.date) {
        return { error: "Say what to change — the fault, the day, or both." };
      }

      const rows = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { notIn: ["fixed"] },
          OR: [
            { notes: { contains: a.job, mode: "insensitive" } },
            { truck: { registrationNo: { contains: a.job, mode: "insensitive" } } },
            { trailer: { registrationNo: { contains: a.job, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          notes: true,
          date: true,
          truck: { select: { registrationNo: true } },
          trailer: { select: { registrationNo: true } },
        },
        take: 6,
      });
      const found = await resolveOne(
        rows,
        (row) =>
          `${row.truck?.registrationNo ?? row.trailer?.registrationNo ?? "vehicle"}: ${row.notes.slice(0, 40)}`,
        "open job",
      );
      if (!found.ok) return { error: found.error };

      // The action takes both fields, so the one left out keeps its value
      // rather than being blanked.
      const { updateMaintenanceRequest } = await import(
        "@/app/(dashboard)/maintenance/actions"
      );
      const result = await updateMaintenanceRequest(found.row.id, {
        notes: a.notes ?? found.row.notes,
        date: a.date ? new Date(a.date) : found.row.date,
      });
      return result.success
        ? {
            updated: true,
            vehicle: found.row.truck?.registrationNo ?? found.row.trailer?.registrationNo,
            fault: a.notes ?? found.row.notes,
            bookedFor: day(a.date ? new Date(a.date) : found.row.date),
          }
        : { error: (result as { error?: string }).error ?? "Could not change the job." };
    },
  },

  // ----------------------------------------------------------- edit requests
  {
    name: "withdraw_my_change",
    description:
      "Take back a change you sent for approval, before an admin has dealt with it.",
    requires: "staff",
    writes: true,
    schema: z.object({
      record: z.string().describe("Words from the record the change was about"),
    }),
    handler: async (args, ctx) => {
      const a = args as { record: string };
      if (!ctx.actorUserId) {
        return { error: "This number is not linked to an account, so it has sent no changes." };
      }

      const rows = await prisma.editRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          requestedById: ctx.actorUserId,
          status: "pending",
          OR: [
            { entityLabel: { contains: a.record, mode: "insensitive" } },
            { reason: { contains: a.record, mode: "insensitive" } },
          ],
        },
        select: { id: true, entityLabel: true, reason: true },
        take: 6,
      });
      const found = await resolveOne(
        rows,
        (row) => `${row.entityLabel ?? "a record"} — ${row.reason}`,
        "pending change of yours",
      );
      if (!found.ok) return { error: found.error };

      const { withdrawEditRequest } = await import("@/app/(dashboard)/edit-requests/actions");
      const result = await withdrawEditRequest(found.row.id);
      return result.success
        ? { withdrawn: true, record: found.row.entityLabel }
        : { error: (result as { error?: string }).error ?? "Could not withdraw it." };
    },
  },
];
