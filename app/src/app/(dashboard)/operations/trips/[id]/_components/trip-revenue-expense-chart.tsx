"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TripRevenueExpenseChartProps {
    revenue: number;
    expenses: number;
}

const COLORS = ["#22c55e", "#ef4444"]; // green for revenue, red for expenses

export function TripRevenueExpenseChart({ revenue, expenses }: TripRevenueExpenseChartProps) {
    const data = [
        { name: "Revenue", value: revenue },
        { name: "Expenses", value: expenses },
    ];

    const profit = revenue - expenses;
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
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, value }) => `$${value.toLocaleString()}`}
                                labelLine={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend />
                        </PieChart>
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
