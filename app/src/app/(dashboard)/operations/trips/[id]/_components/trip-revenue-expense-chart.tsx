"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Bar,
    BarChart,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TripRevenueExpenseChartProps {
    revenue: number;
    expenses: number;
}

const REVENUE_COLOR = "#22c55e";
const EXPENSE_COLOR = "#ef4444";
const PROFIT_COLOR = "#3b82f6";
const LOSS_COLOR = "#f97316";

export function TripRevenueExpenseChart({ revenue, expenses }: TripRevenueExpenseChartProps) {
    const profit = revenue - expenses;

    // Bars, not a pie. A pie says "these are slices of one whole", but expenses
    // aren't part of revenue — they're subtracted from it, and a trip that
    // loses money can't be drawn as a share of anything at all.
    const data = [
        { name: "Revenue", value: revenue, fill: REVENUE_COLOR },
        { name: "Expenses", value: expenses, fill: EXPENSE_COLOR },
        { name: profit >= 0 ? "Profit" : "Loss", value: profit, fill: profit >= 0 ? PROFIT_COLOR : LOSS_COLOR },
    ];
    const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
    const isProfitable = profit >= 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    {isProfitable ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    Revenue vs Expenses
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={72}
                                axisLine={false}
                                tickLine={false}
                                style={{ fontSize: "12px" }}
                            />
                            <Tooltip
                                cursor={{ fill: "transparent" }}
                                formatter={(value) => [
                                    `$${Number(value).toLocaleString()}`,
                                    "",
                                ]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                                {data.map((entry) => (
                                    <Cell key={entry.name} fill={entry.fill} />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="right"
                                    formatter={(value) => `$${Number(value).toLocaleString()}`}
                                    style={{ fontSize: "12px" }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-medium text-green-600">${revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Expenses</span>
                        <span className="font-medium text-red-600">${expenses.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-medium pt-2 border-t">
                        <span>{isProfitable ? "Profit" : "Loss"}</span>
                        <span className={isProfitable ? "text-green-600" : "text-red-600"}>
                            ${Math.abs(profit).toLocaleString()} ({profitMargin}%)
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
