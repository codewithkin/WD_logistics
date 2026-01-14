"use server";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";

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
    dueDate: Date | string;
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

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function createTableHeaderCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { fill: "e0e0e0" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

function createTableCell(text: string, alignment: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20 })],
        alignment,
      }),
    ],
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

export async function generateCustomerDetailReportWord(data: CustomerReportData): Promise<Uint8Array> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        children: [
          // Header
          new Paragraph({
            children: [
              new TextRun({
                text: data.organizationName || "WD Logistics",
                bold: true,
                size: 36,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Customer Detail Report",
                bold: true,
                size: 28,
                color: "666666",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Customer Information Section
          new Paragraph({
            text: "Customer Information",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 },
            },
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell("Name"),
                  createTableCell(data.customer.name),
                  createTableHeaderCell("Status"),
                  createTableCell(data.customer.status),
                ],
              }),
              new TableRow({
                children: [
                  createTableHeaderCell("Email"),
                  createTableCell(data.customer.email || "N/A"),
                  createTableHeaderCell("Phone"),
                  createTableCell(data.customer.phone || "N/A"),
                ],
              }),
              new TableRow({
                children: [
                  createTableHeaderCell("Address"),
                  createTableCell(data.customer.address || "N/A"),
                  createTableHeaderCell("Balance"),
                  createTableCell(
                    `${formatCurrency(Math.abs(data.customer.balance))} ${data.customer.balance > 0 ? "(Credit)" : data.customer.balance < 0 ? "(Owed)" : ""}`
                  ),
                ],
              }),
            ],
          }),

          // Summary Section
          new Paragraph({
            text: "Account Summary",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 },
            },
            rows: [
              new TableRow({
                children: [
                  createTableHeaderCell("Total Trips"),
                  createTableCell(data.summary.totalTrips.toString(), AlignmentType.CENTER),
                  createTableHeaderCell("Total Invoiced"),
                  createTableCell(formatCurrency(data.summary.totalInvoiced), AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  createTableHeaderCell("Total Paid"),
                  createTableCell(formatCurrency(data.summary.totalPaid), AlignmentType.RIGHT),
                  createTableHeaderCell("Amount Owed"),
                  createTableCell(formatCurrency(data.summary.totalOwed), AlignmentType.RIGHT),
                ],
              }),
            ],
          }),

          // Trips Section
          new Paragraph({
            text: "Trip History",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...(data.trips.length > 0
            ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        createTableHeaderCell("Trip #"),
                        createTableHeaderCell("Origin"),
                        createTableHeaderCell("Destination"),
                        createTableHeaderCell("Start Date"),
                        createTableHeaderCell("Status"),
                        createTableHeaderCell("Fare"),
                      ],
                    }),
                    ...data.trips.map(
                      (trip) =>
                        new TableRow({
                          children: [
                            createTableCell(trip.tripNumber),
                            createTableCell(trip.origin),
                            createTableCell(trip.destination),
                            createTableCell(formatDate(trip.startDate)),
                            createTableCell(trip.status),
                            createTableCell(formatCurrency(trip.fare), AlignmentType.RIGHT),
                          ],
                        })
                    ),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  text: "No trips found for this customer.",
                  spacing: { after: 200 },
                }),
              ]),

          // Invoices Section
          new Paragraph({
            text: "Invoice History",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...(data.invoices.length > 0
            ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        createTableHeaderCell("Invoice #"),
                        createTableHeaderCell("Issue Date"),
                        createTableHeaderCell("Due Date"),
                        createTableHeaderCell("Total"),
                        createTableHeaderCell("Paid"),
                        createTableHeaderCell("Balance"),
                        createTableHeaderCell("Status"),
                      ],
                    }),
                    ...data.invoices.map(
                      (invoice) =>
                        new TableRow({
                          children: [
                            createTableCell(invoice.invoiceNumber),
                            createTableCell(formatDate(invoice.issueDate)),
                            createTableCell(formatDate(invoice.dueDate)),
                            createTableCell(formatCurrency(invoice.total), AlignmentType.RIGHT),
                            createTableCell(formatCurrency(invoice.amountPaid), AlignmentType.RIGHT),
                            createTableCell(formatCurrency(invoice.balance), AlignmentType.RIGHT),
                            createTableCell(invoice.status),
                          ],
                        })
                    ),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  text: "No invoices found for this customer.",
                  spacing: { after: 200 },
                }),
              ]),

          // Payments Section
          new Paragraph({
            text: "Payment History",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...(data.payments.length > 0
            ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        createTableHeaderCell("Invoice #"),
                        createTableHeaderCell("Payment Date"),
                        createTableHeaderCell("Method"),
                        createTableHeaderCell("Reference"),
                        createTableHeaderCell("Amount"),
                      ],
                    }),
                    ...data.payments.map(
                      (payment) =>
                        new TableRow({
                          children: [
                            createTableCell(payment.invoiceNumber),
                            createTableCell(formatDate(payment.paymentDate)),
                            createTableCell(payment.method),
                            createTableCell(payment.reference || "N/A"),
                            createTableCell(formatCurrency(payment.amount), AlignmentType.RIGHT),
                          ],
                        })
                    ),
                  ],
                }),
              ]
            : [
                new Paragraph({
                  text: "No payments found for this customer.",
                  spacing: { after: 200 },
                }),
              ]),

          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on ${formatDate(data.generatedAt)}`,
                size: 18,
                color: "888888",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
