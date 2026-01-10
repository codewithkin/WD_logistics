"use client";

import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyRevenueExpense } from "@/lib/dashboard/revenue-expenses";

interface RevenueExpensesChartProps {
    data: MonthlyRevenueExpense[];
}

export function RevenueExpensesChart({ data }: RevenueExpensesChartProps) {
    // Format data for chart
    const chartData = data.map((item) => ({
        ...item,
        month: item.month.split(" ")[0], // Show just month abbreviation
    }));

    // Calculate totals
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Revenue vs Expenses</CardTitle>
                <CardDescription>Monthly comparison for the past 12 months</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-red-700 dark:text-red-200">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                            ${totalExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className={`p-4 rounded-lg ${netProfit >= 0 ? "bg-blue-50 dark:bg-blue-950" : "bg-orange-50 dark:bg-orange-950"}`}>
                        <p className={`text-sm font-medium ${netProfit >= 0 ? "text-blue-700 dark:text-blue-200" : "text-orange-700 dark:text-orange-200"}`}>
                            Net Profit
                        </p>
                        <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-900 dark:text-blue-100" : "text-orange-900 dark:text-orange-100"}`}>
                            ${netProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>

                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="month"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                formatter={(value) => `$${(value as number).toLocaleString()}`}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                                name="Revenue"
                            />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke="#ef4444"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorExpense)"
                                name="Expenses"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
