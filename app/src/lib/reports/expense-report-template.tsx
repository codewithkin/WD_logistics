import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from "@react-pdf/renderer";

export interface ExpenseExportData {
    id: string;
    date: Date;
    category: string;
    categoryColor: string;
    description: string | null;
    amount: number;
    trucks: string[];
    trips: string[];
    drivers: string[];
}

// PDF Styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: "Helvetica",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 2,
        borderBottomColor: "#22c55e", // Primary green
    },
    companyName: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#22c55e",
    },
    companyTagline: {
        fontSize: 10,
        color: "#6B7280",
        marginTop: 2,
    },
    companyInfo: {
        textAlign: "right",
        fontSize: 9,
        color: "#6B7280",
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 15,
        marginBottom: 5,
        textAlign: "center",
        color: "#1F2937",
    },
    subtitle: {
        fontSize: 10,
        color: "#6B7280",
        marginBottom: 20,
        textAlign: "center",
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "bold",
        marginBottom: 10,
        color: "#22c55e",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        paddingBottom: 5,
    },
    summaryGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 25,
        gap: 10,
    },
    summaryCard: {
        flex: 1,
        padding: 12,
        backgroundColor: "#F9FAFB",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    summaryCardHighlight: {
        flex: 1,
        padding: 12,
        backgroundColor: "#f0fdf4", // Light green
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#22c55e",
    },
    summaryLabel: {
        fontSize: 8,
        color: "#6B7280",
        marginBottom: 4,
        textTransform: "uppercase",
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1F2937",
    },
    summaryValueGreen: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#22c55e",
    },
    table: {
        width: "100%",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#22c55e",
        padding: 8,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
    },
    tableHeaderText: {
        color: "white",
        fontSize: 8,
        fontWeight: "bold",
        textTransform: "uppercase",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
        padding: 8,
        minHeight: 30,
    },
    tableRowAlt: {
        backgroundColor: "#F9FAFB",
    },
    tableCell: {
        fontSize: 8,
        color: "#374151",
    },
    tableCellRight: {
        fontSize: 8,
        textAlign: "right",
        color: "#374151",
    },
    totalsRow: {
        flexDirection: "row",
        backgroundColor: "#1F2937",
        padding: 10,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
    },
    totalsText: {
        color: "white",
        fontSize: 9,
        fontWeight: "bold",
    },
    categoryList: {
        marginTop: 10,
    },
    categoryItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    categoryName: {
        fontSize: 9,
        color: "#374151",
    },
    categoryAmount: {
        fontSize: 9,
        fontWeight: "bold",
        color: "#1F2937",
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
        color: "#9CA3AF",
    },
    badge: {
        backgroundColor: "#E5E7EB",
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
        fontSize: 7,
        marginRight: 3,
        marginBottom: 2,
    },
    badgeContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    noData: {
        textAlign: "center",
        color: "#9CA3AF",
        padding: 20,
        fontSize: 10,
    },
});

// Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
    }).format(amount);
};

// Format date
const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

interface ExpenseReportPDFProps {
    expenses: ExpenseExportData[];
    meta: {
        generatedAt: Date;
        totalExpenses: number;
        totalAmount: number;
        organizationName: string;
    };
    byCategory: Array<{ name: string; amount: number }>;
}

export function ExpenseReportPDF({ expenses, meta, byCategory }: ExpenseReportPDFProps) {
    const sortedCategories = [...byCategory].sort((a, b) => b.amount - a.amount);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.companyName}>WD Logistics</Text>
                        <Text style={styles.companyTagline}>Transportation & Freight Management</Text>
                    </View>
                    <View style={styles.companyInfo}>
                        <Text>Expense Report</Text>
                        <Text>Generated: {formatDate(meta.generatedAt)}</Text>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>Expense Summary Report</Text>
                <Text style={styles.subtitle}>
                    Complete breakdown of all recorded expenses
                </Text>

                {/* Summary Cards */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCardHighlight}>
                        <Text style={styles.summaryLabel}>Total Expenses</Text>
                        <Text style={styles.summaryValueGreen}>{formatCurrency(meta.totalAmount)}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Number of Records</Text>
                        <Text style={styles.summaryValue}>{meta.totalExpenses}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Categories</Text>
                        <Text style={styles.summaryValue}>{byCategory.length}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Average per Expense</Text>
                        <Text style={styles.summaryValue}>
                            {meta.totalExpenses > 0 
                                ? formatCurrency(meta.totalAmount / meta.totalExpenses) 
                                : formatCurrency(0)}
                        </Text>
                    </View>
                </View>

                {/* Category Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Expenses by Category</Text>
                    <View style={styles.categoryList}>
                        {sortedCategories.map((cat, index) => (
                            <View key={index} style={[styles.categoryItem, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                                <Text style={styles.categoryName}>{cat.name}</Text>
                                <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text>WD Logistics - Expense Report</Text>
                    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>

            {/* Detail Page */}
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.companyName}>WD Logistics</Text>
                        <Text style={styles.companyTagline}>Transportation & Freight Management</Text>
                    </View>
                    <View style={styles.companyInfo}>
                        <Text>Expense Details</Text>
                    </View>
                </View>

                {/* Expense Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detailed Expense List</Text>
                    
                    {expenses.length === 0 ? (
                        <Text style={styles.noData}>No expenses recorded</Text>
                    ) : (
                        <View style={styles.table}>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { width: "15%" }]}>Date</Text>
                                <Text style={[styles.tableHeaderText, { width: "15%" }]}>Category</Text>
                                <Text style={[styles.tableHeaderText, { width: "25%" }]}>Description</Text>
                                <Text style={[styles.tableHeaderText, { width: "20%" }]}>Associations</Text>
                                <Text style={[styles.tableHeaderText, { width: "15%", textAlign: "right" }]}>Amount</Text>
                            </View>

                            {/* Table Rows */}
                            {expenses.slice(0, 25).map((expense, index) => (
                                <View 
                                    key={expense.id} 
                                    style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                                >
                                    <Text style={[styles.tableCell, { width: "15%" }]}>
                                        {formatDate(expense.date)}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: "15%" }]}>
                                        {expense.category}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: "25%" }]}>
                                        {expense.description || "-"}
                                    </Text>
                                    <View style={{ width: "20%" }}>
                                        <View style={styles.badgeContainer}>
                                            {expense.trucks.map((truck, i) => (
                                                <Text key={`truck-${i}`} style={styles.badge}>🚛 {truck}</Text>
                                            ))}
                                            {expense.trips.map((trip, i) => (
                                                <Text key={`trip-${i}`} style={styles.badge}>📍 {trip}</Text>
                                            ))}
                                            {expense.drivers.map((driver, i) => (
                                                <Text key={`driver-${i}`} style={styles.badge}>👤 {driver}</Text>
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={[styles.tableCellRight, { width: "15%" }]}>
                                        {formatCurrency(expense.amount)}
                                    </Text>
                                </View>
                            ))}

                            {/* Totals Row */}
                            <View style={styles.totalsRow}>
                                <Text style={[styles.totalsText, { width: "75%" }]}>
                                    Total ({expenses.length} expenses)
                                </Text>
                                <Text style={[styles.totalsText, { width: "15%", textAlign: "right" }]}>
                                    {formatCurrency(meta.totalAmount)}
                                </Text>
                            </View>
                        </View>
                    )}

                    {expenses.length > 25 && (
                        <Text style={{ marginTop: 10, fontSize: 8, color: "#6B7280", textAlign: "center" }}>
                            Showing first 25 of {expenses.length} expenses. Export to CSV for complete data.
                        </Text>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text>WD Logistics - Expense Report</Text>
                    <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
