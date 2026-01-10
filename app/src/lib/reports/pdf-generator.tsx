import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  ProfitPerUnitData,
  RevenueData,
  ExpenseData,
  CustomerStatementData,
  TripSummaryData,
  ReportMeta,
} from "./csv-generator";

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
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
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E40AF",
  },
  companyTagline: {
    fontSize: 10,
    color: "#6B7280",
  },
  companyInfo: {
    textAlign: "right",
    fontSize: 9,
    color: "#6B7280",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
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
    padding: 8,
  },
  tableHeaderText: {
    color: "white",
    fontSize: 8,
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
    fontSize: 8,
  },
  tableCellRight: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
  },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: "#1E40AF",
    padding: 8,
  },
  totalsText: {
    color: "white",
    fontSize: 8,
    fontWeight: "bold",
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
  customerBox: {
    padding: 15,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
  },
  paymentNotice: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#FEF2F2",
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
});

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

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
};

// Company Info
interface CompanyInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
}

const defaultCompany: CompanyInfo = {
  name: "WD Logistics",
  tagline: "Transport & Logistics Solutions",
  address: "Harare, Zimbabwe",
  phone: "+263 XX XXX XXXX",
  email: "info@wdlogistics.co.zw",
};

// Header Component
interface ReportHeaderProps {
  company?: CompanyInfo;
}

function ReportHeader({ company = defaultCompany }: ReportHeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.companyName}>{company.name}</Text>
        <Text style={styles.companyTagline}>{company.tagline}</Text>
      </View>
      <View style={styles.companyInfo}>
        <Text>{company.address}</Text>
        <Text>{company.phone}</Text>
        <Text>{company.email}</Text>
      </View>
    </View>
  );
}

// Footer Component
function ReportFooter({ company = defaultCompany }: { company?: CompanyInfo }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Generated on {formatDate(new Date())}</Text>
      <Text>{company.name} © {new Date().getFullYear()}</Text>
    </View>
  );
}

// ============================================================================
// PROFIT PER UNIT REPORT
// ============================================================================

interface ProfitPerUnitReportProps {
  data: ProfitPerUnitData[];
  meta: ReportMeta;
  company?: CompanyInfo;
}

export function ProfitPerUnitReportPDF({
  data,
  meta,
  company = defaultCompany,
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
        <ReportHeader company={company} />

        <Text style={styles.title}>PROFIT PER UNIT REPORT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} - {meta.endDate} | Generated: {formatDate(meta.generatedAt || new Date())}
        </Text>

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totals.revenue)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totals.expenses)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net Profit</Text>
              <Text style={[styles.summaryValue, totals.profit >= 0 ? styles.positive : styles.negative]}>
                {formatCurrency(totals.profit)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Avg Profit/Trip</Text>
              <Text style={styles.summaryValue}>{formatCurrency(avgProfitPerTrip)}</Text>
            </View>
          </View>
        </View>

        {/* Detailed Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DETAILED BREAKDOWN BY TRUCK</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Truck</Text>
              <Text style={styles.tableHeaderText}>Make/Model</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Trips</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Revenue</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Expenses</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Profit</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Margin</Text>
            </View>

            {data.map((row, index) => (
              <View
                key={row.registrationNo}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 1.5, fontWeight: "bold" }]}>
                  {row.registrationNo}
                </Text>
                <Text style={styles.tableCell}>{row.make} {row.model}</Text>
                <Text style={styles.tableCellRight}>{row.trips}</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(row.revenue)}</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(row.expenses)}</Text>
                <Text style={[styles.tableCellRight, row.profit >= 0 ? styles.positive : styles.negative]}>
                  {formatCurrency(row.profit)}
                </Text>
                <Text style={styles.tableCellRight}>{formatPercentage(row.profitMargin)}</Text>
              </View>
            ))}

            <View style={styles.totalsRow}>
              <Text style={[styles.totalsText, { flex: 1.5 }]}>TOTAL</Text>
              <Text style={styles.totalsText}></Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{totals.trips}</Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(totals.revenue)}</Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(totals.expenses)}</Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(totals.profit)}</Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatPercentage(overallMargin)}</Text>
            </View>
          </View>
        </View>

        <ReportFooter company={company} />
      </Page>
    </Document>
  );
}

// ============================================================================
// REVENUE REPORT
// ============================================================================

interface RevenueReportProps {
  data: RevenueData[];
  meta: ReportMeta;
  company?: CompanyInfo;
}

export function RevenueReportPDF({
  data,
  meta,
  company = defaultCompany,
}: RevenueReportProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader company={company} />

        <Text style={styles.title}>REVENUE REPORT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} - {meta.endDate} | Generated: {formatDate(meta.generatedAt || new Date())}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOTAL REVENUE: {formatCurrency(total)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Date</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Customer</Text>
            <Text style={styles.tableHeaderText}>Invoice #</Text>
            <Text style={styles.tableHeaderText}>Trip</Text>
            <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Amount</Text>
          </View>

          {data.map((row, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={styles.tableCell}>{formatDate(row.date)}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{row.customer}</Text>
              <Text style={styles.tableCell}>{row.invoiceNo}</Text>
              <Text style={styles.tableCell}>{row.trip}</Text>
              <Text style={styles.tableCellRight}>{formatCurrency(row.amount)}</Text>
            </View>
          ))}

          <View style={styles.totalsRow}>
            <Text style={styles.totalsText}>TOTAL</Text>
            <Text style={[styles.totalsText, { flex: 1.5 }]}></Text>
            <Text style={styles.totalsText}></Text>
            <Text style={styles.totalsText}></Text>
            <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <ReportFooter company={company} />
      </Page>
    </Document>
  );
}

// ============================================================================
// EXPENSE REPORT
// ============================================================================

interface ExpenseReportProps {
  data: ExpenseData[];
  meta: ReportMeta;
  company?: CompanyInfo;
}

export function ExpenseReportPDF({
  data,
  meta,
  company = defaultCompany,
}: ExpenseReportProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  // Group by category
  const categoryTotals = data.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader company={company} />

        <Text style={styles.title}>EXPENSE REPORT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} - {meta.endDate} | Generated: {formatDate(meta.generatedAt || new Date())}
        </Text>

        {/* Summary by Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUMMARY BY CATEGORY</Text>
          <View style={styles.summaryGrid}>
            {Object.entries(categoryTotals).slice(0, 4).map(([category, amount]) => (
              <View key={category} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{category}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Detailed Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DETAILED EXPENSES (Total: {formatCurrency(total)})</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Date</Text>
              <Text style={styles.tableHeaderText}>Category</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Description</Text>
              <Text style={styles.tableHeaderText}>Truck</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Amount</Text>
            </View>

            {data.map((row, index) => (
              <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={styles.tableCell}>{formatDate(row.date)}</Text>
                <Text style={styles.tableCell}>{row.category}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{row.description}</Text>
                <Text style={styles.tableCell}>{row.truck || "-"}</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(row.amount)}</Text>
              </View>
            ))}

            <View style={styles.totalsRow}>
              <Text style={styles.totalsText}>TOTAL</Text>
              <Text style={styles.totalsText}></Text>
              <Text style={[styles.totalsText, { flex: 1.5 }]}></Text>
              <Text style={styles.totalsText}></Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        <ReportFooter company={company} />
      </Page>
    </Document>
  );
}

// ============================================================================
// CUSTOMER STATEMENT
// ============================================================================

interface CustomerStatementProps {
  customer: {
    name: string;
    address?: string;
    email?: string;
  };
  entries: CustomerStatementData[];
  openingBalance: number;
  closingBalance: number;
  meta: ReportMeta;
  company?: CompanyInfo;
}

export function CustomerStatementPDF({
  customer,
  entries,
  openingBalance,
  closingBalance,
  meta,
  company = defaultCompany,
}: CustomerStatementProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader company={company} />

        <Text style={styles.title}>STATEMENT OF ACCOUNT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} to {meta.endDate}
        </Text>

        {/* Customer Details */}
        <View style={styles.customerBox}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>{customer.name}</Text>
          {customer.address && <Text style={{ fontSize: 9, color: "#6B7280" }}>{customer.address}</Text>}
          {customer.email && <Text style={{ fontSize: 9, color: "#6B7280" }}>{customer.email}</Text>}
        </View>

        {/* Opening Balance */}
        <View style={styles.balanceRow}>
          <Text>Opening Balance:</Text>
          <Text style={{ fontWeight: "bold" }}>{formatCurrency(openingBalance)}</Text>
        </View>

        {/* Transactions Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Date</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Type</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Reference</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Description</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.7, textAlign: "right" }]}>Debit</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.7, textAlign: "right" }]}>Credit</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.8, textAlign: "right" }]}>Balance</Text>
          </View>

          {entries.map((entry, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>{formatDate(entry.date)}</Text>
              <Text style={[styles.tableCell, { flex: 0.6 }]}>{entry.type}</Text>
              <Text style={[styles.tableCell, { flex: 0.8 }]}>{entry.reference}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{entry.description}</Text>
              <Text style={[styles.tableCellRight, { flex: 0.7 }]}>
                {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
              </Text>
              <Text style={[styles.tableCellRight, { flex: 0.7 }]}>
                {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
              </Text>
              <Text style={[styles.tableCellRight, { flex: 0.8 }]}>{formatCurrency(entry.balance)}</Text>
            </View>
          ))}
        </View>

        {/* Closing Balance */}
        <View style={[styles.balanceRow, { marginTop: 20 }]}>
          <Text style={{ fontWeight: "bold" }}>Closing Balance:</Text>
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 14,
              color: closingBalance > 0 ? "#EF4444" : "#10B981",
            }}
          >
            {formatCurrency(closingBalance)}
          </Text>
        </View>

        {/* Payment Notice */}
        {closingBalance > 0 && (
          <View style={styles.paymentNotice}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Payment Due</Text>
            <Text style={{ fontSize: 9 }}>
              Please remit payment at your earliest convenience. For questions, contact us at {company.email}.
            </Text>
          </View>
        )}

        <ReportFooter company={company} />
      </Page>
    </Document>
  );
}

// ============================================================================
// TRIP SUMMARY REPORT
// ============================================================================

interface TripSummaryReportProps {
  data: TripSummaryData[];
  meta: ReportMeta;
  company?: CompanyInfo;
}

export function TripSummaryReportPDF({
  data,
  meta,
  company = defaultCompany,
}: TripSummaryReportProps) {
  const totals = data.reduce(
    (acc, item) => ({
      revenue: acc.revenue + item.revenue,
      expenses: acc.expenses + item.expenses,
      profit: acc.profit + item.profit,
    }),
    { revenue: 0, expenses: 0, profit: 0 }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader company={company} />

        <Text style={styles.title}>TRIP SUMMARY REPORT</Text>
        <Text style={styles.subtitle}>
          Period: {meta.startDate} - {meta.endDate} | Generated: {formatDate(meta.generatedAt || new Date())}
        </Text>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Trips</Text>
              <Text style={styles.summaryValue}>{data.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totals.revenue)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totals.expenses)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net Profit</Text>
              <Text style={[styles.summaryValue, totals.profit >= 0 ? styles.positive : styles.negative]}>
                {formatCurrency(totals.profit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Trip Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TRIP DETAILS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Trip #</Text>
              <Text style={styles.tableHeaderText}>Date</Text>
              <Text style={styles.tableHeaderText}>Route</Text>
              <Text style={styles.tableHeaderText}>Truck</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Revenue</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Expenses</Text>
              <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Profit</Text>
            </View>

            {data.map((row, index) => (
              <View key={row.tripNumber} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={styles.tableCell}>{row.tripNumber}</Text>
                <Text style={styles.tableCell}>{formatDate(row.date)}</Text>
                <Text style={styles.tableCell}>{row.origin} → {row.destination}</Text>
                <Text style={styles.tableCell}>{row.truck}</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(row.revenue)}</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(row.expenses)}</Text>
                <Text style={[styles.tableCellRight, row.profit >= 0 ? styles.positive : styles.negative]}>
                  {formatCurrency(row.profit)}
                </Text>
              </View>
            ))}

            <View style={styles.totalsRow}>
              <Text style={styles.totalsText}>TOTAL</Text>
              <Text style={styles.totalsText}></Text>
              <Text style={styles.totalsText}></Text>
              <Text style={styles.totalsText}></Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(totals.revenue)}</Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(totals.expenses)}</Text>
              <Text style={[styles.totalsText, { textAlign: "right" }]}>{formatCurrency(totals.profit)}</Text>
            </View>
          </View>
        </View>

        <ReportFooter company={company} />
      </Page>
    </Document>
  );
}
