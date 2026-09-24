import "server-only";

/**
 * Creating, changing and removing records over the assistant.
 *
 * Every one of these calls the same server action the web form calls, under
 * the acting session — so validation, the edit-request gate, notifications
 * and account movements all happen exactly as they would in a browser. None
 * of it is reimplemented here.
 *
 * Two shapes recur and are worth stating once:
 *
 *  - **Names, not ids.** Nobody messaging from a yard knows a cuid. Each
 *    operation resolves a phrase to one record and asks when it is
 *    ambiguous, the same rule the expense and trip tools already follow.
 *  - **Deletes are allowed here, unlike elsewhere.** Trips and expenses were
 *    deliberately left out of the original assistant. These are different:
 *    removing a customer or a supplier is refused by the database if
 *    anything references it, so the destructive case is already guarded.
 *    Anything that would cascade stays in the web app.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Operation, OperationContext } from "@/lib/assistant/operations";

/** One record, or a sentence explaining why not. */
async function resolveOne<T extends { id: string }>(
  rows: T[],
  label: (row: T) => string,
  what: string,
): Promise<{ ok: true; row: T } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: false, error: `No ${what} matched that.` };
  if (rows.length > 1) {
    const shown = rows.slice(0, 5).map(label);
    const more = rows.length > shown.length;
    return {
      ok: false,
      error: more
        ? `That matches several ${what}s: ${shown.join(", ")}, and more. Which one?`
        : `That matches ${shown.length} ${what}s: ${shown.join(", ")}. Which one?`,
    };
  }
  return { ok: true, row: rows[0] };
}

/** Every word must land somewhere, so "Coca Cola" finds "Coca-Cola CCBA". */
function wordFilter(phrase: string, fields: string[]) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  return {
    AND: words.map((word) => ({
      OR: fields.map((field) => ({
        [field]: { contains: word, mode: "insensitive" as const },
      })),
    })),
  };
}

const findCustomer = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.customer.findMany({
      where: { organizationId: ctx.organizationId, ...wordFilter(phrase, ["name", "email", "phone"]) },
      select: { id: true, name: true },
      take: 6,
    }),
    (r) => r.name,
    "customer",
  );

const findSupplier = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.supplier.findMany({
      where: { organizationId: ctx.organizationId, ...wordFilter(phrase, ["name", "email", "phone"]) },
      select: { id: true, name: true },
      take: 6,
    }),
    (r) => r.name,
    "supplier",
  );

const findTruck = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.truck.findMany({
      where: { organizationId: ctx.organizationId, ...wordFilter(phrase, ["registrationNo", "make", "model"]) },
      select: { id: true, registrationNo: true },
      take: 6,
    }),
    (r) => r.registrationNo,
    "truck",
  );

const findTrailer = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.trailer.findMany({
      where: { organizationId: ctx.organizationId, ...wordFilter(phrase, ["registrationNo", "make", "model"]) },
      select: { id: true, registrationNo: true },
      take: 6,
    }),
    (r) => r.registrationNo,
    "trailer",
  );

const findDriver = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.driver.findMany({
      where: { organizationId: ctx.organizationId, ...wordFilter(phrase, ["firstName", "lastName", "phone", "licenseNumber"]) },
      select: { id: true, firstName: true, lastName: true },
      take: 6,
    }),
    (r) => `${r.firstName} ${r.lastName}`,
    "driver",
  );

const findItem = async (ctx: OperationContext, phrase: string) =>
  resolveOne(
    await prisma.inventoryItem.findMany({
      where: { organizationId: ctx.organizationId, ...wordFilter(phrase, ["name", "sku", "category"]) },
      select: { id: true, name: true },
      take: 6,
    }),
    (r) => r.name,
    "part",
  );

/** Only the keys that were actually given, so a patch never blanks a field. */
function given<T extends Record<string, unknown>>(source: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

export const crudOperations: Operation[] = [
  // -------------------------------------------------------------- customers
  {
    name: "create_customer",
    description: "Add a customer.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as { name: string } & Record<string, string | undefined>;
      const { createCustomer } = await import("@/app/(dashboard)/customers/actions");
      const result = await createCustomer(given(a) as { name: string });
      return result.success
        ? { created: true, customer: a.name }
        : { error: result.error ?? "Could not add the customer." };
    },
  },
  {
    name: "update_customer",
    description: "Change a customer's details. Only the fields you give are touched.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      customer: z.string().describe("Name, email or phone of the customer to change"),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }),
    handler: async (args, ctx) => {
      const { customer: phrase, ...rest } = args as { customer: string } & Record<string, string | undefined>;
      const found = await findCustomer(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const { updateCustomer } = await import("@/app/(dashboard)/customers/actions");
      const result = await updateCustomer(found.row.id, given(rest));
      return result.success
        ? { updated: true, customer: found.row.name, changed: Object.keys(given(rest)) }
        : { error: result.error ?? "Could not update the customer." };
    },
  },
  {
    name: "delete_customer",
    description:
      "Remove a customer. Refused if they have trips or invoices against them — those must go first, in the web app.",
    requires: "admin",
    writes: true,
    schema: z.object({ customer: z.string() }),
    handler: async (args, ctx) => {
      const a = args as { customer: string };
      const found = await findCustomer(ctx, a.customer);
      if (!found.ok) return { error: found.error };

      const { deleteCustomer } = await import("@/app/(dashboard)/customers/actions");
      const result = await deleteCustomer(found.row.id);
      return result.success
        ? { deleted: true, customer: found.row.name }
        : { error: result.error ?? "Could not remove the customer." };
    },
  },

  // -------------------------------------------------------------- suppliers
  {
    name: "create_supplier",
    description: "Add a supplier.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      paymentTerms: z.number().optional().describe("Days to pay, e.g. 30"),
      notes: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as { name: string } & Record<string, unknown>;
      const { createSupplier } = await import("@/app/(dashboard)/suppliers/actions");
      const result = await createSupplier(given(a) as { name: string });
      return result.success
        ? { created: true, supplier: a.name }
        : { error: result.error ?? "Could not add the supplier." };
    },
  },
  {
    name: "update_supplier",
    description: "Change a supplier's details.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      supplier: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      contactPerson: z.string().optional(),
      paymentTerms: z.number().optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const { supplier: phrase, ...rest } = args as { supplier: string } & Record<string, unknown>;
      const found = await findSupplier(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const { updateSupplier } = await import("@/app/(dashboard)/suppliers/actions");
      const result = await updateSupplier(found.row.id, given(rest));
      return result.success
        ? { updated: true, supplier: found.row.name, changed: Object.keys(given(rest)) }
        : { error: result.error ?? "Could not update the supplier." };
    },
  },
  {
    name: "mark_supplier_expense_paid",
    description:
      "Mark an unpaid supplier expense as settled, which reduces what the company owes them.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      supplier: z.string(),
      amount: z.number().optional().describe("To pick out one entry when there are several"),
    }),
    handler: async (args, ctx) => {
      const a = args as { supplier: string; amount?: number };
      const found = await findSupplier(ctx, a.supplier);
      if (!found.ok) return { error: found.error };

      const unpaid = await prisma.expense.findMany({
        where: {
          organizationId: ctx.organizationId,
          supplierId: found.row.id,
          isPaid: false,
          ...(a.amount ? { amount: a.amount } : {}),
        },
        select: { id: true, amount: true, date: true, notes: true },
        orderBy: { date: "asc" },
        take: 6,
      });

      const pick = await resolveOne(
        unpaid,
        (r) => `$${r.amount} on ${r.date.toISOString().split("T")[0]}`,
        "unpaid entry",
      );
      if (!pick.ok) return { error: pick.error };

      const { markExpenseAsPaid } = await import("@/app/(dashboard)/suppliers/actions");
      const result = await markExpenseAsPaid(pick.row.id);
      return result.success
        ? { paid: true, supplier: found.row.name, amount: pick.row.amount }
        : { error: result.error ?? "Could not mark it paid." };
    },
  },

  // ----------------------------------------------------------------- fleet
  {
    name: "create_truck",
    description: "Add a truck to the fleet.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      registrationNo: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number(),
      currentMileage: z.number().optional().describe("Odometer now; defaults to 0"),
      status: z
        .enum(["active", "in_service", "in_repair", "inactive", "decommissioned"])
        .optional(),
      fuelType: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as Record<string, unknown> & { registrationNo: string };
      const { createTruck } = await import("@/app/(dashboard)/fleet/trucks/actions");
      const result = await createTruck({
        ...given(a),
        status: (a.status as "active") ?? "active",
        currentMileage: (a.currentMileage as number) ?? 0,
      } as Parameters<typeof createTruck>[0]);
      return result.success
        ? { created: true, truck: a.registrationNo }
        : { error: result.error ?? "Could not add the truck." };
    },
  },
  {
    name: "update_truck",
    description:
      "Change a truck — its status, mileage or details. Use this to take one off the road or put it back.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      truck: z.string().describe("Registration of the truck to change"),
      registrationNo: z.string().optional(),
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.number().optional(),
      currentMileage: z.number().optional(),
      status: z
        .enum(["active", "in_service", "in_repair", "inactive", "decommissioned"])
        .optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const { truck: phrase, ...rest } = args as { truck: string } & Record<string, unknown>;
      const found = await findTruck(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const { updateTruck } = await import("@/app/(dashboard)/fleet/trucks/actions");
      const result = await updateTruck(found.row.id, given(rest));
      const pending = (result as { pendingApproval?: boolean }).pendingApproval;
      return result.success
        ? {
            updated: !pending,
            sentForApproval: Boolean(pending),
            truck: found.row.registrationNo,
            changed: Object.keys(given(rest)),
          }
        : { error: result.error ?? "Could not update the truck." };
    },
  },
  {
    name: "create_driver",
    description: "Add a driver.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      licenseNumber: z.string(),
      whatsappNumber: z.string().optional().describe("If different from their phone"),
      email: z.string().optional(),
      licenseExpiration: z.string().optional().describe("ISO date"),
      passportNumber: z.string().optional(),
      passportExpiration: z.string().optional().describe("ISO date"),
    }),
    handler: async (args) => {
      const a = args as Record<string, string | undefined> & {
        firstName: string;
        lastName: string;
        phone: string;
        licenseNumber: string;
      };
      const { createDriver } = await import("@/app/(dashboard)/fleet/drivers/actions");
      const result = await createDriver({
        ...given(a),
        licenseExpiration: a.licenseExpiration ? new Date(a.licenseExpiration) : undefined,
        passportExpiration: a.passportExpiration ? new Date(a.passportExpiration) : undefined,
      } as Parameters<typeof createDriver>[0]);
      return result.success
        ? { created: true, driver: `${a.firstName} ${a.lastName}` }
        : { error: result.error ?? "Could not add the driver." };
    },
  },
  {
    name: "update_driver",
    description: "Change a driver's details, including document expiry dates.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      driver: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      whatsappNumber: z.string().optional(),
      email: z.string().optional(),
      licenseNumber: z.string().optional(),
      licenseExpiration: z.string().optional().describe("ISO date"),
      passportExpiration: z.string().optional().describe("ISO date"),
      defenseCertificateExpiration: z.string().optional().describe("ISO date"),
      internationalDrivingPermitExpiration: z.string().optional().describe("ISO date"),
      status: z.enum(["active", "inactive", "on_leave"]).optional(),
    }),
    handler: async (args, ctx) => {
      const { driver: phrase, ...rest } = args as { driver: string } & Record<string, string | undefined>;
      const found = await findDriver(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const dates = [
        "licenseExpiration",
        "passportExpiration",
        "defenseCertificateExpiration",
        "internationalDrivingPermitExpiration",
      ] as const;
      const payload: Record<string, unknown> = given(rest);
      for (const key of dates) {
        if (payload[key]) payload[key] = new Date(payload[key] as string);
      }

      const { updateDriver } = await import("@/app/(dashboard)/fleet/drivers/actions");
      const result = await updateDriver(found.row.id, payload);
      const pending = (result as { pendingApproval?: boolean }).pendingApproval;
      return result.success
        ? {
            updated: !pending,
            sentForApproval: Boolean(pending),
            driver: `${found.row.firstName} ${found.row.lastName}`,
            changed: Object.keys(payload),
          }
        : { error: result.error ?? "Could not update the driver." };
    },
  },
  {
    name: "assign_driver_to_truck",
    description:
      "Put a driver on a truck, or take them off it. The assignment history is kept, so past trips stay attributed correctly.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      truck: z.string(),
      driver: z.string().optional().describe("Leave out to unassign whoever is on it"),
    }),
    handler: async (args, ctx) => {
      const a = args as { truck: string; driver?: string };
      const truck = await findTruck(ctx, a.truck);
      if (!truck.ok) return { error: truck.error };

      let driverId: string | null = null;
      let driverName = "nobody";
      if (a.driver) {
        const driver = await findDriver(ctx, a.driver);
        if (!driver.ok) return { error: driver.error };
        driverId = driver.row.id;
        driverName = `${driver.row.firstName} ${driver.row.lastName}`;
      }

      const { assignDriverToTruck } = await import(
        "@/app/(dashboard)/fleet/trucks/actions"
      );
      const result = await assignDriverToTruck(truck.row.id, driverId);
      return result.success
        ? { assigned: true, truck: truck.row.registrationNo, driver: driverName }
        : { error: result.error ?? "Could not change the assignment." };
    },
  },
  {
    name: "create_trailer",
    description: "Add a trailer.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      registrationNo: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number(),
      type: z.string().optional(),
      status: z.enum(["active", "in_service", "in_repair", "inactive"]).optional(),
      notes: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as Record<string, unknown> & { registrationNo: string };
      const { createTrailer } = await import("@/app/(dashboard)/fleet/trailers/actions");
      const result = await createTrailer({
        ...given(a),
        status: (a.status as "active") ?? "active",
      } as Parameters<typeof createTrailer>[0]);
      return result.success
        ? { created: true, trailer: a.registrationNo }
        : { error: result.error ?? "Could not add the trailer." };
    },
  },
  {
    name: "assign_trailer_to_truck",
    description: "Hitch a trailer to a truck, or unhitch it.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      trailer: z.string(),
      truck: z.string().optional().describe("Leave out to unhitch"),
    }),
    handler: async (args, ctx) => {
      const a = args as { trailer: string; truck?: string };
      const trailer = await findTrailer(ctx, a.trailer);
      if (!trailer.ok) return { error: trailer.error };

      let truckId: string | null = null;
      let truckName = "nothing";
      if (a.truck) {
        const truck = await findTruck(ctx, a.truck);
        if (!truck.ok) return { error: truck.error };
        truckId = truck.row.id;
        truckName = truck.row.registrationNo;
      }

      const { assignTruckToTrailer } = await import(
        "@/app/(dashboard)/fleet/trailers/actions"
      );
      const result = await assignTruckToTrailer(trailer.row.id, truckId);
      return result.success
        ? { assigned: true, trailer: trailer.row.registrationNo, truck: truckName }
        : { error: result.error ?? "Could not change the hitch." };
    },
  },

  // ------------------------------------------------------------- inventory
  {
    name: "create_inventory_item",
    description: "Add a new part to the warehouse catalogue.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      name: z.string(),
      quantity: z.number().describe("How many are in stock now"),
      sku: z.string().optional(),
      category: z.string().optional(),
      unit: z.string().optional().describe('e.g. "piece", "litre"'),
      minQuantity: z.number().optional().describe("Reorder level"),
      unitCost: z.number().optional(),
      location: z.string().optional(),
      supplier: z.string().optional(),
    }),
    handler: async (args) => {
      const a = args as { name: string; quantity: number } & Record<string, unknown>;
      const { createInventoryItem } = await import("@/app/(dashboard)/inventory/actions");
      const result = await createInventoryItem(
        given(a) as Parameters<typeof createInventoryItem>[0],
      );
      return result.success
        ? { created: true, item: a.name, quantity: a.quantity }
        : { error: result.error ?? "Could not add the part." };
    },
  },
  {
    name: "update_inventory_item",
    description:
      "Change a part's details — its reorder level, cost or location. To change how many there are, use adjust_stock so the movement is recorded.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      item: z.string(),
      name: z.string().optional(),
      sku: z.string().optional(),
      category: z.string().optional(),
      unit: z.string().optional(),
      minQuantity: z.number().optional(),
      unitCost: z.number().optional(),
      location: z.string().optional(),
      supplier: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const { item: phrase, ...rest } = args as { item: string } & Record<string, unknown>;
      const found = await findItem(ctx, phrase);
      if (!found.ok) return { error: found.error };

      const { updateInventoryItem } = await import("@/app/(dashboard)/inventory/actions");
      const result = await updateInventoryItem(
        found.row.id,
        given(rest) as Parameters<typeof updateInventoryItem>[1],
      );
      return result.success
        ? { updated: true, item: found.row.name, changed: Object.keys(given(rest)) }
        : { error: result.error ?? "Could not update the part." };
    },
  },

  // -------------------------------------------------------------- workshop
  {
    name: "assign_maintenance_job",
    description: "Hand a workshop job to one of the workshop staff.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      jobDescription: z.string().describe("Some of the fault text, to find the job"),
      assignTo: z.string().describe("Name of the workshop person"),
    }),
    handler: async (args, ctx) => {
      const a = args as { jobDescription: string; assignTo: string };

      const jobs = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["open", "assigned", "in_progress"] },
          notes: { contains: a.jobDescription, mode: "insensitive" },
        },
        select: {
          id: true,
          notes: true,
          truck: { select: { registrationNo: true } },
          trailer: { select: { registrationNo: true } },
        },
        take: 6,
      });
      const job = await resolveOne(
        jobs,
        (r) =>
          `${r.truck?.registrationNo ?? r.trailer?.registrationNo ?? "?"}: ${r.notes.slice(0, 40)}`,
        "open job",
      );
      if (!job.ok) return { error: job.error };

      const workers = await prisma.member.findMany({
        where: {
          organizationId: ctx.organizationId,
          role: "workshop",
          user: wordFilter(a.assignTo, ["name", "email"]) as never,
        },
        select: { userId: true, user: { select: { name: true } } },
        take: 6,
      });
      const worker = await resolveOne(
        workers.map((w) => ({ id: w.userId, name: w.user.name })),
        (r) => r.name,
        "workshop person",
      );
      if (!worker.ok) return { error: worker.error };

      const { assignMaintenanceRequest } = await import(
        "@/app/(dashboard)/maintenance/actions"
      );
      const result = await assignMaintenanceRequest(job.row.id, worker.row.id);
      return result.success
        ? { assigned: true, job: job.row.notes.slice(0, 60), to: worker.row.name }
        : { error: result.error ?? "Could not assign the job." };
    },
  },
  {
    name: "close_maintenance_job",
    description: "Mark a workshop job as fixed, with a note of what was done.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      jobDescription: z.string().describe("Some of the fault text, to find the job"),
      fixNotes: z.string().describe("What was actually done"),
    }),
    handler: async (args, ctx) => {
      const a = args as { jobDescription: string; fixNotes: string };

      const jobs = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { not: "fixed" },
          notes: { contains: a.jobDescription, mode: "insensitive" },
        },
        select: {
          id: true,
          notes: true,
          truck: { select: { registrationNo: true } },
          trailer: { select: { registrationNo: true } },
        },
        take: 6,
      });
      const job = await resolveOne(
        jobs,
        (r) =>
          `${r.truck?.registrationNo ?? r.trailer?.registrationNo ?? "?"}: ${r.notes.slice(0, 40)}`,
        "open job",
      );
      if (!job.ok) return { error: job.error };

      const { markMaintenanceRequestFixed } = await import(
        "@/app/(dashboard)/maintenance/actions"
      );
      const result = await markMaintenanceRequestFixed(job.row.id, a.fixNotes);
      return result.success
        ? { closed: true, job: job.row.notes.slice(0, 60), fixNotes: a.fixNotes }
        : { error: result.error ?? "Could not close the job." };
    },
  },

  // ------------------------------------------------------------- approvals
  {
    name: "list_pending_approvals",
    description:
      "Changes staff have proposed that are waiting for an admin to accept or refuse.",
    requires: "admin",
    schema: z.object({}),
    handler: async (_args, ctx) => {
      const rows = await prisma.editRequest.findMany({
        where: { organizationId: ctx.organizationId, status: "pending" },
        select: {
          id: true,
          entityType: true,
          action: true,
          reason: true,
          createdAt: true,
          requestedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      return rows.map((r) => ({
        id: r.id,
        what: `${r.action} ${r.entityType}`,
        by: r.requestedBy?.name ?? "someone",
        reason: r.reason,
        waitingSince: r.createdAt.toISOString().split("T")[0],
      }));
    },
  },
  {
    name: "approve_change",
    description:
      "Accept a proposed change. It is applied exactly as if an admin had made it.",
    requires: "admin",
    writes: true,
    schema: z.object({ requestId: z.string().describe("From list_pending_approvals") }),
    handler: async (args, ctx) => {
      const a = args as { requestId: string };
      const exists = await prisma.editRequest.findFirst({
        where: { id: a.requestId, organizationId: ctx.organizationId, status: "pending" },
        select: { entityType: true, action: true },
      });
      if (!exists) return { error: "No pending change with that id." };

      const { approveEditRequest } = await import(
        "@/app/(dashboard)/edit-requests/actions"
      );
      const result = await approveEditRequest(a.requestId);
      return result.success
        ? { approved: true, what: `${exists.action} ${exists.entityType}` }
        : { error: result.error ?? "Could not approve it." };
    },
  },
  {
    name: "reject_change",
    description: "Refuse a proposed change, with a reason the requester will see.",
    requires: "admin",
    writes: true,
    schema: z.object({
      requestId: z.string().describe("From list_pending_approvals"),
      reason: z.string().describe("Why it is being refused"),
    }),
    handler: async (args, ctx) => {
      const a = args as { requestId: string; reason: string };
      const exists = await prisma.editRequest.findFirst({
        where: { id: a.requestId, organizationId: ctx.organizationId, status: "pending" },
        select: { entityType: true, action: true },
      });
      if (!exists) return { error: "No pending change with that id." };

      const { rejectEditRequest } = await import(
        "@/app/(dashboard)/edit-requests/actions"
      );
      const result = await rejectEditRequest(a.requestId, a.reason);
      return result.success
        ? { rejected: true, what: `${exists.action} ${exists.entityType}`, reason: a.reason }
        : { error: result.error ?? "Could not reject it." };
    },
  },
];
