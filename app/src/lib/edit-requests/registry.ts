import "server-only";

/**
 * One place that knows how every editable record becomes an edit request and
 * back again.
 *
 * The approval switch this replaces was a hand-written `switch (entityType)`
 * that rebuilt each update itself — and got it wrong: it wrote a driver
 * `licenseExpiry` and a customer `city`, neither of which exist, skipped
 * relations and dates entirely, and never recomputed an invoice's balance.
 * Worse, only four entities had a request path at all, and those four saved
 * `proposedData: {}`, so approving one applied nothing.
 *
 * Approval here calls the entity's *real* update action, running in the
 * approving admin's session. That is the whole point: account reversals,
 * invoice balance recalculation, supplier balances, join-table relinking and
 * image cleanup are defined once, in the action, and cannot drift out of step
 * with a parallel copy. The registry's job is only to snapshot, label,
 * rehydrate and dispatch.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

import { updateTruck, deleteTruck } from "@/app/(dashboard)/fleet/trucks/actions";
import { updateTrailer, deleteTrailer } from "@/app/(dashboard)/fleet/trailers/actions";
import { updateDriver, deleteDriver } from "@/app/(dashboard)/fleet/drivers/actions";
import { updateTrip, deleteTrip } from "@/app/(dashboard)/operations/trips/actions";
import { updateCustomer, deleteCustomer } from "@/app/(dashboard)/customers/actions";
import { updateSupplier, deleteSupplier } from "@/app/(dashboard)/suppliers/actions";
import { updateEmployee, deleteEmployee } from "@/app/(dashboard)/employees/actions";
import { updateInvoice, deleteInvoice } from "@/app/(dashboard)/finance/invoices/actions";
import { updatePayment, deletePayment } from "@/app/(dashboard)/finance/payments/actions";
import {
  updateSupplierPayment,
  deleteSupplierPayment,
} from "@/app/(dashboard)/finance/supplier-payments/actions";
import {
  updateExpense as updateFinanceExpense,
  deleteExpense as deleteFinanceExpense,
} from "@/app/(dashboard)/finance/expenses/actions";
import {
  updateInventoryItem,
  deleteInventoryItem,
} from "@/app/(dashboard)/inventory/actions";

/** The entity kinds that go through the approval flow. */
export type EditRequestEntity =
  | "truck"
  | "trailer"
  | "driver"
  | "trip"
  | "customer"
  | "supplier"
  | "employee"
  | "invoice"
  | "payment"
  | "supplier_payment"
  | "expense"
  | "inventory_item";

export interface ApplyResult {
  success: boolean;
  error?: string;
}

export interface EntityRegistryEntry {
  /** "Truck", for headings and notification text. */
  singular: string;
  /** Loads the record and returns a snapshot of only its editable fields. */
  snapshot: (
    id: string,
    organizationId: string,
  ) => Promise<{ label: string; data: Record<string, unknown> } | null>;
  /** Field names whose values are ISO strings in JSON and Dates in the action. */
  dateFields: string[];
  /** Human labels for the diff view. */
  fieldLabels: Record<string, string>;
  /** Fields whose values are money, formatted as such in the diff. */
  moneyFields?: string[];
  /** Applies the proposed change by calling the entity's real update action. */
  apply: (id: string, data: Record<string, unknown>) => Promise<ApplyResult>;
  /** Applies a delete request. */
  applyDelete: (id: string) => Promise<ApplyResult>;
  /** Where the record lives, for the "view record" link. */
  href: (id: string) => string;
}

/** Normalises whatever an action returns into a plain success/error. */
function normalise(result: unknown): ApplyResult {
  const r = result as { success?: boolean; error?: string } | undefined;
  if (r && typeof r.success === "boolean") {
    return { success: r.success, error: r.error };
  }
  // An action that returns nothing on success (or redirects) counts as done.
  return { success: true };
}

/** Keeps only the named fields, so a snapshot never carries ids or timestamps. */
function pick(
  record: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in record) out[field] = record[field];
  }
  return out;
}

const TRUCK_FIELDS = [
  "registrationNo",
  "make",
  "model",
  "year",
  "status",
  "currentMileage",
  "fuelType",
  "tankCapacity",
  "image",
  "notes",
  "crossBorderInsuranceExpiration",
  "crossBorderPermitExpiration",
  "vehicleLicenseExpiration",
  "certificateOfFitnessExpiration",
];

const TRAILER_FIELDS = [
  "registrationNo",
  "make",
  "model",
  "year",
  "type",
  "status",
  "licenseNumber",
  "licenseExpiration",
  "image",
  "notes",
  "assignedTruckId",
];

const DRIVER_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "whatsappNumber",
  "passportNumber",
  "passportExpiration",
  "licenseNumber",
  "licenseExpiration",
  "image",
  "startDate",
  "endDate",
  "status",
  "notes",
  "assignedTruckId",
  "defenseCertificateExpiration",
  "internationalDrivingPermitExpiration",
];

const TRIP_FIELDS = [
  "originCity",
  "originAddress",
  "destinationCity",
  "destinationAddress",
  "loadDescription",
  "loadWeight",
  "loadUnits",
  "estimatedMileage",
  "actualMileage",
  "startOdometer",
  "endOdometer",
  "revenue",
  "status",
  "scheduledDate",
  "startDate",
  "endDate",
  "truckId",
  "driverId",
  "customerId",
  "notes",
];

const CUSTOMER_FIELDS = [
  "name",
  "contactPerson",
  "email",
  "phone",
  "address",
  "taxId",
  "paymentTerms",
  "creditLimit",
  "notes",
  "status",
];

const SUPPLIER_FIELDS = [
  "name",
  "contactPerson",
  "email",
  "phone",
  "address",
  "taxId",
  "paymentTerms",
  "notes",
  "status",
];

const EMPLOYEE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "position",
  "department",
  "image",
  "idNumber",
  "address",
  "emergencyContact",
  "startDate",
  "endDate",
  "dismissalReason",
  "status",
  "salary",
  "notes",
];

const INVOICE_FIELDS = [
  "customerId",
  "invoiceNumber",
  "subtotal",
  "tax",
  "total",
  "isCredit",
  "issueDate",
  "dueDate",
  "maxReminderDate",
  "status",
  "notes",
];

const PAYMENT_FIELDS = [
  "invoiceId",
  "customerId",
  "amount",
  "paymentDate",
  "method",
  "customMethod",
  "notes",
];

const SUPPLIER_PAYMENT_FIELDS = [
  "supplierId",
  "amount",
  "paymentDate",
  "method",
  "customMethod",
  "reference",
  "description",
  "notes",
];

const EXPENSE_FIELDS = [
  "categoryId",
  "amount",
  "date",
  "description",
  "vendor",
  "reference",
  "notes",
  "receiptUrl",
  "isBusinessExpense",
  "supplierId",
];

const INVENTORY_FIELDS = [
  "name",
  "sku",
  "category",
  "unit",
  "quantity",
  "minQuantity",
  "unitCost",
  "location",
  "supplier",
  "notes",
];

export const EDIT_REQUEST_REGISTRY: Record<
  EditRequestEntity,
  EntityRegistryEntry
> = {
  truck: {
    singular: "Truck",
    dateFields: [
      "crossBorderInsuranceExpiration",
      "crossBorderPermitExpiration",
      "vehicleLicenseExpiration",
      "certificateOfFitnessExpiration",
    ],
    fieldLabels: {
      registrationNo: "Registration",
      make: "Make",
      model: "Model",
      year: "Year",
      status: "Status",
      currentMileage: "Mileage (km)",
      fuelType: "Fuel type",
      tankCapacity: "Tank capacity",
      image: "Photo",
      notes: "Notes",
      crossBorderInsuranceExpiration: "Cross-border insurance expiry",
      crossBorderPermitExpiration: "Cross-border permit expiry",
      vehicleLicenseExpiration: "Vehicle licence expiry",
      certificateOfFitnessExpiration: "Certificate of fitness expiry",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.truck.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: `Truck ${record.registrationNo}`,
        data: pick(record as unknown as Record<string, unknown>, TRUCK_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(await updateTruck(id, data as Parameters<typeof updateTruck>[1])),
    applyDelete: async (id) => normalise(await deleteTruck(id)),
    href: (id) => `/fleet/trucks/${id}`,
  },

  trailer: {
    singular: "Trailer",
    dateFields: ["licenseExpiration"],
    fieldLabels: {
      registrationNo: "Registration",
      make: "Make",
      model: "Model",
      year: "Year",
      type: "Type",
      status: "Status",
      licenseNumber: "Licence number",
      licenseExpiration: "Licence expiry",
      image: "Photo",
      notes: "Notes",
      assignedTruckId: "Hitched to",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.trailer.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: `Trailer ${record.registrationNo}`,
        data: pick(record as unknown as Record<string, unknown>, TRAILER_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateTrailer(id, data as Parameters<typeof updateTrailer>[1]),
      ),
    applyDelete: async (id) => normalise(await deleteTrailer(id)),
    href: (id) => `/fleet/trailers/${id}`,
  },

  driver: {
    singular: "Driver",
    dateFields: [
      "passportExpiration",
      "licenseExpiration",
      "startDate",
      "endDate",
      "defenseCertificateExpiration",
      "internationalDrivingPermitExpiration",
    ],
    fieldLabels: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
      whatsappNumber: "WhatsApp number",
      passportNumber: "Passport number",
      passportExpiration: "Passport expiry",
      licenseNumber: "Licence number",
      licenseExpiration: "Licence expiry",
      image: "Photo",
      startDate: "Started",
      endDate: "Ended",
      status: "Status",
      notes: "Notes",
      assignedTruckId: "Assigned truck",
      defenseCertificateExpiration: "Defensive driving expiry",
      internationalDrivingPermitExpiration: "International permit expiry",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.driver.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: `${record.firstName} ${record.lastName}`,
        data: pick(record as unknown as Record<string, unknown>, DRIVER_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(await updateDriver(id, data as Parameters<typeof updateDriver>[1])),
    applyDelete: async (id) => normalise(await deleteDriver(id)),
    href: (id) => `/fleet/drivers/${id}`,
  },

  trip: {
    singular: "Trip",
    dateFields: ["scheduledDate", "startDate", "endDate"],
    moneyFields: ["revenue"],
    fieldLabels: {
      originCity: "From",
      originAddress: "From address",
      destinationCity: "To",
      destinationAddress: "To address",
      loadDescription: "Load",
      loadWeight: "Load weight",
      loadUnits: "Load units",
      estimatedMileage: "Estimated km",
      actualMileage: "Actual km",
      startOdometer: "Odometer start",
      endOdometer: "Odometer end",
      revenue: "Revenue",
      status: "Status",
      scheduledDate: "Scheduled",
      startDate: "Started",
      endDate: "Ended",
      truckId: "Truck",
      driverId: "Driver",
      customerId: "Customer",
      notes: "Notes",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.trip.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: `Trip ${record.originCity} → ${record.destinationCity}`,
        data: pick(record as unknown as Record<string, unknown>, TRIP_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(await updateTrip(id, data as Parameters<typeof updateTrip>[1])),
    applyDelete: async (id) => normalise(await deleteTrip(id)),
    href: (id) => `/operations/trips/${id}`,
  },

  customer: {
    singular: "Customer",
    dateFields: [],
    moneyFields: ["creditLimit"],
    fieldLabels: {
      name: "Name",
      contactPerson: "Contact person",
      email: "Email",
      phone: "Phone",
      address: "Address",
      taxId: "Tax number",
      paymentTerms: "Payment terms (days)",
      creditLimit: "Credit limit",
      notes: "Notes",
      status: "Status",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.customer.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: record.name,
        data: pick(record as unknown as Record<string, unknown>, CUSTOMER_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateCustomer(id, data as Parameters<typeof updateCustomer>[1]),
      ),
    applyDelete: async (id) => normalise(await deleteCustomer(id)),
    href: (id) => `/customers/${id}`,
  },

  supplier: {
    singular: "Supplier",
    dateFields: [],
    fieldLabels: {
      name: "Name",
      contactPerson: "Contact person",
      email: "Email",
      phone: "Phone",
      address: "Address",
      taxId: "Tax number",
      paymentTerms: "Payment terms (days)",
      notes: "Notes",
      status: "Status",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.supplier.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: record.name,
        data: pick(record as unknown as Record<string, unknown>, SUPPLIER_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateSupplier(id, data as Parameters<typeof updateSupplier>[1]),
      ),
    applyDelete: async (id) => normalise(await deleteSupplier(id)),
    href: (id) => `/suppliers/${id}`,
  },

  employee: {
    singular: "Employee",
    dateFields: ["startDate", "endDate"],
    moneyFields: ["salary"],
    fieldLabels: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
      position: "Position",
      department: "Department",
      image: "Photo",
      idNumber: "ID number",
      address: "Address",
      emergencyContact: "Emergency contact",
      startDate: "Started",
      endDate: "Ended",
      dismissalReason: "Reason for leaving",
      status: "Status",
      salary: "Salary",
      notes: "Notes",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.employee.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: `${record.firstName} ${record.lastName}`,
        data: pick(record as unknown as Record<string, unknown>, EMPLOYEE_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateEmployee(id, data as Parameters<typeof updateEmployee>[1]),
      ),
    applyDelete: async (id) => normalise(await deleteEmployee(id)),
    href: (id) => `/employees/${id}`,
  },

  invoice: {
    singular: "Invoice",
    dateFields: ["issueDate", "dueDate", "maxReminderDate"],
    moneyFields: ["subtotal", "tax", "total"],
    fieldLabels: {
      customerId: "Customer",
      invoiceNumber: "Invoice number",
      subtotal: "Subtotal",
      tax: "VAT",
      total: "Total",
      isCredit: "Credit invoice",
      issueDate: "Issued",
      dueDate: "Due",
      maxReminderDate: "Stop reminders after",
      status: "Status",
      notes: "Notes",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.invoice.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: `Invoice ${record.invoiceNumber}`,
        data: pick(record as unknown as Record<string, unknown>, INVOICE_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateInvoice(id, data as Parameters<typeof updateInvoice>[1]),
      ),
    applyDelete: async (id) => normalise(await deleteInvoice(id)),
    href: (id) => `/finance/invoices/${id}`,
  },

  payment: {
    singular: "Payment",
    dateFields: ["paymentDate"],
    moneyFields: ["amount"],
    fieldLabels: {
      invoiceId: "Invoice",
      customerId: "Customer",
      amount: "Amount",
      paymentDate: "Paid on",
      method: "Method",
      customMethod: "Method (other)",
      notes: "Notes",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.payment.findFirst({
        where: { id, customer: { organizationId } },
        include: { customer: { select: { name: true } } },
      });
      if (!record) return null;
      return {
        label: `Payment of ${record.amount} from ${record.customer.name}`,
        data: pick(record as unknown as Record<string, unknown>, PAYMENT_FIELDS),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updatePayment(id, data as Parameters<typeof updatePayment>[1]),
      ),
    applyDelete: async (id) => normalise(await deletePayment(id)),
    href: (id) => `/finance/payments/${id}`,
  },

  supplier_payment: {
    singular: "Supplier payment",
    dateFields: ["paymentDate"],
    moneyFields: ["amount"],
    fieldLabels: {
      supplierId: "Supplier",
      amount: "Amount",
      paymentDate: "Paid on",
      method: "Method",
      customMethod: "Method (other)",
      reference: "Reference",
      description: "Description",
      notes: "Notes",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.supplierPayment.findFirst({
        where: { id, organizationId },
        include: { supplier: { select: { name: true } } },
      });
      if (!record) return null;
      return {
        label: `Payment of ${record.amount} to ${record.supplier.name}`,
        data: pick(
          record as unknown as Record<string, unknown>,
          SUPPLIER_PAYMENT_FIELDS,
        ),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateSupplierPayment(
          id,
          data as Parameters<typeof updateSupplierPayment>[1],
        ),
      ),
    applyDelete: async (id) => normalise(await deleteSupplierPayment(id)),
    href: (id) => `/finance/supplier-payments/${id}`,
  },

  expense: {
    singular: "Expense",
    dateFields: ["date"],
    moneyFields: ["amount"],
    fieldLabels: {
      categoryId: "Category",
      amount: "Amount",
      date: "Date",
      description: "Description",
      vendor: "Vendor",
      reference: "Reference",
      notes: "Notes",
      receiptUrl: "Receipt",
      isBusinessExpense: "Business expense",
      supplierId: "Supplier",
      truckIds: "Trucks",
      trailerIds: "Trailers",
      tripIds: "Trips",
      driverIds: "Drivers",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.expense.findFirst({
        where: { id, organizationId },
        include: {
          category: { select: { name: true } },
          truckExpenses: { select: { truckId: true } },
          trailerExpenses: { select: { trailerId: true } },
          tripExpenses: { select: { tripId: true } },
          driverExpenses: { select: { driverId: true } },
        },
      });
      if (!record) return null;
      return {
        label: `${record.category.name} expense of ${record.amount}`,
        data: {
          ...pick(record as unknown as Record<string, unknown>, EXPENSE_FIELDS),
          // The join tables are part of what the form edits, so they belong in
          // the snapshot — otherwise re-linking a cost to a different truck
          // shows as "no change" in the diff.
          truckIds: record.truckExpenses.map((t) => t.truckId),
          trailerIds: record.trailerExpenses.map((t) => t.trailerId),
          tripIds: record.tripExpenses.map((t) => t.tripId),
          driverIds: record.driverExpenses.map((d) => d.driverId),
        },
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateFinanceExpense(
          id,
          // The expense form's payload carries array fields the generic
          // Record type can't be narrowed to directly.
          data as unknown as Parameters<typeof updateFinanceExpense>[1],
        ),
      ),
    applyDelete: async (id) => normalise(await deleteFinanceExpense(id)),
    href: (id) => `/finance/expenses/${id}`,
  },

  inventory_item: {
    singular: "Inventory item",
    dateFields: [],
    moneyFields: ["unitCost"],
    fieldLabels: {
      name: "Name",
      sku: "Part number",
      category: "Category",
      unit: "Unit",
      quantity: "Quantity",
      minQuantity: "Reorder level",
      unitCost: "Unit cost",
      location: "Location",
      supplier: "Supplier",
      notes: "Notes",
    },
    snapshot: async (id, organizationId) => {
      const record = await prisma.inventoryItem.findFirst({
        where: { id, organizationId },
      });
      if (!record) return null;
      return {
        label: record.name,
        data: pick(
          record as unknown as Record<string, unknown>,
          INVENTORY_FIELDS,
        ),
      };
    },
    apply: async (id, data) =>
      normalise(
        await updateInventoryItem(
          id,
          data as Parameters<typeof updateInventoryItem>[1],
        ),
      ),
    applyDelete: async (id) => normalise(await deleteInventoryItem(id)),
    href: (id) => `/inventory/${id}`,
  },
};

export function isEditRequestEntity(value: string): value is EditRequestEntity {
  return value in EDIT_REQUEST_REGISTRY;
}

export function registryFor(entityType: string): EntityRegistryEntry | null {
  return isEditRequestEntity(entityType)
    ? EDIT_REQUEST_REGISTRY[entityType]
    : null;
}

/**
 * Turns a JSON payload back into what the update action expects.
 *
 * JSON has no Date, so every date arrives as an ISO string and the action's
 * Prisma call would reject it. This is the one place that knows which fields
 * those are.
 */
export function rehydrate(
  entityType: EditRequestEntity,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const entry = EDIT_REQUEST_REGISTRY[entityType];
  const out: Record<string, unknown> = { ...data };
  for (const field of entry.dateFields) {
    const value = out[field];
    if (typeof value === "string" && value) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) out[field] = date;
    }
  }
  return out;
}

/** Serialises a record for storage in `originalData` / `proposedData`. */
export function serialiseForRequest(
  data: Record<string, unknown>,
): Prisma.InputJsonValue {
  // A JSON round-trip turns Dates into ISO strings and drops undefined, which
  // is exactly the shape Prisma's Json column accepts.
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}
