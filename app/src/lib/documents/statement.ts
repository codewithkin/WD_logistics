import "server-only";

/**
 * A customer's statement of account.
 *
 * The counterpart to the invoice, and deliberately the opposite of it. An
 * invoice bills for one job: what it was for, what it comes to. A statement
 * answers the other question — what is on the account, and what is still
 * owed across all of it.
 *
 * The two had grown into each other. The invoice led with "Amount due" and
 * printed a running balance; the statement was not a document at all but a
 * generic report, with no letterhead, no address to send it to, and a
 * "Period:" line where a closing balance should be. The client's instruction
 * was that they stop overlapping: totals on an invoice, what is owed on a
 * statement.
 *
 * Built on the same kit as the invoice so the two read as one stationery set.
 */

import {
  createDocument,
  drawHeader,
  drawHighlightBand,
  drawPartyBlocks,
  drawMetaGrid,
  drawTable,
  drawTotals,
  drawNotes,
  ensureSpace,
  finalise,
} from "@/lib/documents/kit";
import {
  BRAND,
  TYPE,
  money,
  shortDate,
  dateRangeLabel,
  type OrganizationLike,
} from "@/lib/documents/brand";

export interface StatementEntry {
  date: Date;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  /** Running balance after this entry. */
  balance: number;
}

export interface StatementDocumentData {
  customer: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
  };
  period: { from: Date; to: Date };
  openingBalance: number;
  entries: StatementEntry[];
  /**
   * Everything the customer owes today, across every unpaid invoice — not
   * just the ones inside this period. Comes from
   * lib/metrics/customer-balance.ts, the one definition of the figure.
   */
  totalOutstanding: number;
  organization?: OrganizationLike | null;
  /** Statement number, e.g. STM-2026-09-ACME. */
  statementNumber: string;
}

export function generateStatementPDF(data: StatementDocumentData): Uint8Array {
  const { customer, period, entries } = data;

  const ctx = createDocument({
    organization: data.organization,
    title: `Statement ${data.statementNumber}`,
  });

  drawHeader(ctx, {
    title: "Statement of Account",
    docNo: data.statementNumber,
    date: period.to,
    metaLines: [dateRangeLabel(period.from, period.to)],
    // Same as the invoice: this is posted to a customer, so it carries our
    // address. A report, which stays inside the company, does not.
    showCompanyBlock: true,
  });

  // The whole point of the document, in the largest type on the page.
  drawHighlightBand(
    ctx,
    { label: "Amount due", value: money(data.totalOutstanding) },
    { label: "As at", value: shortDate(period.to) },
  );

  drawPartyBlocks(ctx, {
    heading: "To",
    lines: [
      customer.name,
      ...(customer.address ? customer.address.split("\n") : []),
      [customer.phone, customer.email].filter(Boolean).join("  ·  "),
    ].filter(Boolean),
  });

  drawMetaGrid(ctx, [
    { label: "Statement date", value: shortDate(period.to) },
    { label: "Period", value: dateRangeLabel(period.from, period.to) },
    { label: "VAT No", value: customer.taxId?.trim() || "—" },
  ]);

  const closingBalance =
    entries.length > 0 ? entries[entries.length - 1].balance : data.openingBalance;

  drawTable(
    ctx,
    // A portrait page gives 174mm between the margins. These fixed widths
    // come to 128, leaving 46 for the description — set any wider and the
    // description wraps to one word per line.
    [
      { header: "Date", key: "date", width: 20 },
      { header: "Type", key: "type", width: 16 },
      { header: "Reference", key: "reference", width: 24 },
      { header: "Description", key: "description" },
      { header: "Debit", key: "debit", align: "right", width: 22 },
      { header: "Credit", key: "credit", align: "right", width: 22 },
      { header: "Balance", key: "balance", align: "right", width: 24 },
    ],
    [
      {
        date: shortDate(period.from),
        type: "",
        reference: "",
        description: "Balance brought forward",
        debit: "",
        credit: "",
        balance: money(data.openingBalance),
      },
      // A period with no movement still shows the brought-forward line, so
      // the table is never empty and drawTable's own empty message can never
      // fire — say it in a row instead, or the reader is left wondering
      // whether the statement failed to load.
      ...(entries.length === 0
        ? [
            {
              date: "",
              type: "",
              reference: "",
              description: "No invoices or payments in this period",
              debit: "",
              credit: "",
              balance: "",
            },
          ]
        : []),
      ...entries.map((entry) => ({
        date: shortDate(entry.date),
        type: entry.type === "INVOICE" ? "Invoice" : "Payment",
        reference: entry.reference,
        description: entry.description,
        debit: entry.debit > 0 ? money(entry.debit) : "",
        credit: entry.credit > 0 ? money(entry.credit) : "",
        balance: money(entry.balance),
      })),
    ],
  );

  const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);

  drawTotals(ctx, [
    { label: "Balance brought forward", value: money(data.openingBalance) },
    { label: "Invoiced this period", value: money(totalDebits) },
    { label: "Received this period", value: money(totalCredits) },
    { label: "Closing balance", value: money(closingBalance), emphasis: true },
  ]);

  // Where the closing balance and the amount due differ, say why rather than
  // leaving two numbers on one page contradicting each other: the closing
  // balance is this period's arithmetic, the amount due is every unpaid
  // invoice including ones older than the period.
  if (Math.abs(closingBalance - data.totalOutstanding) > 0.01) {
    drawNotes(
      ctx,
      "About these figures",
      `The closing balance covers ${dateRangeLabel(period.from, period.to)}. ` +
        `Amount due is everything outstanding on the account as at ` +
        `${shortDate(period.to)}, including invoices raised before this period.`,
    );
  }

  drawNotes(
    ctx,
    "Terms",
    "Please settle the amount due within 30 days of the statement date. " +
      "Quote the invoice reference with your payment.",
  );

  const company = ctx.company;
  if (company.bankDetails) {
    drawNotes(ctx, "Payment details", company.bankDetails);
  }

  ensureSpace(ctx, 16);
  ctx.doc.setFontSize(TYPE.small);
  ctx.doc.setTextColor(...BRAND.muted);
  ctx.doc.text(
    "If any item on this statement is unfamiliar, contact us before the due date.",
    ctx.margin,
    ctx.y,
  );

  return finalise(ctx, { docNo: `Statement ${data.statementNumber}` });
}
