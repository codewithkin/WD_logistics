# WD Logistics - Reporting System

## Overview

This document outlines the comprehensive reporting system for WD Logistics, designed to enable meaningful decision-making with proper branding, structure, and export capabilities (PDF/CSV).

## Report Types

| Report | Description | Frequency |
|--------|-------------|-----------|
| Profit Per Unit | Profit analysis per truck | Daily/Weekly/Monthly |
| Revenue Report | Total revenue breakdown | Daily/Weekly/Monthly |
| Expense Report | Categorized expense analysis | Daily/Weekly/Monthly |
| Overall Report | Combined revenue & expenses | Weekly/Monthly |
| Tires Report | Tire expenses and usage | Monthly/Quarterly |
| Customer Statement | Invoice and payment history | On-demand |
| Trip Summary | Trip statistics and performance | Daily/Weekly/Monthly |
| Truck Performance | Individual truck metrics | Monthly |

## Report Branding & Structure

### PDF Report Template

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  [WD Logo]                                             │ │
│  │                                                        │ │
│  │  WD LOGISTICS                                          │ │
│  │  Transport & Logistics Solutions                       │ │
│  │                                                        │ │
│  │  Address: [Company Address]                            │ │
│  │  Phone: [Phone] | Email: [Email]                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  PROFIT PER UNIT REPORT                                     │
│  Period: January 1, 2026 - January 31, 2026                │
│  Generated: January 31, 2026 at 14:30                       │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  EXECUTIVE SUMMARY                                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │ Total       │ Total       │ Net         │ Avg Profit  │ │
│  │ Revenue     │ Expenses    │ Profit      │ Per Trip    │ │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤ │
│  │ $125,000    │ $78,500     │ $46,500     │ $1,162.50   │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
│                                                             │
│  DETAILED BREAKDOWN BY TRUCK                                │
│  ┌──────────┬─────────┬─────────┬─────────┬─────────┬────┐ │
│  │ Truck    │ Trips   │ Revenue │ Expense │ Profit  │ %  │ │
│  ├──────────┼─────────┼─────────┼─────────┼─────────┼────┤ │
│  │ AEU-29   │ 12      │ $32,000 │ $18,500 │ $13,500 │42% │ │
│  │ AEU-30   │ 10      │ $28,000 │ $16,200 │ $11,800 │42% │ │
│  │ ...      │ ...     │ ...     │ ...     │ ...     │... │ │
│  └──────────┴─────────┴─────────┴─────────┴─────────┴────┘ │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Page 1 of 3                           WD Logistics © 2026  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Report Configuration

```typescript
// config/reports.ts
export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  periods: ("daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom")[];
  formats: ("pdf" | "csv")[];
  fields: ReportField[];
}

export interface ReportField {
  key: string;
  label: string;
  type: "string" | "number" | "currency" | "percentage" | "date";
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
}

export const reportConfigs: Record<string, ReportConfig> = {
  "profit-per-unit": {
    id: "profit-per-unit",
    name: "Profit Per Unit Report",
    description: "Detailed profit analysis for each truck in the fleet",
    periods: ["daily", "weekly", "monthly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "registrationNo", label: "Truck", type: "string" },
      { key: "trips", label: "Trips", type: "number", aggregation: "count" },
      { key: "revenue", label: "Revenue", type: "currency", aggregation: "sum" },
      { key: "expenses", label: "Expenses", type: "currency", aggregation: "sum" },
      { key: "profit", label: "Profit", type: "currency", aggregation: "sum" },
      { key: "profitMargin", label: "Margin", type: "percentage" },
    ],
  },
  
  revenue: {
    id: "revenue",
    name: "Revenue Report",
    description: "Revenue breakdown by customer and trip",
    periods: ["daily", "weekly", "monthly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "customer", label: "Customer", type: "string" },
      { key: "trip", label: "Trip", type: "string" },
      { key: "amount", label: "Amount", type: "currency", aggregation: "sum" },
    ],
  },
  
  expenses: {
    id: "expenses",
    name: "Expense Report",
    description: "Categorized expense breakdown",
    periods: ["daily", "weekly", "monthly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "string" },
      { key: "truck", label: "Truck", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "amount", label: "Amount", type: "currency", aggregation: "sum" },
    ],
  },
  
  overall: {
    id: "overall",
    name: "Overall Financial Report",
    description: "Combined revenue and expense overview",
    periods: ["weekly", "monthly", "quarterly", "yearly"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "totalRevenue", label: "Total Revenue", type: "currency" },
      { key: "totalExpenses", label: "Total Expenses", type: "currency" },
      { key: "netProfit", label: "Net Profit", type: "currency" },
      { key: "profitMargin", label: "Profit Margin", type: "percentage" },
      { key: "topCustomer", label: "Top Customer", type: "string" },
      { key: "topExpenseCategory", label: "Top Expense Category", type: "string" },
    ],
  },
  
  tires: {
    id: "tires",
    name: "Tires Report",
    description: "Tire expenses and usage tracking",
    periods: ["monthly", "quarterly", "yearly"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "truck", label: "Truck", type: "string" },
      { key: "tiresReplaced", label: "Tires Replaced", type: "number" },
      { key: "totalCost", label: "Total Cost", type: "currency" },
      { key: "costPerTire", label: "Avg Cost/Tire", type: "currency" },
      { key: "milesSinceLastChange", label: "Miles Since Last", type: "number" },
    ],
  },
  
  "customer-statement": {
    id: "customer-statement",
    name: "Customer Statement",
    description: "Invoice and payment history for a customer",
    periods: ["custom"],
    formats: ["pdf"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "type", label: "Type", type: "string" },
      { key: "reference", label: "Reference", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "debit", label: "Debit", type: "currency" },
      { key: "credit", label: "Credit", type: "currency" },
      { key: "balance", label: "Balance", type: "currency" },
    ],
  },
  
  "trip-summary": {
    id: "trip-summary",
    name: "Trip Summary Report",
    description: "Trip statistics and performance metrics",
    periods: ["daily", "weekly", "monthly"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "totalTrips", label: "Total Trips", type: "number" },
      { key: "completedTrips", label: "Completed", type: "number" },
      { key: "cancelledTrips", label: "Cancelled", type: "number" },
      { key: "totalMileage", label: "Total Mileage", type: "number" },
      { key: "avgMileagePerTrip", label: "Avg Mileage/Trip", type: "number" },
      { key: "totalRevenue", label: "Total Revenue", type: "currency" },
    ],
  },
  
  "truck-performance": {
    id: "truck-performance",
    name: "Truck Performance Report",
    description: "Individual truck performance metrics",
    periods: ["monthly", "quarterly"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "registrationNo", label: "Truck", type: "string" },
      { key: "totalTrips", label: "Trips", type: "number" },
      { key: "totalMileage", label: "Mileage", type: "number" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "fuelCost", label: "Fuel Cost", type: "currency" },
      { key: "maintenanceCost", label: "Maintenance", type: "currency" },
      { key: "utilization", label: "Utilization %", type: "percentage" },
    ],
  },
};
```

## PDF Generation with react-pdf

```typescript
// lib/reports/pdf-generator.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

// Register fonts
Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/Inter-Regular.ttf" },
    { src: "/fonts/Inter-Bold.ttf", fontWeight: "bold" },
  ],
});

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#1E40AF",
  },
  logo: {
    width: 60,
    height: 60,
  },
  companyInfo: {
    textAlign: "right",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E40AF",
  },
  companyTagline: {
    fontSize: 10,
    color: "#6B7280",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1E40AF",
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryCard: {
    width: "23%",
    padding: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E40AF",
    color: "white",
    padding: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    padding: 8,
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    fontSize: 8,
    color: "#6B7280",
  },
  positive: {
    color: "#10B981",
  },
  negative: {
    color: "#EF4444",
  },
});

// Interfaces
interface ProfitPerUnitData {
  registrationNo: string;
  make: string;
  model: string;
  trips: number;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
}

interface ReportMeta {
  startDate: string;
  endDate: string;
  period: string;
  generatedAt?: Date;
}

interface CompanyInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
}

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

// PDF Document Component
interface ProfitPerUnitReportProps {
  data: ProfitPerUnitData[];
  meta: ReportMeta;
  company: CompanyInfo;
}

export function ProfitPerUnitReportPDF({
  data,
  meta,
  company,
}: ProfitPerUnitReportProps) {
  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      trips: acc.trips + item.trips,
      revenue: acc.revenue + item.revenue,
      expenses: acc.expenses + item.expenses,
      profit: acc.profit + item.profit,
    }),
    { trips: 0, revenue: 0, expenses: 0, profit: 0 }
  );

  const avgProfitPerTrip = totals.trips > 0 ? totals.profit / totals.trips : 0;
  const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image src={company.logo} style={styles.logo} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.companyName}>{company.name}</Text>
              <Text style={styles.companyTagline}>{company.tagline}</Text>
            </View>
          </View>
          <View style={styles.companyInfo}>
            <Text>{company.address}</Text>
            <Text>{company.phone}</Text>
            <Text>{company.email}</Text>
          </View>
        </View>

        {/* Report Title */}
        <Text style={styles.title}>PROFIT PER UNIT REPORT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} - {meta.endDate} | Generated:{" "}
          {formatDate(meta.generatedAt || new Date())}
        </Text>

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totals.revenue)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totals.expenses)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net Profit</Text>
              <Text
                style={[
                  styles.summaryValue,
                  totals.profit >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {formatCurrency(totals.profit)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Avg Profit/Trip</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(avgProfitPerTrip)}
              </Text>
            </View>
          </View>
        </View>

        {/* Detailed Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DETAILED BREAKDOWN BY TRUCK</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Truck</Text>
              <Text style={styles.tableCell}>Make/Model</Text>
              <Text style={[styles.tableCell, { textAlign: "right" }]}>Trips</Text>
              <Text style={[styles.tableCell, { textAlign: "right" }]}>Revenue</Text>
              <Text style={[styles.tableCell, { textAlign: "right" }]}>Expenses</Text>
              <Text style={[styles.tableCell, { textAlign: "right" }]}>Profit</Text>
              <Text style={[styles.tableCell, { textAlign: "right" }]}>Margin</Text>
            </View>

            {/* Table Rows */}
            {data.map((row, index) => (
              <View
                key={row.registrationNo}
                style={[
                  styles.tableRow,
                  index % 2 === 1 && styles.tableRowAlt,
                ]}
              >
                <Text style={[styles.tableCell, { flex: 1.5, fontWeight: "bold" }]}>
                  {row.registrationNo}
                </Text>
                <Text style={styles.tableCell}>
                  {row.make} {row.model}
                </Text>
                <Text style={[styles.tableCell, { textAlign: "right" }]}>
                  {row.trips}
                </Text>
                <Text style={[styles.tableCell, { textAlign: "right" }]}>
                  {formatCurrency(row.revenue)}
                </Text>
                <Text style={[styles.tableCell, { textAlign: "right" }]}>
                  {formatCurrency(row.expenses)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { textAlign: "right" },
                    row.profit >= 0 ? styles.positive : styles.negative,
                  ]}
                >
                  {formatCurrency(row.profit)}
                </Text>
                <Text style={[styles.tableCell, { textAlign: "right" }]}>
                  {formatPercentage(row.profitMargin)}
                </Text>
              </View>
            ))}

            {/* Totals Row */}
            <View
              style={[
                styles.tableRow,
                { backgroundColor: "#1E40AF", color: "white" },
              ]}
            >
              <Text style={[styles.tableCell, { flex: 1.5, fontWeight: "bold", color: "white" }]}>
                TOTAL
              </Text>
              <Text style={[styles.tableCell, { color: "white" }]}></Text>
              <Text style={[styles.tableCell, { textAlign: "right", color: "white" }]}>
                {totals.trips}
              </Text>
              <Text style={[styles.tableCell, { textAlign: "right", color: "white" }]}>
                {formatCurrency(totals.revenue)}
              </Text>
              <Text style={[styles.tableCell, { textAlign: "right", color: "white" }]}>
                {formatCurrency(totals.expenses)}
              </Text>
              <Text style={[styles.tableCell, { textAlign: "right", color: "white" }]}>
                {formatCurrency(totals.profit)}
              </Text>
              <Text style={[styles.tableCell, { textAlign: "right", color: "white" }]}>
                {formatPercentage(overallMargin)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            Page <Text render={({ pageNumber }) => pageNumber} /> of{" "}
            <Text render={({ totalPages }) => totalPages} />
          </Text>
          <Text>{company.name} © {new Date().getFullYear()}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

## CSV Generation

```typescript
// lib/reports/csv-generator.ts
interface CSVColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

interface CSVOptions {
  filename: string;
  columns: CSVColumn[];
  includeHeaders?: boolean;
}

export function generateCSV<T extends Record<string, any>>(
  data: T[],
  options: CSVOptions
): string {
  const { columns, includeHeaders = true } = options;

  const rows: string[] = [];

  // Add header row
  if (includeHeaders) {
    const headerRow = columns.map((col) => `"${col.label}"`).join(",");
    rows.push(headerRow);
  }

  // Add data rows
  for (const item of data) {
    const row = columns
      .map((col) => {
        let value = item[col.key];
        if (col.format) {
          value = col.format(value);
        }
        // Escape quotes and wrap in quotes
        if (typeof value === "string") {
          value = value.replace(/"/g, '""');
        }
        return `"${value ?? ""}"`;
      })
      .join(",");
    rows.push(row);
  }

  return rows.join("\n");
}

// Profit Per Unit CSV
export function generateProfitPerUnitCSV(
  data: ProfitPerUnitData[],
  meta: ReportMeta
): string {
  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      trips: acc.trips + item.trips,
      revenue: acc.revenue + item.revenue,
      expenses: acc.expenses + item.expenses,
      profit: acc.profit + item.profit,
    }),
    { trips: 0, revenue: 0, expenses: 0, profit: 0 }
  );

  const columns: CSVColumn[] = [
    { key: "registrationNo", label: "Truck Registration" },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "trips", label: "Number of Trips" },
    {
      key: "revenue",
      label: "Revenue ($)",
      format: (v) => v.toFixed(2),
    },
    {
      key: "expenses",
      label: "Expenses ($)",
      format: (v) => v.toFixed(2),
    },
    {
      key: "profit",
      label: "Profit ($)",
      format: (v) => v.toFixed(2),
    },
    {
      key: "profitMargin",
      label: "Profit Margin (%)",
      format: (v) => v.toFixed(2),
    },
  ];

  // Generate CSV with meta info
  const metaInfo = [
    `"WD Logistics - Profit Per Unit Report"`,
    `"Period: ${meta.startDate} - ${meta.endDate}"`,
    `"Generated: ${new Date().toISOString()}"`,
    `""`,
  ].join("\n");

  const csvData = generateCSV(data, {
    filename: "profit-per-unit",
    columns,
  });

  // Add totals row
  const totalsRow = [
    `"TOTAL"`,
    `""`,
    `""`,
    `"${totals.trips}"`,
    `"${totals.revenue.toFixed(2)}"`,
    `"${totals.expenses.toFixed(2)}"`,
    `"${totals.profit.toFixed(2)}"`,
    `"${((totals.profit / totals.revenue) * 100).toFixed(2)}"`,
  ].join(",");

  return `${metaInfo}\n${csvData}\n${totalsRow}`;
}
```

## Report Generation API

```typescript
// app/api/reports/generate/[type]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { ProfitPerUnitReportPDF } from "@/lib/reports/pdf-generator";
import { generateProfitPerUnitCSV } from "@/lib/reports/csv-generator";
import { uploadToStorage } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  return withAuth(
    request,
    async ({ organizationId, user }) => {
      const body = await request.json();
      const { startDate, endDate, format, period, customerId } = body;
      const reportType = params.type;

      // Get organization details for branding
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      const companyInfo = {
        name: "WD Logistics",
        tagline: "Transport & Logistics Solutions",
        address: (organization?.metadata as any)?.address || "Harare, Zimbabwe",
        phone: (organization?.metadata as any)?.phone || "+263 XX XXX XXXX",
        email: (organization?.metadata as any)?.email || "info@wdlogistics.co.zw",
        logo: "/images/wd-logo.png",
      };

      let fileBuffer: Buffer;
      let mimeType: string;
      let fileExtension: string;

      switch (reportType) {
        case "profit-per-unit": {
          const data = await fetchProfitPerUnitData(
            organizationId,
            new Date(startDate),
            new Date(endDate)
          );

          const meta = {
            startDate,
            endDate,
            period,
            generatedAt: new Date(),
          };

          if (format === "PDF") {
            const pdfDoc = (
              <ProfitPerUnitReportPDF
                data={data}
                meta={meta}
                company={companyInfo}
              />
            );
            fileBuffer = await renderToBuffer(pdfDoc as any);
            mimeType = "application/pdf";
            fileExtension = "pdf";
          } else {
            const csvContent = generateProfitPerUnitCSV(data, meta);
            fileBuffer = Buffer.from(csvContent, "utf-8");
            mimeType = "text/csv";
            fileExtension = "csv";
          }
          break;
        }

        case "customer-statement": {
          if (!customerId) {
            return NextResponse.json(
              { error: "Customer ID is required" },
              { status: 400 }
            );
          }
          // Generate customer statement...
          // Similar pattern as above
          break;
        }

        // Add other report types...

        default:
          return NextResponse.json(
            { error: "Invalid report type" },
            { status: 400 }
          );
      }

      // Generate filename
      const filename = `${reportType}-${startDate}-${endDate}.${fileExtension}`;

      // Upload to storage
      const fileUrl = await uploadToStorage(fileBuffer, filename, mimeType);

      // Save report record
      const report = await prisma.report.create({
        data: {
          organizationId,
          type: reportType.toUpperCase().replace(/-/g, "_") as any,
          period: period.toUpperCase() as any,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          format: format.toUpperCase() as any,
          fileUrl,
          generatedById: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        report,
        downloadUrl: fileUrl,
      });
    },
    { roles: ["admin"] }
  );
}

async function fetchProfitPerUnitData(
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const trucks = await prisma.truck.findMany({
    where: { organizationId },
    include: {
      trips: {
        where: {
          status: "COMPLETED",
          endDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          expenses: {
            include: { expense: true },
          },
        },
      },
      expenses: {
        where: {
          expense: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        include: {
          expense: {
            include: { category: true },
          },
        },
      },
    },
  });

  return trucks.map((truck) => {
    const totalRevenue = truck.trips.reduce((sum, trip) => sum + trip.revenue, 0);

    const tripExpenses = truck.trips.reduce(
      (sum, trip) =>
        sum + trip.expenses.reduce((e, te) => e + te.expense.amount, 0),
      0
    );

    const truckExpenses = truck.expenses.reduce(
      (sum, te) => sum + te.expense.amount,
      0
    );

    const totalExpenses = tripExpenses + truckExpenses;
    const profit = totalRevenue - totalExpenses;

    return {
      truckId: truck.id,
      registrationNo: truck.registrationNo,
      make: truck.make,
      model: truck.model,
      trips: truck.trips.length,
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
    };
  });
}
```

## Reports UI Component

```tsx
// components/reports/report-generator.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { toast } from "sonner";
import { Download, FileText, Loader2 } from "lucide-react";
import { reportConfigs } from "@/config/reports";

const reportFormSchema = z.object({
  reportType: z.string().min(1, "Select a report type"),
  period: z.string().min(1, "Select a period"),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }),
  format: z.enum(["PDF", "CSV"]),
  customerId: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

export function ReportGenerator() {
  const [loading, setLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{
    downloadUrl: string;
    format: string;
  } | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      reportType: "",
      period: "",
      format: "PDF",
    },
  });

  const selectedReportType = form.watch("reportType");
  const reportConfig = selectedReportType ? reportConfigs[selectedReportType] : null;

  const onSubmit = async (values: ReportFormValues) => {
    setLoading(true);
    setGeneratedReport(null);

    try {
      const response = await fetch(`/api/reports/generate/${values.reportType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: values.dateRange.from.toISOString(),
          endDate: values.dateRange.to.toISOString(),
          period: values.period,
          format: values.format,
          customerId: values.customerId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await response.json();
      setGeneratedReport({
        downloadUrl: data.downloadUrl,
        format: values.format,
      });
      toast.success("Report generated successfully!");
    } catch (error) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Report</CardTitle>
        <CardDescription>
          Select report type, period, and format to generate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select report type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(reportConfigs).map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!reportConfig}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {reportConfig?.periods.map((period) => (
                          <SelectItem key={period} value={period}>
                            {period.charAt(0).toUpperCase() + period.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Range</FormLabel>
                  <FormControl>
                    <DatePickerWithRange
                      date={field.value}
                      setDate={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PDF">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          PDF
                        </div>
                      </SelectItem>
                      <SelectItem value="CSV">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CSV
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>

              {generatedReport && (
                <Button variant="outline" asChild>
                  <a href={generatedReport.downloadUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download {generatedReport.format}
                  </a>
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

## Customer Statement Generation

```typescript
// lib/reports/customer-statement.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

interface StatementEntry {
  date: Date;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface CustomerStatementProps {
  customer: {
    name: string;
    address?: string;
    email?: string;
  };
  entries: StatementEntry[];
  openingBalance: number;
  closingBalance: number;
  meta: {
    startDate: string;
    endDate: string;
  };
  company: CompanyInfo;
}

export function CustomerStatementPDF({
  customer,
  entries,
  openingBalance,
  closingBalance,
  meta,
  company,
}: CustomerStatementProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with company branding */}
        <View style={styles.header}>
          <Image src={company.logo} style={styles.logo} />
          <View>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.companyTagline}>{company.tagline}</Text>
          </View>
        </View>

        {/* Statement Title */}
        <Text style={styles.title}>STATEMENT OF ACCOUNT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} to {meta.endDate}
        </Text>

        {/* Customer Details */}
        <View style={styles.customerBox}>
          <Text style={{ fontWeight: "bold" }}>{customer.name}</Text>
          {customer.address && <Text>{customer.address}</Text>}
          {customer.email && <Text>{customer.email}</Text>}
        </View>

        {/* Opening Balance */}
        <View style={styles.balanceRow}>
          <Text>Opening Balance:</Text>
          <Text style={{ fontWeight: "bold" }}>
            ${openingBalance.toFixed(2)}
          </Text>
        </View>

        {/* Transactions Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 0.8 }]}>Date</Text>
            <Text style={[styles.tableCell, { flex: 0.6 }]}>Type</Text>
            <Text style={[styles.tableCell, { flex: 0.8 }]}>Reference</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Description</Text>
            <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>
              Debit
            </Text>
            <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>
              Credit
            </Text>
            <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right" }]}>
              Balance
            </Text>
          </View>

          {entries.map((entry, index) => (
            <View
              key={index}
              style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
            >
              <Text style={[styles.tableCell, { flex: 0.8 }]}>
                {new Date(entry.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.tableCell, { flex: 0.6 }]}>{entry.type}</Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>
                {entry.reference}
              </Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {entry.description}
              </Text>
              <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>
                {entry.debit > 0 ? `$${entry.debit.toFixed(2)}` : "-"}
              </Text>
              <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>
                {entry.credit > 0 ? `$${entry.credit.toFixed(2)}` : "-"}
              </Text>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: "right" }]}>
                ${entry.balance.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Closing Balance */}
        <View style={[styles.balanceRow, { marginTop: 20, fontWeight: "bold" }]}>
          <Text>Closing Balance:</Text>
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 14,
              color: closingBalance > 0 ? "#EF4444" : "#10B981",
            }}
          >
            ${closingBalance.toFixed(2)}
          </Text>
        </View>

        {/* Payment Notice */}
        {closingBalance > 0 && (
          <View style={styles.paymentNotice}>
            <Text style={{ fontWeight: "bold" }}>Payment Due</Text>
            <Text>
              Please remit payment at your earliest convenience. For questions,
              contact us at {company.email}.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            Page <Text render={({ pageNumber }) => pageNumber} /> of{" "}
            <Text render={({ totalPages }) => totalPages} />
          </Text>
          <Text>{company.name} © {new Date().getFullYear()}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

## Key Decision-Making Metrics

The reports are designed to provide these key insights:

### Profit Per Unit Report
- **Best performing trucks** - Which trucks generate the most profit
- **Worst performing trucks** - Which trucks need attention or replacement
- **Profit margins** - Overall fleet efficiency

### Expense Analysis
- **Cost trends** - Are expenses increasing/decreasing
- **Category breakdown** - Where is money going (fuel, tires, repairs)
- **Per-truck costs** - Which trucks are most expensive to maintain

### Revenue Insights
- **Top customers** - Who generates the most business
- **Revenue trends** - Growth or decline patterns
- **Trip profitability** - Most profitable routes

### Operational Metrics
- **Fleet utilization** - How often trucks are in use
- **Trip completion rate** - Scheduled vs completed trips
- **Mileage tracking** - Actual vs estimated mileage
