import "server-only";

/**
 * The drawing primitives every generated document is built from.
 *
 * One header, one table style, one totals block, one footer — so a receipt, an
 * invoice, a statement and a fleet report are recognisably the same
 * stationery. Templates compose these; they do not call jsPDF's text and rect
 * directly, because that is how the app ended up with two visual systems in
 * the first place.
 *
 * Server-only, because `brand.ts` reads the logo off disk. Never import this
 * from a client component.
 */

import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import {
  BRAND,
  LAYOUT,
  TYPE,
  companyDetails,
  dateRangeLabel,
  logoDataUrl,
  money,
  shortDate,
  type CompanyDetails,
  type OrganizationLike,
  type Rgb,
} from "@/lib/documents/brand";

export type { CompanyDetails, OrganizationLike };
export { BRAND, LAYOUT, TYPE, dateRangeLabel, money, shortDate };

export interface DocContext {
  doc: jsPDF;
  company: CompanyDetails;
  pageWidth: number;
  contentWidth: number;
  margin: number;
  /** Current drawing position, in mm from the top. */
  y: number;
}

export function createDocument(options?: {
  organization?: OrganizationLike | null;
  orientation?: "portrait" | "landscape";
  title?: string;
}): DocContext {
  const doc = new jsPDF({
    orientation: options?.orientation ?? "portrait",
    unit: "mm",
    format: "a4",
  });

  // Metadata, so a downloaded file is identifiable outside the app.
  const company = companyDetails(options?.organization);
  doc.setProperties({
    title: options?.title ?? "WD Logistics document",
    author: company.name,
    creator: company.name,
  });

  doc.setFont(TYPE.family, "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = LAYOUT.margin;

  return {
    doc,
    company,
    pageWidth,
    margin,
    contentWidth: pageWidth - margin * 2,
    y: LAYOUT.contentTop,
  };
}

export interface HeaderOptions {
  /** "INVOICE", "RECEIPT", "TRUCK COST BREAKDOWN". */
  title: string;
  /** Document number, shown under the title. */
  docNo?: string;
  /** Date shown under the number. */
  date?: Date | string;
  /** Extra right-aligned lines, e.g. "Due 30 Sep 2026". */
  metaLines?: string[];
  /** A small pill beside the title, e.g. "PAID" or "OVERDUE". */
  statusPill?: { label: string; tone?: "green" | "warn" | "danger" | "muted" };
  /** Full company block under the name — invoices need it, reports don't. */
  showCompanyBlock?: boolean;
}

/**
 * Logo and organisation on the left, document identity on the right, a thin
 * green rule underneath. Never a heavy black bar.
 */
export function drawHeader(ctx: DocContext, options: HeaderOptions): void {
  const { doc, company, pageWidth, margin } = ctx;

  const logo = logoDataUrl();
  let textX = margin;
  if (logo) {
    const size = 16;
    doc.addImage(logo, "PNG", margin, 14, size, size);
    textX = margin + size + 4;
  }

  doc.setFontSize(TYPE.orgName);
  doc.setFont(TYPE.family, "bold");
  doc.setTextColor(...BRAND.ink);
  doc.text(company.name, textX, 21);

  doc.setFontSize(TYPE.label);
  doc.setFont(TYPE.family, "normal");
  doc.setTextColor(...BRAND.muted);

  if (options.showCompanyBlock) {
    let blockY = 26;
    for (const line of company.addressLines) {
      doc.text(line, textX, blockY);
      blockY += 3.8;
    }
    const contact = [
      company.phone ? `Cell: ${company.phone}` : null,
      company.altPhone,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (contact) {
      doc.text(contact, textX, blockY);
      blockY += 3.8;
    }
    if (company.email) {
      doc.text(`Email: ${company.email}`, textX, blockY);
    }
  } else {
    doc.text(company.motto, textX, 26.5);
  }

  // ---- Right side: what this document is ----
  doc.setFontSize(TYPE.docTitle);
  doc.setFont(TYPE.family, "bold");
  doc.setTextColor(...BRAND.green);
  doc.text(options.title.toUpperCase(), pageWidth - margin, 20, {
    align: "right",
  });

  let metaY = 25.5;
  doc.setFontSize(TYPE.label);
  doc.setFont(TYPE.family, "normal");
  doc.setTextColor(...BRAND.muted);

  if (options.docNo) {
    doc.text(options.docNo, pageWidth - margin, metaY, { align: "right" });
    metaY += 4.5;
  }
  if (options.date) {
    doc.text(shortDate(options.date), pageWidth - margin, metaY, {
      align: "right",
    });
    metaY += 4.5;
  }
  for (const line of options.metaLines ?? []) {
    doc.text(line, pageWidth - margin, metaY, { align: "right" });
    metaY += 4.5;
  }

  if (options.statusPill) {
    drawPill(ctx, options.statusPill, pageWidth - margin, metaY - 1);
  }

  doc.setDrawColor(...BRAND.green);
  doc.setLineWidth(0.8);
  doc.line(margin, LAYOUT.headerRuleY, pageWidth - margin, LAYOUT.headerRuleY);

  ctx.y = Math.max(LAYOUT.contentTop, metaY + 6);
}

const PILL_TONES: Record<string, { fill: Rgb; text: Rgb }> = {
  green: { fill: BRAND.greenLight, text: BRAND.green },
  warn: { fill: [254, 243, 199], text: BRAND.warn },
  danger: { fill: [254, 226, 226], text: BRAND.danger },
  muted: { fill: [243, 244, 246], text: BRAND.muted },
};

function drawPill(
  ctx: DocContext,
  pill: { label: string; tone?: "green" | "warn" | "danger" | "muted" },
  rightX: number,
  y: number,
): void {
  const { doc } = ctx;
  const tone = PILL_TONES[pill.tone ?? "muted"];
  const label = pill.label.toUpperCase();

  doc.setFontSize(TYPE.small);
  doc.setFont(TYPE.family, "bold");
  const textWidth = doc.getTextWidth(label);
  const padding = 3;
  const width = textWidth + padding * 2;
  const height = 5.5;

  doc.setFillColor(...tone.fill);
  doc.roundedRect(rightX - width, y, width, height, 1.2, 1.2, "F");
  doc.setTextColor(...tone.text);
  doc.text(label, rightX - width / 2, y + 3.8, { align: "center" });
}

/**
 * The one place a document leans on colour: a tinted band carrying the
 * number that matters most — amount due, amount received, profit.
 */
export function drawHighlightBand(
  ctx: DocContext,
  left: { label: string; value: string; tone?: "green" | "danger" },
  right?: { label: string; value: string },
): void {
  const { doc, margin, contentWidth, pageWidth } = ctx;
  const height = 20;

  doc.setFillColor(...BRAND.greenLight);
  doc.roundedRect(margin, ctx.y, contentWidth, height, 2, 2, "F");

  doc.setFontSize(TYPE.label);
  doc.setFont(TYPE.family, "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text(left.label.toUpperCase(), margin + 6, ctx.y + 8);

  doc.setFontSize(TYPE.amount);
  doc.setFont(TYPE.family, "bold");
  doc.setTextColor(...(left.tone === "danger" ? BRAND.danger : BRAND.green));
  doc.text(left.value, margin + 6, ctx.y + 16);

  if (right) {
    doc.setFontSize(TYPE.label);
    doc.setFont(TYPE.family, "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(right.label.toUpperCase(), pageWidth - margin - 6, ctx.y + 8, {
      align: "right",
    });
    doc.setFontSize(12);
    doc.setFont(TYPE.family, "bold");
    doc.setTextColor(...BRAND.ink);
    doc.text(right.value, pageWidth - margin - 6, ctx.y + 16, {
      align: "right",
    });
  }

  ctx.y += height + 10;
}

export interface PartyBlock {
  heading: string;
  lines: string[];
}

/** Two address blocks side by side — "Bill To" and "From" on an invoice. */
export function drawPartyBlocks(
  ctx: DocContext,
  left: PartyBlock,
  right?: PartyBlock,
): void {
  const { doc, margin, contentWidth } = ctx;
  const columnWidth = right ? contentWidth / 2 - 4 : contentWidth;
  const startY = ctx.y;

  const drawBlock = (block: PartyBlock, x: number) => {
    let y = startY;
    doc.setFontSize(TYPE.small);
    doc.setFont(TYPE.family, "bold");
    doc.setTextColor(...BRAND.muted);
    doc.text(block.heading.toUpperCase(), x, y);
    y += 5;

    doc.setFontSize(TYPE.body);
    doc.setFont(TYPE.family, "normal");
    doc.setTextColor(...BRAND.ink);
    for (const line of block.lines.filter(Boolean)) {
      // Wrap rather than overflow into the neighbouring column.
      for (const wrapped of doc.splitTextToSize(line, columnWidth)) {
        doc.text(wrapped, x, y);
        y += 4.4;
      }
    }
    return y;
  };

  const leftEnd = drawBlock(left, margin);
  const rightEnd = right
    ? drawBlock(right, margin + contentWidth / 2 + 4)
    : startY;

  ctx.y = Math.max(leftEnd, rightEnd) + 6;
}

/** A compact label/value grid — invoice meta, report parameters. */
export function drawMetaGrid(
  ctx: DocContext,
  entries: Array<{ label: string; value: string }>,
  columns = 3,
): void {
  const { doc, margin, contentWidth } = ctx;
  if (entries.length === 0) return;

  const columnWidth = contentWidth / columns;
  let row = 0;

  entries.forEach((entry, index) => {
    const column = index % columns;
    if (column === 0 && index > 0) row += 1;
    const x = margin + column * columnWidth;
    const y = ctx.y + row * 11;

    doc.setFontSize(TYPE.small);
    doc.setFont(TYPE.family, "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(entry.label.toUpperCase(), x, y);

    doc.setFontSize(TYPE.body);
    doc.setFont(TYPE.family, "bold");
    doc.setTextColor(...BRAND.ink);
    doc.text(entry.value, x, y + 4.8);
  });

  ctx.y += (row + 1) * 11 + 4;
}

/** A row of headline figures across the top of a report. */
export function drawKpiRow(
  ctx: DocContext,
  kpis: Array<{ label: string; value: string; tone?: "green" | "danger" }>,
): void {
  const { doc, margin, contentWidth } = ctx;
  if (kpis.length === 0) return;

  const gap = 3;
  const width = (contentWidth - gap * (kpis.length - 1)) / kpis.length;
  const height = 18;

  kpis.forEach((kpi, index) => {
    const x = margin + index * (width + gap);

    doc.setFillColor(...BRAND.zebra);
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, ctx.y, width, height, 1.5, 1.5, "FD");

    doc.setFontSize(TYPE.small);
    doc.setFont(TYPE.family, "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(kpi.label.toUpperCase(), x + 3, ctx.y + 6);

    doc.setFontSize(12);
    doc.setFont(TYPE.family, "bold");
    doc.setTextColor(
      ...(kpi.tone === "danger"
        ? BRAND.danger
        : kpi.tone === "green"
          ? BRAND.green
          : BRAND.ink),
    );
    // Shrink rather than overflow the tile when a figure is long.
    let size = 12;
    while (doc.getTextWidth(kpi.value) > width - 6 && size > 7) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    doc.text(kpi.value, x + 3, ctx.y + 13.5);
  });

  ctx.y += height + 8;
}

export interface TableColumn {
  header: string;
  /** Key into each row object. */
  key: string;
  align?: "left" | "right" | "center";
  /** Column width in mm; omit to let autoTable decide. */
  width?: number;
}

/**
 * The house table: light-green header, zebra body, hairline rules, numerics
 * right-aligned, and the header repeated on every page break.
 */
export function drawTable(
  ctx: DocContext,
  columns: TableColumn[],
  rows: Array<Record<string, string | number>>,
  options?: {
    title?: string;
    /** A totals row rendered in bold at the foot. */
    foot?: Array<string | number>;
    emptyMessage?: string;
  },
): void {
  const { doc, margin } = ctx;

  if (options?.title) {
    drawSectionHeading(ctx, options.title);
  }

  if (rows.length === 0) {
    doc.setFontSize(TYPE.body);
    doc.setFont(TYPE.family, "italic");
    doc.setTextColor(...BRAND.muted);
    doc.text(
      options?.emptyMessage ?? "No data for this period.",
      margin,
      ctx.y + 4,
    );
    ctx.y += 12;
    return;
  }

  const columnStyles: UserOptions["columnStyles"] = {};
  columns.forEach((column, index) => {
    columnStyles[index] = {
      halign: column.align ?? "left",
      ...(column.width ? { cellWidth: column.width } : {}),
    };
  });

  autoTable(doc, {
    startY: ctx.y,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) =>
      columns.map((column) => {
        const value = row[column.key];
        return value === undefined || value === null ? "—" : String(value);
      }),
    ),
    foot: options?.foot ? [options.foot.map(String)] : undefined,
    theme: "plain",
    margin: { left: margin, right: margin, bottom: LAYOUT.footerReserve },
    styles: {
      font: TYPE.family,
      fontSize: TYPE.body,
      textColor: BRAND.ink,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
      lineColor: BRAND.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND.greenLight,
      textColor: BRAND.green,
      fontStyle: "bold",
      fontSize: TYPE.label,
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: BRAND.ink,
      fontStyle: "bold",
      fontSize: TYPE.body,
    },
    alternateRowStyles: { fillColor: BRAND.zebra },
    columnStyles,
    // Repeats the header on every page; autoTable does this by default, but
    // being explicit stops a future theme change from silently dropping it.
    showHead: "everyPage",
  });

  ctx.y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;
}

export function drawSectionHeading(ctx: DocContext, text: string): void {
  const { doc, margin } = ctx;
  ensureSpace(ctx, 16);
  doc.setFontSize(TYPE.heading);
  doc.setFont(TYPE.family, "bold");
  doc.setTextColor(...BRAND.ink);
  doc.text(text, margin, ctx.y);
  ctx.y += 6;
}

/**
 * Right-aligned totals: subtotal, tax, total, paid, balance. The last entry
 * is emphasised, because that is the number the reader came for.
 */
export function drawTotals(
  ctx: DocContext,
  entries: Array<{ label: string; value: string; emphasis?: boolean }>,
): void {
  const { doc, pageWidth, margin } = ctx;
  const blockWidth = 72;
  const x = pageWidth - margin - blockWidth;

  ensureSpace(ctx, entries.length * 6 + 10);

  entries.forEach((entry, index) => {
    const y = ctx.y + index * 6;
    const emphasis = entry.emphasis ?? index === entries.length - 1;

    if (emphasis) {
      doc.setDrawColor(...BRAND.border);
      doc.setLineWidth(0.2);
      doc.line(x, y - 4, pageWidth - margin, y - 4);
    }

    doc.setFontSize(emphasis ? TYPE.heading : TYPE.body);
    doc.setFont(TYPE.family, emphasis ? "bold" : "normal");
    doc.setTextColor(...(emphasis ? BRAND.ink : BRAND.muted));
    doc.text(entry.label, x, y);

    doc.setTextColor(...(emphasis ? BRAND.green : BRAND.ink));
    doc.text(entry.value, pageWidth - margin, y, { align: "right" });
  });

  ctx.y += entries.length * 6 + 6;
}

/** A short prose block — notes, terms, payment details. */
export function drawNotes(
  ctx: DocContext,
  heading: string,
  body: string,
): void {
  if (!body.trim()) return;
  const { doc, margin, contentWidth } = ctx;

  const lines = doc.splitTextToSize(body, contentWidth);
  ensureSpace(ctx, lines.length * 4.4 + 12);

  doc.setFontSize(TYPE.small);
  doc.setFont(TYPE.family, "bold");
  doc.setTextColor(...BRAND.muted);
  doc.text(heading.toUpperCase(), margin, ctx.y);
  ctx.y += 5;

  doc.setFontSize(TYPE.body);
  doc.setFont(TYPE.family, "normal");
  doc.setTextColor(...BRAND.ink);
  for (const line of lines) {
    doc.text(line, margin, ctx.y);
    ctx.y += 4.4;
  }
  ctx.y += 4;
}

/** "Period: 1 Jul 2026 – 30 Sep 2026", under a report's header. */
export function drawPeriodLine(ctx: DocContext, label: string): void {
  const { doc, margin } = ctx;
  doc.setFontSize(TYPE.label);
  doc.setFont(TYPE.family, "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text(label, margin, ctx.y);
  ctx.y += 8;
}

/** A signature rule, for documents that are handed over physically. */
export function drawSignature(ctx: DocContext, label = "Signature"): void {
  const { doc, margin } = ctx;
  ensureSpace(ctx, 20);
  ctx.y += 8;
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);
  doc.line(margin, ctx.y, margin + 70, ctx.y);
  doc.setFontSize(TYPE.small);
  doc.setFont(TYPE.family, "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text(label, margin, ctx.y + 4);
  ctx.y += 12;
}

/**
 * Starts a new page when less than `needed` mm remain above the footer.
 * Templates call this before drawing anything tall enough to be orphaned.
 */
export function ensureSpace(ctx: DocContext, needed: number): void {
  const limit = LAYOUT.pageHeight - LAYOUT.footerReserve;
  if (ctx.y + needed > limit) {
    ctx.doc.addPage();
    ctx.y = 20;
  }
}

/**
 * The footer, drawn on every page in a final pass.
 *
 * It has to be last: "Page 1 of 4" cannot be written until the document knows
 * it has four pages, which is only true once the content is laid out.
 */
export function finalise(
  ctx: DocContext,
  options?: { note?: string; docNo?: string },
): Uint8Array {
  const { doc, company, pageWidth, margin } = ctx;
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 10;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 5, pageWidth - margin, y - 5);

    doc.setFontSize(TYPE.footer);
    doc.setFont(TYPE.family, "normal");
    doc.setTextColor(...BRAND.muted);

    const left = options?.note ?? company.motto;
    doc.text(left, margin, y);

    if (options?.docNo) {
      doc.text(options.docNo, pageWidth / 2, y, { align: "center" });
    }

    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, y, {
      align: "right",
    });

    doc.text(
      `Generated ${shortDate(new Date())}`,
      margin,
      y + 3.5,
    );
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
