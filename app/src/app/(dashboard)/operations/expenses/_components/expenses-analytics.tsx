"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, DollarSign, Clock, CheckCircle, XCircle, CreditCard, TrendingUp, Loader2 } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { format } from "date-fns";
import { exportOperationsExpensesPDF } from "../actions";

interface Expense {
    id: string;
    description: string;
    amount: number;
    date: Date;
    status: string;
    receiptUrl: string | null;
    category: { id: string; name: string } | null;
    tripExpenses: Array<{
        trip: {
            id: string;
            truck: { registrationNo: string };
            driver: { firstName: string; lastName: string };
        };
    }>;
}

interface ExpensesAnalyticsProps {
    analytics: {
        totalExpenses: number;
        totalAmount: number;
        pendingExpenses: number;
        approvedExpenses: number;
        rejectedExpenses: number;
        paidExpenses: number;
        pendingAmount: number;
        paidAmount: number;
        categoryBreakdown: Array<{ name: string; count: number; amount: number }>;
    };
    expenses: Expense[];
    canExport: boolean;
    categoryId?: string;
    categoryName?: string;
}

const STATUS_COLORS = {
    pending: "#f59e0b",
    approved: "#3b82f6",
    rejected: "#ef4444",
    paid: "#10b981",
};

const CATEGORY_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"
];

export function ExpensesAnalytics({ analytics, expenses, canExport, categoryId, categoryName }: ExpensesAnalyticsProps) {
    const [isExporting, setIsExporting] = useState(false);

    const statusData = [
        { name: "Pending", value: analytics.pendingExpenses, color: STATUS_COLORS.pending },
        { name: "Approved", value: analytics.approvedExpenses, color: STATUS_COLORS.approved },
        { name: "Rejected", value: analytics.rejectedExpenses, color: STATUS_COLORS.rejected },
        { name: "Paid", value: analytics.paidExpenses, color: STATUS_COLORS.paid },
    ].filter(d => d.value > 0);

    // Group expenses by month for bar chart
    const monthlyData = expenses.reduce((acc, expense) => {
        const month = format(new Date(expense.date), "MMM yyyy");
        if (!acc[month]) {
            acc[month] = { month, count: 0, amount: 0 };
        }
        acc[month].count += 1;
        acc[month].amount += expense.amount;
        return acc;
    }, {} as Record<string, { month: string; count: number; amount: number }>);

    const monthlyChartData = Object.values(monthlyData).slice(-6);

    const handleExportCSV = () => {
        const headers = ["Description", "Amount", "Date", "Status", "Category", "Trip/Truck"];
        const rows = expenses.map(e => [
            e.description,
            e.amount.toString(),
            format(new Date(e.date), "yyyy-MM-dd"),
            e.status,
            e.category?.name || "N/A",
            e.tripExpenses[0]?.trip.truck.registrationNo || "N/A",
        ]);

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename = categoryName && categoryName !== "All Categories" 
            ? `expenses-${categoryName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`
            : `expenses-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const result = await exportOperationsExpensesPDF({ categoryId });
            if (result.success && result.data) {
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: result.mimeType || "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename || "operations-expenses-report.pdf";
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("PDF export error:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const averageExpense = analytics.totalExpenses > 0
        ? analytics.totalAmount / analytics.totalExpenses
        : 0;

    return (
        <div className="space-y-6">
            {/* Export Buttons */}
            {canExport && (
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleExportCSV}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Export PDF
                    </Button>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalExpenses}</div>
                        <p className="text-xs text-muted-foreground">
                            ${analytics.totalAmount.toLocaleString()} total
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${analytics.pendingAmount.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {analytics.pendingExpenses} pending items
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${analytics.paidAmount.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {analytics.paidExpenses} paid items
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${averageExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Per expense item
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Pending</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                            {analytics.pendingExpenses}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Approved</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                            {analytics.approvedExpenses}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">Paid</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                            {analytics.paidExpenses}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">Rejected</span>
                        </div>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                            {analytics.rejectedExpenses}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Expenses by Category</CardTitle>
                        <CardDescription>Breakdown by expense category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.categoryBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="amount"
                                        nameKey="name"
                                        label={({ name, amount }) => `${name}: $${amount.toLocaleString()}`}
                                    >
                                        {analytics.categoryBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Monthly Expenses</CardTitle>
                        <CardDescription>Last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                                    <YAxis stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--background))",
                                            border: "1px solid hsl(var(--border))",
                                        }}
                                        formatter={(value: number, name: string) => {
                                            if (name === "amount") return [`$${value.toLocaleString()}`, "Amount"];
                                            return [value, name];
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="amount" fill="#ef4444" name="Amount ($)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
