"use server";

/**
 * The one query behind every entity picker dialog.
 *
 * Forms used to be handed a pre-loaded array of every truck/driver/customer by
 * their server page, which meant a form could only ever offer what that page
 * happened to fetch — and on a real fleet the <Select> became an unusable
 * thousand-item list. The picker instead calls this action: it searches the
 * whole org, applies filters, and returns one page of ten rows.
 *
 * Every branch is scoped by `organizationId` from the session. Nothing here
 * trusts an organisation id from the caller.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/session";
import { canViewFinancialData } from "@/lib/permissions";
import {
  ENTITY_PAGE_SIZE,
  type EntityOption,
  type EntitySearchParams,
  type EntitySearchResult,
} from "@/lib/entity-picker/config";

/** Case-insensitive "contains" across several columns. */
function textSearch(query: string | undefined, fields: string[]) {
  const q = query?.trim();
  if (!q) return undefined;
  return {
    OR: fields.map((field) => ({
      [field]: { contains: q, mode: "insensitive" as const },
    })),
  };
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(value: Date | null | undefined) {
  if (!value) return undefined;
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Turns a "Newest first"-style sort key into a Prisma orderBy.
 *
 * The field names are chosen per entity by the caller, so the object is built
 * from computed keys and TypeScript can only see `Record<string, "asc"|"desc">`.
 * The generic lets each call site name the Prisma input type it expects; the
 * field names passed in are all real columns on that model.
 */
function orderFor<T>(
  sort: string | undefined,
  nameField: string,
  dateField: string,
  balanceField?: string,
): T {
  return orderObject(sort, nameField, dateField, balanceField) as T;
}

function orderObject(
  sort: string | undefined,
  nameField: string,
  dateField: string,
  balanceField?: string,
): Record<string, "asc" | "desc"> {
  switch (sort) {
    case "name_desc":
      return { [nameField]: "desc" as const };
    case "created_desc":
    case "date_desc":
      return { [dateField]: "desc" as const };
    case "date_asc":
      return { [dateField]: "asc" as const };
    case "balance_desc":
      return balanceField
        ? { [balanceField]: "desc" as const }
        : { [nameField]: "asc" as const };
    case "stock_asc":
      return { quantity: "asc" as const };
    case "name_asc":
    default:
      return { [nameField]: "asc" as const };
  }
}

export async function searchEntities(
  params: EntitySearchParams,
): Promise<EntitySearchResult> {
  const session = await requireAuth();
  const orgId = session.organizationId;
  const page = Math.max(1, params.page ?? 1);
  const take = ENTITY_PAGE_SIZE;
  const skip = (page - 1) * take;
  const filters = params.filters ?? {};
  const sort = params.sort;
  const query = params.query?.trim() || undefined;

  /** A filter value of "all" (or absent) means "don't filter on this". */
  const f = (key: string) => {
    const value = filters[key];
    return value && value !== "all" ? value : undefined;
  };

  // Ids that must appear regardless of the current filter, so the currently
  // selected record never disappears from under the user.
  const pinned = (params.includeIds ?? []).filter(Boolean);
  const showMoney = canViewFinancialData(session.role);

  switch (params.kind) {
    case "truck": {
      const assignment = f("assignment");
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(assignment === "assigned"
          ? { assignedDriver: { isNot: null } }
          : assignment === "unassigned"
            ? { assignedDriver: { is: null } }
            : {}),
        ...(textSearch(query, ["registrationNo", "make", "model"]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.truck.findMany({
          where,
          orderBy: orderFor<Prisma.TruckOrderByWithRelationInput>(
            sort,
            "registrationNo",
            "createdAt",
          ),
          skip,
          take,
          include: {
            assignedDriver: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.truck.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.truck.findMany({
          where: { id: { in: ids }, organizationId: orgId },
          include: {
            assignedDriver: { select: { firstName: true, lastName: true } },
          },
        }),
      );
      return result(
        [...extra, ...rows].map(
          (t): EntityOption => ({
            id: t.id,
            label: t.registrationNo,
            description: [
              `${t.make} ${t.model} (${t.year})`,
              t.assignedDriver
                ? `${t.assignedDriver.firstName} ${t.assignedDriver.lastName}`
                : "No driver assigned",
            ].join(" · "),
            meta: `${t.currentMileage.toLocaleString()} km`,
            status: t.status,
            image: t.image,
          }),
        ),
        total,
        page,
      );
    }

    case "trailer": {
      const assignment = f("assignment");
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(assignment === "assigned"
          ? { assignedTruckId: { not: null } }
          : assignment === "unassigned"
            ? { assignedTruckId: null }
            : {}),
        ...(textSearch(query, ["registrationNo", "make", "model", "type"]) ??
          {}),
      };
      const [rows, total] = await Promise.all([
        prisma.trailer.findMany({
          where,
          orderBy: orderFor<Prisma.TrailerOrderByWithRelationInput>(
            sort,
            "registrationNo",
            "createdAt",
          ),
          skip,
          take,
          include: { assignedTruck: { select: { registrationNo: true } } },
        }),
        prisma.trailer.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.trailer.findMany({
          where: { id: { in: ids }, organizationId: orgId },
          include: { assignedTruck: { select: { registrationNo: true } } },
        }),
      );
      return result(
        [...extra, ...rows].map(
          (t): EntityOption => ({
            id: t.id,
            label: t.registrationNo,
            description: [
              `${t.make} ${t.model}${t.type ? ` · ${t.type}` : ""}`,
              t.assignedTruck
                ? `Hitched to ${t.assignedTruck.registrationNo}`
                : "Unhitched",
            ].join(" · "),
            status: t.status,
            image: t.image,
          }),
        ),
        total,
        page,
      );
    }

    case "driver": {
      const assignment = f("assignment");
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(assignment === "assigned"
          ? { assignedTruckId: { not: null } }
          : assignment === "unassigned"
            ? { assignedTruckId: null }
            : {}),
        ...(textSearch(query, [
          "firstName",
          "lastName",
          "phone",
          "licenseNumber",
        ]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.driver.findMany({
          where,
          orderBy:
            sort === "created_desc"
              ? { createdAt: "desc" }
              : sort === "name_desc"
                ? [{ firstName: "desc" }, { lastName: "desc" }]
                : [{ firstName: "asc" }, { lastName: "asc" }],
          skip,
          take,
          include: { assignedTruck: { select: { registrationNo: true } } },
        }),
        prisma.driver.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.driver.findMany({
          where: { id: { in: ids }, organizationId: orgId },
          include: { assignedTruck: { select: { registrationNo: true } } },
        }),
      );
      return result(
        [...extra, ...rows].map(
          (d): EntityOption => ({
            id: d.id,
            label: `${d.firstName} ${d.lastName}`,
            description: [
              d.phone,
              d.assignedTruck
                ? d.assignedTruck.registrationNo
                : "No truck assigned",
            ]
              .filter(Boolean)
              .join(" · "),
            meta: d.licenseNumber ? `Lic ${d.licenseNumber}` : undefined,
            status: d.status,
            image: d.image,
          }),
        ),
        total,
        page,
      );
    }

    case "customer": {
      const balance = f("balance");
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(balance === "owing"
          ? { balance: { gt: 0 } }
          : balance === "clear"
            ? { balance: { lte: 0 } }
            : {}),
        ...(textSearch(query, [
          "name",
          "contactPerson",
          "phone",
          "email",
          "taxId",
        ]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          orderBy: orderFor<Prisma.CustomerOrderByWithRelationInput>(
            sort,
            "name",
            "createdAt",
            "balance",
          ),
          skip,
          take,
        }),
        prisma.customer.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.customer.findMany({
          where: { id: { in: ids }, organizationId: orgId },
        }),
      );
      return result(
        [...extra, ...rows].map(
          (c): EntityOption => ({
            id: c.id,
            label: c.name,
            description: [c.contactPerson, c.phone, c.email]
              .filter(Boolean)
              .join(" · "),
            meta: showMoney
              ? c.balance > 0
                ? `Owes ${money(c.balance)}`
                : "Settled"
              : undefined,
            status: c.status,
            data: { balance: showMoney ? c.balance : 0 },
          }),
        ),
        total,
        page,
      );
    }

    case "supplier": {
      const balance = f("balance");
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(balance === "owing"
          ? { balance: { gt: 0 } }
          : balance === "clear"
            ? { balance: { lte: 0 } }
            : {}),
        ...(textSearch(query, [
          "name",
          "contactPerson",
          "phone",
          "email",
          "taxId",
        ]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.supplier.findMany({
          where,
          orderBy: orderFor<Prisma.SupplierOrderByWithRelationInput>(
            sort,
            "name",
            "createdAt",
            "balance",
          ),
          skip,
          take,
        }),
        prisma.supplier.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.supplier.findMany({
          where: { id: { in: ids }, organizationId: orgId },
        }),
      );
      return result(
        [...extra, ...rows].map(
          (s): EntityOption => ({
            id: s.id,
            label: s.name,
            description: [s.contactPerson, s.phone, s.email]
              .filter(Boolean)
              .join(" · "),
            meta: showMoney
              ? s.balance > 0
                ? `We owe ${money(s.balance)}`
                : "Settled"
              : undefined,
            status: s.status,
            data: { balance: showMoney ? s.balance : 0 },
          }),
        ),
        total,
        page,
      );
    }

    case "employee": {
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(textSearch(query, [
          "firstName",
          "lastName",
          "position",
          "department",
          "phone",
        ]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          orderBy:
            sort === "created_desc"
              ? { createdAt: "desc" }
              : sort === "name_desc"
                ? [{ firstName: "desc" }, { lastName: "desc" }]
                : [{ firstName: "asc" }, { lastName: "asc" }],
          skip,
          take,
        }),
        prisma.employee.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.employee.findMany({
          where: { id: { in: ids }, organizationId: orgId },
        }),
      );
      return result(
        [...extra, ...rows].map(
          (e): EntityOption => ({
            id: e.id,
            label: `${e.firstName} ${e.lastName}`,
            description: [e.position, e.department].filter(Boolean).join(" · "),
            meta: e.phone,
            status: e.status,
            image: e.image,
          }),
        ),
        total,
        page,
      );
    }

    case "trip": {
      // A trip has no number column; it is recognised by its route and date.
      const scopeCustomer =
        params.scope?.key === "customerId" ? params.scope.value : undefined;
      const scopeTruck =
        params.scope?.key === "truckId" ? params.scope.value : undefined;
      const scopeDriver =
        params.scope?.key === "driverId" ? params.scope.value : undefined;
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(scopeCustomer ? { customerId: scopeCustomer } : {}),
        ...(scopeTruck ? { truckId: scopeTruck } : {}),
        ...(scopeDriver ? { driverId: scopeDriver } : {}),
        ...(query
          ? {
              OR: [
                { originCity: { contains: query, mode: "insensitive" as const } },
                {
                  destinationCity: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
                {
                  loadDescription: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
                {
                  truck: {
                    registrationNo: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                },
                {
                  customer: {
                    name: { contains: query, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      };
      const include = {
        truck: { select: { registrationNo: true } },
        driver: { select: { firstName: true, lastName: true } },
        customer: { select: { name: true } },
      };
      const [rows, total] = await Promise.all([
        prisma.trip.findMany({
          where,
          orderBy:
            sort === "date_asc"
              ? { scheduledDate: "asc" }
              : { scheduledDate: "desc" },
          skip,
          take,
          include,
        }),
        prisma.trip.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.trip.findMany({
          where: { id: { in: ids }, organizationId: orgId },
          include,
        }),
      );
      return result(
        [...extra, ...rows].map(
          (t): EntityOption => ({
            id: t.id,
            label: `${t.originCity} → ${t.destinationCity}`,
            description: [
              shortDate(t.scheduledDate),
              t.truck?.registrationNo,
              t.customer?.name,
            ]
              .filter(Boolean)
              .join(" · "),
            meta: showMoney ? money(t.revenue) : undefined,
            status: t.status,
            data: {
              truckId: t.truckId,
              driverId: t.driverId,
              customerId: t.customerId,
              revenue: t.revenue,
            },
          }),
        ),
        total,
        page,
      );
    }

    case "invoice": {
      const balance = f("balance");
      const scopeCustomer =
        params.scope?.key === "customerId" ? params.scope.value : undefined;
      const where = {
        organizationId: orgId,
        ...(f("status") ? { status: f("status") } : {}),
        ...(scopeCustomer ? { customerId: scopeCustomer } : {}),
        ...(balance === "owing"
          ? { balance: { gt: 0 } }
          : balance === "clear"
            ? { balance: { lte: 0 } }
            : {}),
        ...(query
          ? {
              OR: [
                {
                  invoiceNumber: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
                {
                  customer: {
                    name: { contains: query, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      };
      const include = { customer: { select: { name: true } } };
      const [rows, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          orderBy:
            sort === "date_asc"
              ? { issueDate: "asc" }
              : sort === "balance_desc"
                ? { balance: "desc" }
                : { issueDate: "desc" },
          skip,
          take,
          include,
        }),
        prisma.invoice.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.invoice.findMany({
          where: { id: { in: ids }, organizationId: orgId },
          include,
        }),
      );
      return result(
        [...extra, ...rows].map(
          (i): EntityOption => ({
            id: i.id,
            label: i.invoiceNumber,
            description: [i.customer?.name, shortDate(i.issueDate)]
              .filter(Boolean)
              .join(" · "),
            meta: showMoney
              ? `${money(i.balance)} of ${money(i.total)} due`
              : undefined,
            status: i.status,
            data: {
              customerId: i.customerId,
              customerName: i.customer?.name ?? null,
              total: i.total,
              balance: i.balance,
            },
          }),
        ),
        total,
        page,
      );
    }

    case "expenseCategory": {
      const appliesTo = f("appliesTo");
      const where = {
        organizationId: orgId,
        ...(appliesTo === "trip"
          ? { isTrip: true }
          : appliesTo === "truck"
            ? { isTruck: true }
            : appliesTo === "driver"
              ? { isDriver: true }
              : {}),
        ...(textSearch(query, ["name", "description"]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.expenseCategory.findMany({
          where,
          orderBy: orderFor<Prisma.ExpenseCategoryOrderByWithRelationInput>(
            sort,
            "name",
            "createdAt",
          ),
          skip,
          take,
        }),
        prisma.expenseCategory.count({ where }),
      ]);
      const extra = await pinnedRows(pinned, rows, (ids) =>
        prisma.expenseCategory.findMany({
          where: { id: { in: ids }, organizationId: orgId },
        }),
      );
      return result(
        [...extra, ...rows].map((c): EntityOption => {
          const applies = [
            c.isTrip ? "Trips" : null,
            c.isTruck ? "Trucks" : null,
            c.isDriver ? "Drivers" : null,
          ].filter(Boolean);
          return {
            id: c.id,
            label: c.name,
            description:
              c.description ||
              (applies.length ? `Applies to ${applies.join(", ")}` : undefined),
            meta: applies.length ? applies.join(" · ") : "General",
          };
        }),
        total,
        page,
      );
    }

    case "inventoryItem": {
      const stock = f("stock");
      const where = {
        organizationId: orgId,
        ...(stock === "in_stock"
          ? { quantity: { gt: 0 } }
          : stock === "out"
            ? { quantity: { lte: 0 } }
            : {}),
        ...(textSearch(query, ["name", "sku", "category", "location"]) ?? {}),
      };
      const [allRows, total] = await Promise.all([
        prisma.inventoryItem.findMany({
          where,
          orderBy: orderFor<Prisma.InventoryItemOrderByWithRelationInput>(
            sort,
            "name",
            "createdAt",
          ),
          // "low" compares two columns, which Prisma can't express in `where`;
          // filter in memory and page after. Inventory is small enough that
          // this is cheaper than a raw query.
          ...(stock === "low" ? {} : { skip, take }),
        }),
        prisma.inventoryItem.count({ where }),
      ]);
      const lowFiltered =
        stock === "low"
          ? allRows.filter((i) => i.quantity <= i.minQuantity)
          : allRows;
      const paged =
        stock === "low" ? lowFiltered.slice(skip, skip + take) : lowFiltered;
      const extra = await pinnedRows(pinned, paged, (ids) =>
        prisma.inventoryItem.findMany({
          where: { id: { in: ids }, organizationId: orgId },
        }),
      );
      return result(
        [...extra, ...paged].map(
          (i): EntityOption => ({
            id: i.id,
            label: i.name,
            description: [i.sku, i.category, i.location]
              .filter(Boolean)
              .join(" · "),
            meta: `${i.quantity} ${i.unit ?? "in stock"}`,
            status:
              i.quantity <= 0
                ? "out_of_stock"
                : i.quantity <= i.minQuantity
                  ? "low_stock"
                  : "in_stock",
          }),
        ),
        stock === "low" ? lowFiltered.length : total,
        page,
      );
    }

    case "account": {
      const where = {
        organizationId: orgId,
        ...(textSearch(query, ["name", "type"]) ?? {}),
      };
      const [rows, total] = await Promise.all([
        prisma.financialAccount.findMany({
          where,
          orderBy: orderFor<Prisma.FinancialAccountOrderByWithRelationInput>(
            sort,
            "name",
            "createdAt",
            "balance",
          ),
          skip,
          take,
        }),
        prisma.financialAccount.count({ where }),
      ]);
      return result(
        rows.map(
          (a): EntityOption => ({
            id: a.id,
            label: a.name,
            description: a.type.replace(/_/g, " "),
            meta: showMoney ? money(a.balance) : undefined,
          }),
        ),
        total,
        page,
      );
    }

    case "user": {
      // Users are reached through Member, which is what carries the org role.
      const role = f("role");
      const where = {
        organizationId: orgId,
        ...(role ? { role } : {}),
        ...(query
          ? {
              user: {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      };
      const include = {
        user: { select: { id: true, name: true, email: true, image: true } },
      };
      const [rows, total] = await Promise.all([
        prisma.member.findMany({
          where,
          orderBy:
            sort === "created_desc"
              ? { createdAt: "desc" }
              : { user: { name: sort === "name_desc" ? "desc" : "asc" } },
          skip,
          take,
          include,
        }),
        prisma.member.count({ where }),
      ]);
      // Pinned ids for users are *user* ids, not member ids.
      const missing = pinned.filter(
        (id) => !rows.some((m) => m.user.id === id),
      );
      const extra = missing.length
        ? await prisma.member.findMany({
            where: { organizationId: orgId, userId: { in: missing } },
            include,
          })
        : [];
      return result(
        [...extra, ...rows].map(
          (m): EntityOption => ({
            id: m.user.id,
            label: m.user.name,
            description: m.user.email,
            meta: m.role,
            image: m.user.image,
          }),
        ),
        total,
        page,
      );
    }

    default: {
      // `kind` is a closed union; this only fires if a caller forges a value.
      const exhaustive: never = params.kind;
      throw new Error(`Unknown entity kind: ${String(exhaustive)}`);
    }
  }
}

/**
 * Loads any pinned rows that the current page didn't already return, so the
 * selected record stays visible after the user changes a filter.
 */
async function pinnedRows<T extends { id: string }>(
  pinned: string[],
  current: T[],
  load: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const missing = pinned.filter((id) => !current.some((r) => r.id === id));
  if (missing.length === 0) return [];
  return load(missing);
}

function result(
  items: EntityOption[],
  total: number,
  page: number,
): EntitySearchResult {
  // Pinned rows are prepended, so de-duplicate before returning.
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return { items: unique, total, page, pageSize: ENTITY_PAGE_SIZE };
}
