import "server-only";

/**
 * The tax invoice, rebuilt on the document kit.
 *
 * The client's complaint, in their words: the receipt is immaculate, the
 * invoice "looks more like a statement". They were right about why. The old
 * one reused the black-and-white report class, so it printed "For the period:
 * {issue} to {due}" like a statement, laid the details out as a Field/Value
 * grid, ended with a signature block borrowed from a report — and **left the
 * line items out entirely**, because the action that called it never loaded
 * them.
 *
 * This follows the invoice book they already print from (photographed in
 * `designs/`): the QTY / DESCRIPTION / UNITPRICE / AMOUNT table, a TO block
 * beside Date / Order No / VAT No, and SUB TOTAL / VAT / TOTAL bottom right.
 * Their instruction was "make it a TL;DR" — so there is no period line, no
 * payment-terms essay, and nothing on it that a customer does not need to
 * read to know what they owe and by when.
 */

import {
  BRAND,
  createDocument,
  drawHeader,
  drawHighlightBand,
  drawMetaGrid,
  drawNotes,
  drawPartyBlocks,
  drawSignature,
  drawTable,
  drawTotals,
  ensureSpace,
  finalise,
  money,
  shortDate,
  TYPE,
  type OrganizationLike,
} from "@/lib/documents/kit";

export interface InvoiceLineItemData {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceDocumentData {
  invoice: {
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date | null;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    balance: number;
    notes: string | null;
    isCredit: boolean;
  };
  lineItems: InvoiceLineItemData[];
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    taxId: string | null;
  };
  organization: OrganizationLike | null;
  /** Filled in when the invoice was raised against a trip. */
  trip: {
    originCity: string;
    destinationCity: string;
    scheduledDate: Date;
    loadDescription: string | null;
    truck: string;
    driver: string;
  } | null;
  /** The customer's own purchase order or reference, if they gave one. */
  orderNumber?: string | null;
}

/** Which pill tone the status reads as. */
function statusTone(
  status: string,
  balance: number,
  dueDate: Date | null,
): "green" | "warn" | "danger" | "muted" {
  if (status === "paid" || balance <= 0) return "green";
  if (status === "cancelled") return "muted";
  const overdue = dueDate ? dueDate.getTime() < Date.now() : false;
  if (status === "overdue" || overdue) return "danger";
  return "warn";
}

export function generateInvoicePDF(data: InvoiceDocumentData): Uint8Array {
  const { invoice, customer, trip } = data;
  const isCredit = invoice.isCredit;
  const title = isCredit ? "Credit Note" : "Tax Invoice";

  const ctx = createDocument({
    organization: data.organization,
    title: `${title} ${invoice.invoiceNumber}`,
  });

  const overdue =
    !isCredit &&
    invoice.balance > 0 &&
    invoice.dueDate !== null &&
    invoice.dueDate.getTime() < Date.now();

  drawHeader(ctx, {
    title,
    docNo: invoice.invoiceNumber,
    date: invoice.issueDate,
    metaLines: invoice.dueDate ? [`Due ${shortDate(invoice.dueDate)}`] : [],
    statusPill: {
      label: overdue ? "overdue" : invoice.status,
      tone: statusTone(invoice.status, invoice.balance, invoice.dueDate),
    },
    // The customer needs our address; a report does not.
    showCompanyBlock: true,
  });

  // ---- What is owed, in the largest type on the page ----
  //
  // The denormalised balance is asserted against the arithmetic. They can
  // drift if a payment was written outside a transaction, and an invoice that
  // says one thing in the app and another on paper is worse than a warning.
  const computedBalance =
    Math.round((invoice.total - invoice.amountPaid) * 100) / 100;
  const storedBalance = Math.round(invoice.balance * 100) / 100;
  const balanceMismatch = Math.abs(computedBalance - storedBalance) > 0.01;
  if (balanceMismatch) {
    console.warn(
      `[invoice] ${invoice.invoiceNumber}: stored balance ${storedBalance} ` +
        `but total - paid = ${computedBalance}. Printing the computed figure.`,
    );
  }
  const balance = balanceMismatch ? computedBalance : storedBalance;

  drawHighlightBand(
    ctx,
    {
      label: isCredit ? "Credit amount" : "Amount due",
      value: money(isCredit ? invoice.total : balance),
      tone: overdue ? "danger" : undefined,
    },
    invoice.dueDate && !isCredit
      ? { label: "Due date", value: shortDate(invoice.dueDate) }
      : undefined,
  );

  // ---- TO, beside Date / Order No / VAT No, as on the printed book ----
  drawPartyBlocks(ctx, {
    heading: "To",
    lines: [
      customer.name,
      ...(customer.address ? customer.address.split("\n") : []),
      [customer.phone, customer.email].filter(Boolean).join("  ·  "),
    ].filter(Boolean),
  });

  drawMetaGrid(ctx, [
    { label: "Date", value: shortDate(invoice.issueDate) },
    { label: "Order No", value: data.orderNumber?.trim() || "—" },
    { label: "VAT No", value: customer.taxId?.trim() || "—" },
  ]);

  // ---- The trip this covers, when there is one ----
  if (trip) {
    drawMetaGrid(
      ctx,
      [
        {
          label: "Route",
          value: `${trip.originCity} → ${trip.destinationCity}`,
        },
        { label: "Truck", value: trip.truck },
        { label: "Trip date", value: shortDate(trip.scheduledDate) },
      ],
      3,
    );
  }

  // ---- Line items ----
  //
  // The old invoice printed none: the action never loaded them. When an
  // invoice genuinely has none, one line is derived from the trip so the
  // customer still sees what they are paying for rather than a bare total.
  const lineItems: InvoiceLineItemData[] =
    data.lineItems.length > 0
      ? data.lineItems
      : [
          {
            description: trip
              ? `Haulage ${trip.originCity} to ${trip.destinationCity}${
                  trip.loadDescription ? ` — ${trip.loadDescription}` : ""
                }`
              : "Transport services",
            quantity: 1,
            unitPrice: invoice.subtotal,
            total: invoice.subtotal,
          },
        ];

  drawTable(
    ctx,
    [
      { header: "Qty", key: "qty", align: "right", width: 16 },
      { header: "Description", key: "description" },
      { header: "Unit price", key: "unitPrice", align: "right", width: 30 },
      { header: "Amount", key: "amount", align: "right", width: 30 },
    ],
    lineItems.map((item) => ({
      qty: item.quantity,
      description: item.description,
      unitPrice: money(item.unitPrice),
      amount: money(item.total),
    })),
  );

  // ---- Totals, bottom right, as on the printed book ----
  const vatRate =
    invoice.subtotal > 0
      ? Math.round((invoice.tax / invoice.subtotal) * 1000) / 10
      : 0;

  const totals: Array<{ label: string; value: string; emphasis?: boolean }> = [
    { label: "Sub total", value: money(invoice.subtotal) },
    {
      label: vatRate > 0 ? `VAT (${vatRate}%)` : "VAT",
      value: money(invoice.tax),
    },
    { label: "Total", value: money(invoice.total), emphasis: isCredit },
  ];

  if (!isCredit) {
    if (invoice.amountPaid > 0) {
      totals.push({ label: "Paid", value: money(invoice.amountPaid) });
    }
    totals.push({
      label: "Balance due",
      value: money(balance),
      emphasis: true,
    });
  }

  drawTotals(ctx, totals);

  // ---- Payment details and terms, kept short ----
  const company = ctx.company;
  if (!isCredit && company.bankDetails) {
    drawNotes(ctx, "Payment details", company.bankDetails);
  }
  if (invoice.notes?.trim()) {
    drawNotes(ctx, "Notes", invoice.notes.trim());
  }
  if (company.invoiceTerms?.trim()) {
    drawNotes(ctx, "Terms", company.invoiceTerms.trim());
  }

  // The printed book has a signature line, so this keeps one — unlike the
  // reports, which had inherited it for no reason.
  ensureSpace(ctx, 24);
  drawSignature(ctx);

  ctx.doc.setFontSize(TYPE.small);
  ctx.doc.setTextColor(...BRAND.muted);
  ctx.doc.text(
    isCredit
      ? "This credit note reduces the balance on your account."
      : "Thank you for your business.",
    ctx.margin,
    ctx.y,
  );

  return finalise(ctx, {
    docNo: `${isCredit ? "Credit note" : "Invoice"} ${invoice.invoiceNumber}`,
  });
}
