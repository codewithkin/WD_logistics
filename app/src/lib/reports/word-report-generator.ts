"use server";

/**
 * The customer detail report as a .docx.
 *
 * Rebuilt on `lib/documents/word-kit`, which carries the same logo, palette
 * and shaded table headers as the PDFs. Before this, the same report looked
 * like it came from a different company depending on whether you pressed
 * "PDF" or "Word": grey Calibri, a centred text wordmark and no logo at all.
 *
 * The data shape is unchanged, so the caller in customers/actions.ts did not
 * have to move.
 */

import { Document, Packer, Paragraph } from "docx";
import {
  brandFooter,
  brandHeader,
  brandTable,
  kpiTable,
  notesBlock,
  sectionHeading,
  sectionProperties,
  titleBlock,
} from "@/lib/documents/word-kit";

interface CustomerReportData {
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    balance: number;
  };
  trips: Array<{
    id: string;
    tripNumber: string;
    origin: string;
    destination: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string | null;
    fare: number;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: Date | string;
    dueDate: Date | string | null;
    total: number;
    amountPaid: number;
    balance: number;
    status: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: Date | string;
    method: string;
    reference: string | null;
    invoiceNumber: string;
  }>;
  summary: {
    totalTrips: number;
    totalInvoiced: number;
    totalPaid: number;
    totalOwed: number;
  };
  generatedAt: Date;
  organizationName: string;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function generateCustomerDetailReportWord(
  data: CustomerReportData,
): Promise<Uint8Array> {
  // The header reads the organisation's own details; only the name reaches
  // this function, so it is passed through as the one field that differs.
  const organization = { name: data.organizationName };

  const doc = new Document({
    sections: [
      {
        properties: sectionProperties(),
        headers: { default: brandHeader(organization) },
        footers: { default: brandFooter(organization) },
        children: [
          ...titleBlock(
            "Customer Statement",
            `${data.customer.name} · generated ${formatDate(data.generatedAt)}`,
          ),

          kpiTable([
            { label: "Trips", value: String(data.summary.totalTrips) },
            { label: "Invoiced", value: formatCurrency(data.summary.totalInvoiced) },
            { label: "Paid", value: formatCurrency(data.summary.totalPaid) },
            { label: "Outstanding", value: formatCurrency(data.summary.totalOwed) },
          ]),

          sectionHeading("Customer"),
          brandTable(
            [
              { header: "Field", width: 25 },
              { header: "Detail", width: 75 },
            ],
            [
              ["Name", data.customer.name],
              ["Status", data.customer.status],
              ["Email", data.customer.email ?? "—"],
              ["Phone", data.customer.phone ?? "—"],
              ["Address", data.customer.address ?? "—"],
              ["Account balance", formatCurrency(data.customer.balance)],
            ],
          ),

          sectionHeading("Trips"),
          brandTable(
            [
              { header: "Trip" },
              { header: "Route" },
              { header: "Started" },
              { header: "Ended" },
              { header: "Status" },
              { header: "Fare", align: "right" },
            ],
            data.trips.map((trip) => [
              trip.tripNumber,
              `${trip.origin} - ${trip.destination}`,
              formatDate(trip.startDate),
              formatDate(trip.endDate),
              trip.status,
              formatCurrency(trip.fare),
            ]),
            {
              total: [
                "Total",
                "",
                "",
                "",
                `${data.summary.totalTrips} trips`,
                formatCurrency(data.trips.reduce((sum, t) => sum + t.fare, 0)),
              ],
              emptyMessage: "No trips recorded for this customer.",
            },
          ),

          sectionHeading("Invoices"),
          brandTable(
            [
              { header: "Invoice" },
              { header: "Issued" },
              { header: "Due" },
              { header: "Status" },
              { header: "Total", align: "right" },
              { header: "Paid", align: "right" },
              { header: "Balance", align: "right" },
            ],
            data.invoices.map((invoice) => [
              invoice.invoiceNumber,
              formatDate(invoice.issueDate),
              formatDate(invoice.dueDate),
              invoice.status,
              formatCurrency(invoice.total),
              formatCurrency(invoice.amountPaid),
              formatCurrency(invoice.balance),
            ]),
            {
              total: [
                "Total",
                "",
                "",
                "",
                formatCurrency(data.summary.totalInvoiced),
                formatCurrency(data.summary.totalPaid),
                formatCurrency(data.summary.totalOwed),
              ],
              emptyMessage: "No invoices raised for this customer.",
            },
          ),

          sectionHeading("Payments"),
          brandTable(
            [
              { header: "Date" },
              { header: "Invoice" },
              { header: "Method" },
              { header: "Reference" },
              { header: "Amount", align: "right" },
            ],
            data.payments.map((payment) => [
              formatDate(payment.paymentDate),
              payment.invoiceNumber,
              payment.method,
              payment.reference ?? "—",
              formatCurrency(payment.amount),
            ]),
            {
              total: [
                "Total",
                "",
                "",
                "",
                formatCurrency(
                  data.payments.reduce((sum, p) => sum + p.amount, 0),
                ),
              ],
              emptyMessage: "No payments received from this customer.",
            },
          ),

          ...notesBlock(
            "About this statement",
            "Invoiced is the total raised against this customer; paid is what " +
              "has been received against those invoices; outstanding is the " +
              "difference. Trip fares are shown for reference and may differ " +
              "from the invoiced total where a trip has not yet been billed.",
          ),

          new Paragraph(""),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
