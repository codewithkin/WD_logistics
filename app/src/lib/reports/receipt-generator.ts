/**
 * Dedicated Payment Receipt PDF generator.
 *
 * Deliberately separate from PDFReportGenerator (pdf-report-generator.ts),
 * which renders internal financial reports in a plain black-and-white
 * "accounting" style on purpose. A receipt is customer-facing, so it gets
 * its own clean, on-brand template: the WD Logistics logo, a light green
 * (never black) table header, and blue used only as a small accent.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

declare module "jspdf" {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

// Brand palette (matches the green/blue used in the logo and the app's
// --primary token) — kept as plain RGB tuples since jsPDF doesn't read CSS.
const BRAND_GREEN: [number, number, number] = [22, 163, 74]; // green-600
const BRAND_GREEN_LIGHT: [number, number, number] = [220, 245, 227]; // light tint for table header/highlight fill
const BRAND_BLUE: [number, number, number] = [37, 99, 235]; // blue-600 — sparing accent only
const INK: [number, number, number] = [31, 41, 55]; // slate-800, body text
const MUTED: [number, number, number] = [107, 114, 128]; // slate-500, secondary text
const BORDER: [number, number, number] = [229, 231, 235]; // slate-200, hairlines

let cachedLogo: string | null | undefined;

function getLogoDataUrl(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const bytes = fs.readFileSync(logoPath);
    cachedLogo = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    cachedLogo = null; // Falls back to a text wordmark if the file is ever missing.
  }
  return cachedLogo;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export interface PaymentReceiptData {
  payment: {
    id: string;
    amount: number;
    paymentDate: Date | string;
    method: string;
    customMethod: string | null;
    reference: string | null;
    notes: string | null;
  };
  invoice: {
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    balance: number;
  } | null;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  organization: {
    name: string;
  };
}

export function generatePaymentReceiptPDF(data: PaymentReceiptData): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  const receiptNumber = `RCP-${data.payment.id.slice(-8).toUpperCase()}`;
  const paymentMethod =
    data.payment.method === "other" && data.payment.customMethod
      ? data.payment.customMethod
      : data.payment.method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  doc.setFont("helvetica", "normal");

  // ---- Header: logo + company name on the left, receipt meta on the right ----
  const logo = getLogoDataUrl();
  let headerTextX = margin;
  if (logo) {
    const logoSize = 16;
    doc.addImage(logo, "PNG", margin, 14, logoSize, logoSize);
    headerTextX = margin + logoSize + 4;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(data.organization.name, headerTextX, 21);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Fleet & Logistics Management", headerTextX, 26.5);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text("RECEIPT", pageWidth - margin, 20, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(receiptNumber, pageWidth - margin, 25.5, { align: "right" });
  doc.text(formatDate(data.payment.paymentDate), pageWidth - margin, 30, { align: "right" });

  // Thin green accent rule under the header — no heavy/black bars.
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, 36, pageWidth - margin, 36);

  let y = 46;

  // ---- Amount highlight band (the one place we lean on color) ----
  doc.setFillColor(...BRAND_GREEN_LIGHT);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("AMOUNT RECEIVED", margin + 6, y + 8);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text(formatCurrency(data.payment.amount), margin + 6, y + 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("PAYMENT METHOD", pageWidth - margin - 6, y + 8, { align: "right" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(paymentMethod, pageWidth - margin - 6, y + 16, { align: "right" });

  y += 30;

  // ---- Received from ----
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Received From", margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.text(data.customer.name, margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const contactLine = [data.customer.email, data.customer.phone].filter(Boolean).join("  •  ");
  if (contactLine) {
    doc.text(contactLine, margin, y);
    y += 5;
  }
  if (data.customer.address) {
    doc.text(data.customer.address, margin, y);
    y += 5;
  }

  y += 4;

  // ---- Payment detail table: light green header, no borders on body rows ----
  const rows: [string, string][] = [
    ["Reference", data.payment.reference || "—"],
    ["Payment Date", formatDate(data.payment.paymentDate)],
  ];
  if (data.invoice) {
    rows.push(["Invoice", data.invoice.invoiceNumber]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Description", "Details"]],
    body: rows,
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    headStyles: {
      fillColor: BRAND_GREEN_LIGHT,
      textColor: BRAND_GREEN,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      1: { halign: "left" },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ---- Invoice balance summary (blue used sparingly, only for "remaining") ----
  if (data.invoice) {
    const summaryRows: [string, string][] = [
      [`Invoice ${data.invoice.invoiceNumber} Total`, formatCurrency(data.invoice.total)],
      ["Previous Payments", formatCurrency(data.invoice.amountPaid - data.payment.amount)],
      ["This Payment", formatCurrency(data.payment.amount)],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Invoice Summary", "Amount"]],
      body: summaryRows,
      theme: "plain",
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        textColor: INK,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      headStyles: {
        fillColor: BRAND_GREEN_LIGHT,
        textColor: BRAND_GREEN,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      columnStyles: {
        1: { halign: "right" },
      },
      didParseCell: (cellData) => {
        if (cellData.section === "body" && cellData.column.index === 1) {
          cellData.cell.styles.halign = "right";
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;

    // Remaining balance called out on its own — blue, the one sparing use.
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text("Remaining Balance", margin, y);
    doc.setTextColor(data.invoice.balance > 0 ? BRAND_BLUE[0] : BRAND_GREEN[0], data.invoice.balance > 0 ? BRAND_BLUE[1] : BRAND_GREEN[1], data.invoice.balance > 0 ? BRAND_BLUE[2] : BRAND_GREEN[2]);
    doc.text(formatCurrency(data.invoice.balance), pageWidth - margin, y, { align: "right" });
    y += 10;
  }

  if (data.payment.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...MUTED);
    const noteLines = doc.splitTextToSize(`Note: ${data.payment.notes}`, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 4;
  }

  // ---- Footer ----
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text("Thank you for your payment!", margin, pageHeight - 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Generated by ${data.organization.name} on ${formatDate(new Date())}`, margin, pageHeight - 10);
  doc.text(receiptNumber, pageWidth - margin, pageHeight - 10, { align: "right" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
