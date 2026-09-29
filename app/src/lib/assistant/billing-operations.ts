import "server-only";

/**
 * Billing over the assistant: invoices, customer payments, supplier payments,
 * and the two documents a customer is handed.
 *
 * Everything here calls the same server action the web form calls, under the
 * acting session, so validation, the edit-request gate, the invoice-balance
 * recompute and the supplier-balance movement all happen exactly as they do
 * in a browser. None of it is reimplemented.
 *
 * The client's instruction was that anything doable in the web app is doable
 * here. Raising an invoice was the conspicuous gap: a supervisor could record
 * a payment from a phone but not the bill it paid, so the one thing most
 * likely to be wanted at a weighbridge was the one thing that needed a desk.
 *
 * Two conventions carried over from crud-operations.ts:
 *
 *  - **Names, not ids.** Nobody carries a cuid. Each operation resolves a
 *    phrase to one record and asks when it is ambiguous, rather than guessing.
 *  - **A change is a change.** Anyone but an admin has their edit filed as a
 *    request, with the reason they gave and the fact it came over WhatsApp,
 *    because that is what ACCESS_CONTROL.md says.
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
    return {
      ok: false,
      error: `That matches ${rows.length} ${what}s: ${shown.join("; ")}${
        rows.length > shown.length ? ", and more" : ""
      }. Which one?`,
    };
  }
  return { ok: true, row: rows[0] };
}

function whyOverWhatsApp(reason: string, ctx: OperationContext): string {
  const said = (reason ?? "").trim();
  return said
    ? `${said} (${ctx.actorName}, over WhatsApp)`
    : `Changed by ${ctx.actorName} over WhatsApp`;
}

/** Drops the keys the caller left out, so an update touches nothing else. */
function given<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

async function findCustomer(ctx: OperationContext, phrase: string) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const rows = await prisma.customer.findMany({
    where: {
      organizationId: ctx.organizationId,
      AND: words.map((word) => ({
        OR: [
          { name: { contains: word, mode: "insensitive" as const } },
          { contactPerson: { contains: word, mode: "insensitive" as const } },
          { email: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, name: true },
    take: 6,
  });
  return resolveOne(rows, (row) => row.name, "customer");
}

async function findSupplier(ctx: OperationContext, phrase: string) {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const rows = await prisma.supplier.findMany({
    where: {
      organizationId: ctx.organizationId,
      AND: words.map((word) => ({
        OR: [
          { name: { contains: word, mode: "insensitive" as const } },
          { contactPerson: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, name: true },
    take: 6,
  });
  return resolveOne(rows, (row) => row.name, "supplier");
}

/**
 * An invoice, by its number or by the customer it is against.
 *
 * "INV-00123" is what somebody reads off a piece of paper; "the Bidco one" is
 * what they say when they do not have it in front of them. Both work, and the
 * refusal lists the numbers with their balances so the next message can pick.
 */
async function findInvoice(ctx: OperationContext, phrase: string) {
  const rows = await prisma.invoice.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { invoiceNumber: { contains: phrase, mode: "insensitive" } },
        { customer: { name: { contains: phrase, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      balance: true,
      status: true,
      customer: { select: { name: true } },
    },
    orderBy: { issueDate: "desc" },
    take: 6,
  });
  return resolveOne(
    rows,
    (row) => `${row.invoiceNumber} for ${row.customer.name}, ${money(row.balance)} outstanding`,
    "invoice",
  );
}

/** A payment, by its reference or by the customer who made it. */
async function findPayment(ctx: OperationContext, phrase: string) {
  const rows = await prisma.payment.findMany({
    where: {
      customer: { organizationId: ctx.organizationId },
      OR: [
        { reference: { contains: phrase, mode: "insensitive" } },
        { customer: { name: { contains: phrase, mode: "insensitive" } } },
        { invoice: { invoiceNumber: { contains: phrase, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      customer: { select: { name: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { paymentDate: "desc" },
    take: 6,
  });
  return resolveOne(
    rows,
    (row) =>
      `${money(row.amount)} from ${row.customer.name} on ${day(row.paymentDate)}${
        row.invoice ? ` against ${row.invoice.invoiceNumber}` : ""
      }`,
    "payment",
  );
}

/** A payment made to a supplier, by reference or supplier name. */
async function findSupplierPayment(ctx: OperationContext, phrase: string) {
  const rows = await prisma.supplierPayment.findMany({
    where: {
      organizationId: ctx.organizationId,
      OR: [
        { reference: { contains: phrase, mode: "insensitive" } },
        { supplier: { name: { contains: phrase, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      supplier: { select: { name: true } },
    },
    orderBy: { paymentDate: "desc" },
    take: 6,
  });
  return resolveOne(
    rows,
    (row) => `${money(row.amount)} to ${row.supplier.name} on ${day(row.paymentDate)}`,
    "supplier payment",
  );
}

const METHODS = ["cash", "bank_transfer", "check", "mobile_money", "other"] as const;

export const billingOperations: Operation[] = [
  // ---------------------------------------------------------------- invoices
  {
    name: "create_invoice",
    description:
      "Raise an invoice for a customer. The number is allocated automatically. Say credit terms and a due date if the customer pays later.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      customer: z.string().describe("Customer name"),
      amount: z.number().positive().describe("Amount before VAT"),
      dueDate: z.string().optional().describe("ISO date the money is due, for credit terms"),
      onCredit: z
        .boolean()
        .optional()
        .describe("True when the customer pays later. Requires a due date."),
      status: z
        .enum(["draft", "sent"])
        .optional()
        .describe("Defaults to sent — raise it as a draft only if asked"),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        customer: string;
        amount: number;
        dueDate?: string;
        onCredit?: boolean;
        status?: "draft" | "sent";
        notes?: string;
      };
      const found = await findCustomer(ctx, a.customer);
      if (!found.ok) return { error: found.error };

      const onCredit = a.onCredit ?? Boolean(a.dueDate);
      if (onCredit && !a.dueDate) {
        return { error: "An invoice on credit terms needs a due date. When is it due?" };
      }

      const { createInvoice } = await import("@/app/(dashboard)/finance/invoices/actions");
      const result = await createInvoice({
        customerId: found.row.id,
        amount: a.amount,
        isCredit: onCredit,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        status: (a.status ?? "sent") as never,
        notes: a.notes,
      });

      if (!result.success) {
        return { error: result.error ?? "Could not raise the invoice." };
      }
      return {
        raised: true,
        customer: found.row.name,
        amount: money(a.amount),
        dueDate: a.dueDate ? day(new Date(a.dueDate)) : "on receipt",
      };
    },
  },
  {
    name: "update_invoice",
    description:
      "Change an invoice. Only the fields you give are touched. The paid and outstanding figures are worked out from its payments, so they are never set here.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      invoice: z.string().describe("Invoice number, or the customer's name"),
      reason: z
        .string()
        .describe(
          "Why the change is wanted, in a few words. Anyone but an admin has this filed as an edit request for an admin to accept, and the reason is what they read.",
        ),
      amount: z.number().positive().optional().describe("New amount before VAT"),
      dueDate: z.string().optional().describe("New ISO due date"),
      status: z
        .enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"])
        .optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        invoice: string;
        reason: string;
        amount?: number;
        dueDate?: string;
        status?: string;
        notes?: string;
      };
      const found = await findInvoice(ctx, a.invoice);
      if (!found.ok) return { error: found.error };

      const { updateInvoice } = await import("@/app/(dashboard)/finance/invoices/actions");
      const result = await updateInvoice(
        found.row.id,
        given({
          // The web form posts the amount as both, VAT being handled
          // separately; matching it keeps one behaviour.
          subtotal: a.amount,
          total: a.amount,
          dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
          status: a.status as never,
          notes: a.notes,
        }),
        whyOverWhatsApp(a.reason, ctx),
      );

      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the invoice." };
      }
      return {
        ...(result as Record<string, unknown>),
        invoice: found.row.invoiceNumber,
      };
    },
  },
  {
    name: "delete_invoice",
    description:
      "Remove an invoice. Refused if payments have been recorded against it — cancel it instead.",
    requires: "admin",
    writes: true,
    schema: z.object({
      invoice: z.string().describe("Invoice number, or the customer's name"),
      reason: z.string().optional().describe("Why it is being removed"),
    }),
    handler: async (args, ctx) => {
      const a = args as { invoice: string; reason?: string };
      const found = await findInvoice(ctx, a.invoice);
      if (!found.ok) return { error: found.error };

      const { deleteInvoice } = await import("@/app/(dashboard)/finance/invoices/actions");
      const result = await deleteInvoice(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? { deleted: true, invoice: found.row.invoiceNumber }
        : { error: (result as { error?: string }).error ?? "Could not remove the invoice." };
    },
  },
  {
    name: "send_invoice_to_customer",
    description:
      "Send an invoice to the customer over WhatsApp, to the number on their record.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      invoice: z.string().describe("Invoice number, or the customer's name"),
    }),
    handler: async (args, ctx) => {
      const a = args as { invoice: string };
      const found = await findInvoice(ctx, a.invoice);
      if (!found.ok) return { error: found.error };

      const { sendInvoiceToCustomer } = await import(
        "@/app/(dashboard)/finance/invoices/actions"
      );
      const result = await sendInvoiceToCustomer(found.row.id);
      return result.success
        ? { sent: true, invoice: found.row.invoiceNumber, customer: found.row.customer.name }
        : { error: (result as { error?: string }).error ?? "Could not send the invoice." };
    },
  },
  {
    name: "chase_invoice",
    description:
      "Remind a customer about an unpaid invoice, over WhatsApp or by email.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      invoice: z.string().describe("Invoice number, or the customer's name"),
      by: z.enum(["whatsapp", "email"]).optional().describe("Defaults to whatsapp"),
    }),
    handler: async (args, ctx) => {
      const a = args as { invoice: string; by?: "whatsapp" | "email" };
      const found = await findInvoice(ctx, a.invoice);
      if (!found.ok) return { error: found.error };

      const actions = await import("@/app/(dashboard)/finance/invoices/[id]/actions");
      const result =
        a.by === "email"
          ? await actions.sendInvoiceReminderByEmail(found.row.id)
          : await actions.sendInvoiceReminderByWhatsApp(found.row.id);

      return result.success
        ? {
            reminded: true,
            invoice: found.row.invoiceNumber,
            customer: found.row.customer.name,
            by: a.by ?? "whatsapp",
            outstanding: money(found.row.balance),
          }
        : { error: (result as { error?: string }).error ?? "Could not send the reminder." };
    },
  },
  {
    name: "send_invoice_document",
    description:
      "Send the invoice itself as a PDF in this chat — the document, not a reminder to the customer.",
    requires: "supervisor",
    writes: false,
    schema: z.object({
      invoice: z.string().describe("Invoice number, or the customer's name"),
    }),
    handler: async (args, ctx) => {
      const a = args as { invoice: string };
      const found = await findInvoice(ctx, a.invoice);
      if (!found.ok) return { error: found.error };

      const { downloadSingleInvoicePDF } = await import(
        "@/app/(dashboard)/finance/invoices/actions"
      );
      const result = await downloadSingleInvoicePDF(found.row.id);
      if (!result.success || !("data" in result) || !result.data) {
        return { error: (result as { error?: string }).error ?? "Could not produce the invoice." };
      }

      return {
        invoice: found.row.invoiceNumber,
        customer: found.row.customer.name,
        total: money(found.row.total),
        sending: true,
        // Lifted out by the agent before the model sees it — the same envelope
        // generate_report uses. See agent/src/tools/app-tools.ts.
        attachment: {
          filename: ("filename" in result && result.filename) || `invoice-${found.row.invoiceNumber}.pdf`,
          mimeType: "application/pdf",
          base64: result.data,
        },
      };
    },
  },

  // ------------------------------------------------------- customer payments
  {
    name: "update_payment",
    description:
      "Change a customer payment. The invoice's paid and outstanding figures follow automatically.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      payment: z
        .string()
        .describe("Payment reference, the customer's name, or the invoice it was against"),
      reason: z
        .string()
        .describe(
          "Why the change is wanted. Anyone but an admin has this filed as an edit request, and the reason is what the admin reads.",
        ),
      amount: z.number().positive().optional(),
      paymentDate: z.string().optional().describe("ISO date"),
      method: z.enum(METHODS).optional(),
      notes: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        payment: string;
        reason: string;
        amount?: number;
        paymentDate?: string;
        method?: (typeof METHODS)[number];
        notes?: string;
      };
      const found = await findPayment(ctx, a.payment);
      if (!found.ok) return { error: found.error };

      const { updatePayment } = await import("@/app/(dashboard)/finance/payments/actions");
      const result = await updatePayment(
        found.row.id,
        given({
          amount: a.amount,
          paymentDate: a.paymentDate ? new Date(a.paymentDate) : undefined,
          method: a.method as never,
          notes: a.notes,
        }),
        whyOverWhatsApp(a.reason, ctx),
      );

      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the payment." };
      }
      return { ...(result as Record<string, unknown>), customer: found.row.customer.name };
    },
  },
  {
    name: "delete_payment",
    description:
      "Remove a customer payment. What the invoice still owes goes back up by that amount.",
    requires: "admin",
    writes: true,
    schema: z.object({
      payment: z.string().describe("Payment reference, customer name, or invoice number"),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as { payment: string; reason?: string };
      const found = await findPayment(ctx, a.payment);
      if (!found.ok) return { error: found.error };

      const { deletePayment } = await import("@/app/(dashboard)/finance/payments/actions");
      const result = await deletePayment(found.row.id, whyOverWhatsApp(a.reason ?? "", ctx));
      return result.success
        ? {
            deleted: true,
            amount: money(found.row.amount),
            customer: found.row.customer.name,
          }
        : { error: (result as { error?: string }).error ?? "Could not remove the payment." };
    },
  },
  {
    name: "send_payment_receipt",
    description: "Send the receipt for a payment as a PDF in this chat.",
    requires: "supervisor",
    writes: false,
    schema: z.object({
      payment: z.string().describe("Payment reference, customer name, or invoice number"),
    }),
    handler: async (args, ctx) => {
      const a = args as { payment: string };
      const found = await findPayment(ctx, a.payment);
      if (!found.ok) return { error: found.error };

      const { downloadPaymentReceiptPDF } = await import(
        "@/app/(dashboard)/finance/payments/actions"
      );
      const result = await downloadPaymentReceiptPDF(found.row.id);
      if (!result.success || !("data" in result) || !result.data) {
        return { error: (result as { error?: string }).error ?? "Could not produce the receipt." };
      }

      return {
        customer: found.row.customer.name,
        amount: money(found.row.amount),
        sending: true,
        attachment: {
          filename:
            ("filename" in result && result.filename) ||
            `receipt-${found.row.id.slice(-8).toUpperCase()}.pdf`,
          mimeType: "application/pdf",
          base64: result.data,
        },
      };
    },
  },

  // ------------------------------------------------------- supplier payments
  {
    name: "pay_supplier",
    description:
      "Record a payment made to a supplier. What we owe them drops by that amount.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      supplier: z.string().describe("Supplier name"),
      amount: z.number().positive(),
      paymentDate: z.string().optional().describe("ISO date. Defaults to today."),
      method: z.enum(METHODS).optional().describe("Defaults to cash"),
      reference: z.string().optional().describe("Transfer or cheque reference"),
      description: z.string().optional().describe("What the payment was for"),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        supplier: string;
        amount: number;
        paymentDate?: string;
        method?: (typeof METHODS)[number];
        reference?: string;
        description?: string;
      };
      const found = await findSupplier(ctx, a.supplier);
      if (!found.ok) return { error: found.error };

      const { createSupplierPayment } = await import(
        "@/app/(dashboard)/finance/supplier-payments/actions"
      );
      const result = await createSupplierPayment({
        supplierId: found.row.id,
        amount: a.amount,
        paymentDate: a.paymentDate ? new Date(a.paymentDate) : new Date(),
        method: (a.method ?? "cash") as never,
        reference: a.reference,
        description: a.description,
      });

      return result.success
        ? { paid: true, supplier: found.row.name, amount: money(a.amount) }
        : { error: (result as { error?: string }).error ?? "Could not record the payment." };
    },
  },
  {
    name: "update_supplier_payment",
    description:
      "Change a payment made to a supplier. What we owe them is adjusted by the difference.",
    requires: "supervisor",
    writes: true,
    schema: z.object({
      payment: z.string().describe("Payment reference, or the supplier's name"),
      reason: z
        .string()
        .describe("Why the change is wanted. Filed as an edit request for anyone but an admin."),
      amount: z.number().positive().optional(),
      paymentDate: z.string().optional().describe("ISO date"),
      method: z.enum(METHODS).optional(),
      reference: z.string().optional(),
      description: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as {
        payment: string;
        reason: string;
        amount?: number;
        paymentDate?: string;
        method?: (typeof METHODS)[number];
        reference?: string;
        description?: string;
      };
      const found = await findSupplierPayment(ctx, a.payment);
      if (!found.ok) return { error: found.error };

      const { updateSupplierPayment } = await import(
        "@/app/(dashboard)/finance/supplier-payments/actions"
      );
      const result = await updateSupplierPayment(
        found.row.id,
        given({
          amount: a.amount,
          paymentDate: a.paymentDate ? new Date(a.paymentDate) : undefined,
          method: a.method as never,
          reference: a.reference,
          description: a.description,
        }),
        whyOverWhatsApp(a.reason, ctx),
      );

      if (!result.success) {
        return { error: (result as { error?: string }).error ?? "Could not change the payment." };
      }
      return { ...(result as Record<string, unknown>), supplier: found.row.supplier.name };
    },
  },
  {
    name: "delete_supplier_payment",
    description:
      "Remove a payment made to a supplier. What we owe them goes back up by that amount.",
    requires: "admin",
    writes: true,
    schema: z.object({
      payment: z.string().describe("Payment reference, or the supplier's name"),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      const a = args as { payment: string; reason?: string };
      const found = await findSupplierPayment(ctx, a.payment);
      if (!found.ok) return { error: found.error };

      const { deleteSupplierPayment } = await import(
        "@/app/(dashboard)/finance/supplier-payments/actions"
      );
      const result = await deleteSupplierPayment(
        found.row.id,
        whyOverWhatsApp(a.reason ?? "", ctx),
      );
      return result.success
        ? {
            deleted: true,
            supplier: found.row.supplier.name,
            amount: money(found.row.amount),
          }
        : { error: (result as { error?: string }).error ?? "Could not remove the payment." };
    },
  },
];
