"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyPerformanceTrend } from "@/lib/dashboard/performance-trend";

interface PerformanceTrendChartProps {
    data: MonthlyPerformanceTrend[];
}

export function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
    // Calculate totals
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalTrips = data.reduce((sum, item) => sum + item.tripCount, 0);
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
    const avgRevenuePerTrip = totalTrips > 0 ? totalRevenue / totalTrips : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance Trend</CardTitle>
                <CardDescription>Monthly metrics over 12 months</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Total Trips</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalTrips}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-red-700 dark:text-red-200">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                            ${totalExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">Avg Revenue/Trip</p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                            ${avgRevenuePerTrip.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>

                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="month"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                                label={{ value: "Revenue ($)", angle: -90, position: "insideLeft" }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                                label={{ value: "Trip Count", angle: 90, position: "insideRight" }}
                            />
                            <Tooltip
                                formatter={(value) => {
                                    if (typeof value === "number") {
                                        if (value > 1000) {
                                            return `$${value.toLocaleString()}`;
                                        }
                                        return value;
                                    }
                                    return value;
                                }}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="revenue"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ fill: "#10b981", r: 4 }}
                                name="Revenue ($)"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="tripCount"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ fill: "#3b82f6", r: 4 }}
                                name="Trip Count"
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="expenses"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={{ fill: "#ef4444", r: 4 }}
                                name="Expenses ($)"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Trend Summary */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                        Over the past 12 months, you've generated{" "}
                        <span className="font-semibold text-foreground">
                            ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>{" "}
                        in revenue from <span className="font-semibold text-foreground">{totalTrips}</span> trips,
                        with total expenses of{" "}
                        <span className="font-semibold text-foreground">
                            ${totalExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                        . Your average revenue per trip is{" "}
                        <span className="font-semibold text-foreground">
                            ${avgRevenuePerTrip.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                        .
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
