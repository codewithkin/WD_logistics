import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Financial Report Styles - Clean & Lean
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
  },
  header: {
    marginBottom: 30,
  },
  companyName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 2,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginTop: 10,
    marginBottom: 2,
  },
  reportPeriod: {
    fontSize: 9,
    color: "#666",
    marginBottom: 15,
  },

  // Summary section
  summarySection: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#333",
  },
  summaryAmount: {
    fontSize: 10,
    fontWeight: "600",
    color: "#000",
    textAlign: "right",
  },

  // Table section
  tableSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Table structure
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#1e40af",
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e40af",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 8,
    color: "#333",
  },
  tableCellRight: {
    fontSize: 8,
    color: "#333",
    textAlign: "right",
  },

  // Totals row
  totalRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#1e40af",
    borderTopWidth: 2,
    borderTopColor: "#1e40af",
  },
  totalCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: "white",
  },
  totalCellRight: {
    fontSize: 9,
    fontWeight: "bold",
    color: "white",
    textAlign: "right",
  },

  // Layout helpers
  col1: { flex: 1.5 },
  col2: { flex: 1.2 },
  col3: { flex: 1 },
  colRight: { flex: 1, textAlign: "right" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    fontSize: 7,
    color: "#999",
  },

  // Color utilities
  positive: {
    color: "#10b981",
  },
  negative: {
    color: "#ef4444",
  },
  neutral: {
    color: "#333",
  },
});

// Utilities
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Interfaces
export interface FinancialReportData {
  items: Array<{
    description: string;
    amount: number;
    category?: string;
    date?: Date | string;
    reference?: string;
  }>;
  summary?: {
    subtotal?: number;
    tax?: number;
    discount?: number;
    total: number;
  };
}

export interface FinancialReportTemplateProps {
  title: string;
  period: {
    startDate: Date | string;
    endDate: Date | string;
  };
  data: FinancialReportData;
  companyName?: string;
  reportType?: "expenses" | "revenue" | "profit" | "summary";
  generatedAt?: Date;
}

// Main Financial Report Template
export function FinancialReportTemplate({
  title,
  period,
  data,
  companyName = "WD Logistics",
  reportType = "summary",
  generatedAt = new Date(),
}: FinancialReportTemplateProps) {
  const startDate = typeof period.startDate === "string" ? new Date(period.startDate) : period.startDate;
  const endDate = typeof period.endDate === "string" ? new Date(period.endDate) : period.endDate;

  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
  const tax = data.summary?.tax || 0;
  const discount = data.summary?.discount || 0;
  const total = data.summary?.total ?? (subtotal + tax - discount);

  // Group items by category if available
  const groupedByCategory = data.items.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof data.items>);

  const hasCategories = Object.keys(groupedByCategory).length > 1 && data.items[0]?.category;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.reportTitle}>{title}</Text>
          <Text style={styles.reportPeriod}>
            {formatDate(startDate)} to {formatDate(endDate)}
          </Text>
        </View>

        {/* Main Table */}
        {hasCategories ? (
          // Render with categories
          <View>
            {Object.entries(groupedByCategory).map(([category, items], sectionIdx) => {
              const categoryTotal = items.reduce((sum, item) => sum + item.amount, 0);
              return (
                <View key={category} style={styles.tableSection}>
                  <Text style={styles.sectionTitle}>{category}</Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.col1]}>Description</Text>
                      {items[0]?.reference && (
                        <Text style={[styles.tableHeaderCell, styles.col2]}>Reference</Text>
                      )}
                      {items[0]?.date && (
                        <Text style={[styles.tableHeaderCell, styles.col2]}>Date</Text>
                      )}
                      <Text style={[styles.tableHeaderCell, styles.colRight]}>Amount</Text>
                    </View>

                    {items.map((item, idx) => (
                      <View
                        key={idx}
                        style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                      >
                        <Text style={[styles.tableCell, styles.col1]}>
                          {item.description}
                        </Text>
                        {item.reference && (
                          <Text style={[styles.tableCell, styles.col2]}>
                            {item.reference}
                          </Text>
                        )}
                        {item.date && (
                          <Text style={[styles.tableCell, styles.col2]}>
                            {formatDate(item.date)}
                          </Text>
                        )}
                        <Text style={[styles.tableCellRight, styles.colRight]}>
                          {formatCurrency(item.amount)}
                        </Text>
                      </View>
                    ))}

                    {/* Category Subtotal */}
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalCell, styles.col1]}>
                        {category.toUpperCase()} TOTAL
                      </Text>
                      {items[0]?.reference && (
                        <Text style={[styles.totalCell, styles.col2]}></Text>
                      )}
                      {items[0]?.date && (
                        <Text style={[styles.totalCell, styles.col2]}></Text>
                      )}
                      <Text style={[styles.totalCellRight, styles.colRight]}>
                        {formatCurrency(categoryTotal)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          // Render without categories
          <View style={styles.tableSection}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col1]}>Description</Text>
                {data.items[0]?.reference && (
                  <Text style={[styles.tableHeaderCell, styles.col2]}>Reference</Text>
                )}
                {data.items[0]?.date && (
                  <Text style={[styles.tableHeaderCell, styles.col2]}>Date</Text>
                )}
                <Text style={[styles.tableHeaderCell, styles.colRight]}>Amount</Text>
              </View>

              {data.items.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
                >
                  <Text style={[styles.tableCell, styles.col1]}>
                    {item.description}
                  </Text>
                  {item.reference && (
                    <Text style={[styles.tableCell, styles.col2]}>
                      {item.reference}
                    </Text>
                  )}
                  {item.date && (
                    <Text style={[styles.tableCell, styles.col2]}>
                      {formatDate(item.date)}
                    </Text>
                  )}
                  <Text style={[styles.tableCellRight, styles.colRight]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary Section */}
        <View style={styles.summarySection}>
          {subtotal > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(subtotal)}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount:</Text>
              <Text style={styles.summaryAmount}>-{formatCurrency(discount)}</Text>
            </View>
          )}
          {tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax:</Text>
              <Text style={styles.summaryAmount}>+{formatCurrency(tax)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, { marginTop: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1e40af" }]}>
            <Text style={[styles.summaryLabel, { fontWeight: "bold", fontSize: 11 }]}>TOTAL:</Text>
            <Text style={[styles.summaryAmount, { fontWeight: "bold", fontSize: 11, color: "#1e40af" }]}>
              {formatCurrency(total)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated on {formatDate(generatedAt)}</Text>
          <Text>{companyName} © {new Date().getFullYear()}</Text>
        </View>
      </Page>
    </Document>
  );
}

export default FinancialReportTemplate;
