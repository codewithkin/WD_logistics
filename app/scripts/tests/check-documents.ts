/**
 * Renders the customer-facing documents against real data and checks what the
 * client asked for is on them.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-documents.ts
 *
 * The invoice, the statement and the receipt had never been rendered in
 * development, because the seed created no invoices and no payments. Three of
 * the client's complaints on 28 Sep were about exactly these documents — the
 * address was wrong, the invoice read like a statement, the statement did not
 * exist as its own document — and none of them could have been checked.
 *
 * This is a content check, not a layout one: it reads the strings the PDF draws
 * and asserts the ones that must be there and the ones that must not. Layout
 * still needs an eye on the file itself.
 */

import { prisma } from "@/lib/prisma";
import { generateInvoicePDF } from "@/lib/documents/invoice";
import { generateStatementPDF } from "@/lib/documents/statement";
import { generatePaymentReceiptPDF } from "@/lib/reports/receipt-generator";
import { outstandingForCustomer } from "@/lib/metrics/customer-balance";

/** The strings a PDF actually draws live in ( ) inside its content streams. */
function drawnText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  return (raw.match(/\([^)]*\)/g) ?? []).map((part) => part.slice(1, -1)).join("\n");
}

interface Check {
  document: string;
  label: string;
  ok: boolean;
  detail?: string;
}

const results: Check[] = [];

function wants(document: string, body: string, needles: string[]) {
  for (const needle of needles) {
    results.push({ document, label: `has "${needle}"`, ok: body.includes(needle) });
  }
}

function forbids(document: string, body: string, needles: string[], why: string) {
  for (const needle of needles) {
    results.push({
      document,
      label: `no "${needle}"`,
      ok: !body.includes(needle),
      detail: why,
    });
  }
}

const organization = await prisma.organization.findFirst();

// ---------------------------------------------------------------------------
// Invoice
//
// The client's words: an invoice must not read like a statement. It carries the
// totals and what has been paid, and no "amount due" band — that belongs to the
// statement, which is the document that asks for money.

// Part-paid on purpose: the Paid row only appears when something has been
// received, and that row is the one the client asked for by name.
const invoice = await prisma.invoice.findFirst({
  where: { status: "partial", amountPaid: { gt: 0 } },
  include: {
    customer: true,
    lineItems: true,
    trip: { include: { truck: true, driver: true } },
  },
});

if (!invoice) {
  results.push({ document: "invoice", label: "an invoice exists to render", ok: false });
} else {
  const body = drawnText(
    generateInvoicePDF({
      organization,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balance: invoice.balance,
        notes: invoice.notes,
        isCredit: invoice.isCredit,
      },
      lineItems: invoice.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      customer: {
        name: invoice.customer.name,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        address: invoice.customer.address,
        taxId: invoice.customer.taxId,
      },
      trip: invoice.trip
        ? {
            originCity: invoice.trip.originCity,
            destinationCity: invoice.trip.destinationCity,
            scheduledDate: invoice.trip.scheduledDate,
            loadDescription: invoice.trip.loadDescription,
            truck: invoice.trip.truck.registrationNo,
            driver: `${invoice.trip.driver.firstName} ${invoice.trip.driver.lastName}`,
          }
        : null,
    }),
  );

  wants("invoice", body, [
    "1 Tameside Close",
    "Nyakamete Industrial Area",
    invoice.invoiceNumber,
    invoice.customer.name,
    "Sub total",
    "VAT",
    "Total",
    "Paid",
    "Page 1 of",
  ]);
  forbids(
    "invoice",
    body,
    ["Amount due", "AMOUNT DUE", "Balance due", "BALANCE DUE"],
    "an invoice states the total and what is paid; asking for a figure is the statement's job",
  );
  forbids(
    "invoice",
    body,
    ["For the period"],
    "it used to reuse the report template, which printed a period line on an invoice",
  );
}

// ---------------------------------------------------------------------------
// Statement
//
// The other half of the same decision: a statement *is* the document that asks
// for money, so it leads with what is owed and carries a brought-forward line.

const customer = await prisma.customer.findFirst({
  where: { invoices: { some: {} } },
  include: {
    invoices: { orderBy: { issueDate: "asc" } },
    payments: { orderBy: { paymentDate: "asc" } },
  },
});

if (!customer) {
  results.push({ document: "statement", label: "a customer with invoices exists", ok: false });
} else {
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  const to = new Date();

  let running = 0;
  const entries = [
    ...customer.invoices
      .filter((i) => i.issueDate >= from && i.issueDate <= to && i.status !== "cancelled")
      .map((i) => ({
        date: i.issueDate,
        type: "INVOICE" as const,
        reference: i.invoiceNumber,
        description: i.notes ?? "Haulage",
        debit: i.total,
        credit: 0,
        balance: 0,
      })),
    ...customer.payments
      .filter((p) => p.paymentDate >= from && p.paymentDate <= to)
      .map((p) => ({
        date: p.paymentDate,
        type: "PAYMENT" as const,
        reference: p.reference ?? "Payment",
        description: p.notes ?? "Payment received",
        debit: 0,
        credit: p.amount,
        balance: 0,
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const entry of entries) {
    running += entry.debit - entry.credit;
    entry.balance = running;
  }

  const body = drawnText(
    generateStatementPDF({
      organization,
      customer: {
        name: customer.name,
        address: customer.address,
        phone: customer.phone,
        email: customer.email,
        taxId: customer.taxId,
      },
      period: { from, to },
      openingBalance: 0,
      entries,
      totalOutstanding: await outstandingForCustomer(customer.id),
      statementNumber: `STM-TEST-${customer.id.slice(0, 4)}`,
    }),
  );

  wants("statement", body, [
    "1 Tameside Close",
    customer.name,
    "Statement",
    "Page 1 of",
  ]);
  // The band that asks for the money. Drawn in caps by the kit.
  results.push({
    document: "statement",
    label: "leads with what is owed",
    ok: /AMOUNT DUE|Amount due|Total outstanding|TOTAL OUTSTANDING/.test(body),
    detail: "the statement is the document that asks for payment",
  });
  results.push({
    document: "statement",
    label: "carries a brought-forward line",
    ok: /Brought forward|BROUGHT FORWARD|Balance brought/i.test(body),
  });
}

// ---------------------------------------------------------------------------
// Receipt — the gold standard the rest of the documents were rebuilt on.

const payment = await prisma.payment.findFirst({
  include: { customer: true, invoice: true },
});

if (!payment) {
  results.push({ document: "receipt", label: "a payment exists to receipt", ok: false });
} else {
  const body = drawnText(
    generatePaymentReceiptPDF({
      organization,
      payment: {
        id: payment.id,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        method: payment.method,
        customMethod: payment.customMethod,
        reference: payment.reference,
        notes: payment.notes,
      },
      customer: {
        name: payment.customer.name,
        email: payment.customer.email,
        phone: payment.customer.phone,
        address: payment.customer.address,
      },
      invoice: payment.invoice
        ? {
            invoiceNumber: payment.invoice.invoiceNumber,
            total: payment.invoice.total,
            amountPaid: payment.invoice.amountPaid,
            balance: payment.invoice.balance,
          }
        : null,
    } as never),
  );

  // No page counter: a receipt is one page by construction, so it carries the
  // receipt number in its footer instead.
  wants("receipt", body, [
    "1 Tameside Close",
    payment.customer.name,
    "Thank you for your payment",
    "RCP-",
  ]);
}

// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
const byDocument = new Map<string, Check[]>();
for (const result of results) {
  const list = byDocument.get(result.document) ?? [];
  list.push(result);
  byDocument.set(result.document, list);
}

for (const [document, checks] of byDocument) {
  const bad = checks.filter((c) => !c.ok).length;
  console.log(`${bad === 0 ? "ok  " : "FAIL"} ${document.padEnd(10)} ${checks.length - bad}/${checks.length}`);
  for (const check of checks.filter((c) => !c.ok)) {
    console.log(`       ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
  }
}

console.log(
  `\n${results.length} checks, ${failed.length} failed.` +
    (failed.length === 0 ? " Every document carries what the client asked for." : ""),
);
process.exit(failed.length === 0 ? 0 : 1);
