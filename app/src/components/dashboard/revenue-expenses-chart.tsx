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
import { shortMonthLabel } from "@/lib/metrics/monthly";

interface RevenueExpensesChartProps {
    data: MonthlyRevenueExpense[];
    periodLabel?: string;
    periodTotals?: {
        revenue: number;
        expenses: number;
    };
}

export function RevenueExpensesChart({ data, periodLabel, periodTotals }: RevenueExpensesChartProps) {
    // Keep the year on the label. Stripping it to "Jan" made a 1y or all-time
    // period read as a repeating list of the same twelve months.
    const chartData = data.map((item) => ({
        ...item,
        month: shortMonthLabel(item.month),
    }));

    // Use period totals if provided, otherwise calculate from data
    const totalRevenue = periodTotals?.revenue ?? data.reduce((sum, item) => sum + item.revenue, 0);
    const totalExpenses = periodTotals?.expenses ?? data.reduce((sum, item) => sum + item.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Revenue vs Expenses</CardTitle>
                <CardDescription>
                    {periodLabel ? `Data for ${periodLabel}` : "Monthly comparison"} · revenue counts
                    completed trips, not cash received
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">Revenue earned</p>
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

                {/* overflow-x-auto + min-w scrolls the chart itself on narrow
                    screens instead of squeezing axis labels illegible or
                    letting the whole page grow wider than the viewport. */}
                <div className="w-full overflow-x-auto">
                <div className="min-w-[560px] h-80">
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
                                tickFormatter={(value) =>
                                    // "$0k" for everything under a thousand was
                                    // the old behaviour on small datasets.
                                    Math.abs(value) >= 1000
                                        ? `$${(value / 1000).toFixed(0)}k`
                                        : `$${value}`
                                }
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
                </div>
            </CardContent>
        </Card>
    );
}
