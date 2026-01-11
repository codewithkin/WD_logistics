"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getExpensesForCharts } from "../actions";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Category {
    id: string;
    name: string;
    color: string | null;
}

interface ExpenseChartsProps {
    categories: Category[];
}

interface ChartData {
    byCategory: Array<{ category: string; amount: number; color: string; count: number }>;
    byMonth: Array<{ month: string; amount: number }>;
    byTruck: Array<{ truck: string; amount: number }>;
    byTrip: Array<{ trip: string; amount: number }>;
    total: number;
}

export function ExpenseCharts({ categories }: ExpenseChartsProps) {
    const [data, setData] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("30");

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const chartData = await getExpensesForCharts(parseInt(timeRange));
                setData(chartData);
            } catch (error) {
                console.error("Failed to fetch chart data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [timeRange]);

    // Export handlers
    useEffect(() => {
        const handleExportPDF = () => {
            if (!data) return;
            alert("PDF export for charts is not yet implemented");
        };

        const handleExportCSV = () => {
            if (!data) return;
            const csvData = data.byCategory
                .map((item) => `${item.category},${item.count},${item.amount}`)
                .join("\n");
            const csv = "Category,Count,Amount\n" + csvData;
            const blob = new Blob([csv], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `expense-charts-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        };

        window.addEventListener("export-pdf", handleExportPDF);
        window.addEventListener("export-csv", handleExportCSV);

        return () => {
            window.removeEventListener("export-pdf", handleExportPDF);
            window.removeEventListener("export-csv", handleExportCSV);
        };
    }, [data]);

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!data) return null;

    const maxCategoryAmount = Math.max(...data.byCategory.map((c) => c.amount), 0);
    const maxTruckAmount = Math.max(...data.byTruck.map((t) => t.amount), 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Expense Analytics</h3>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Total Expenses</CardTitle>
                    <CardDescription>Last {timeRange} days</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{formatCurrency(data.total)}</div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {/* By Category */}
                <Card>
                    <CardHeader>
                        <CardTitle>By Category</CardTitle>
                        <CardDescription>Top expense categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.byCategory.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No expense data available
                                </p>
                            ) : (
                                data.byCategory.map((item) => (
                                    <div key={item.category} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="h-3 w-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <span className="font-medium">{item.category}</span>
                                                <span className="text-muted-foreground">
                                                    ({item.count})
                                                </span>
                                            </div>
                                            <span className="font-medium">
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full transition-all"
                                                style={{
                                                    width: `${(item.amount / maxCategoryAmount) * 100}%`,
                                                    backgroundColor: item.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* By Truck */}
                <Card>
                    <CardHeader>
                        <CardTitle>By Truck</CardTitle>
                        <CardDescription>Top trucks by expense</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.byTruck.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No truck expense data available
                                </p>
                            ) : (
                                data.byTruck.slice(0, 5).map((item) => (
                                    <div key={item.truck} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{item.truck}</span>
                                            <span className="font-medium">
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all"
                                                style={{
                                                    width: `${(item.amount / maxTruckAmount) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* By Month */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Monthly Trend</CardTitle>
                        <CardDescription>Expense trends over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.byMonth.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No monthly data available
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {data.byMonth.map((item) => (
                                        <div
                                            key={item.month}
                                            className="rounded-lg border p-4 space-y-2"
                                        >
                                            <p className="text-sm text-muted-foreground">
                                                {item.month}
                                            </p>
                                            <p className="text-2xl font-bold">
                                                {formatCurrency(item.amount)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
