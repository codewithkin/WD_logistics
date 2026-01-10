"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FleetUtilizationData } from "@/lib/dashboard/fleet-utilization";

interface FleetUtilizationChartProps {
    data: FleetUtilizationData[];
}

export function FleetUtilizationChart({ data }: FleetUtilizationChartProps) {
    // Format data for chart
    const chartData = data.map((item) => ({
        ...item,
        percentage: parseFloat(item.percentage.toFixed(1)),
    }));

    // Calculate total trucks
    const totalTrucks = data.reduce((sum, item) => sum + item.count, 0);

    // Get active trucks (active + in_service)
    const activeTrucks =
        data
            .filter((item) => item.status === "Active" || item.status === "In Service")
            .reduce((sum, item) => sum + item.count, 0) || 0;

    const utilizationRate = totalTrucks > 0 ? (activeTrucks / totalTrucks) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Fleet Utilization</CardTitle>
                <CardDescription>Truck status distribution</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Total Trucks</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalTrucks}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">Active</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">{activeTrucks}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-200">Utilization</p>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                            {utilizationRate.toFixed(0)}%
                        </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Idle/Repair</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {totalTrucks - activeTrucks}
                        </p>
                    </div>
                </div>

                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="status"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                                yAxisId="left"
                                label={{ value: "Count", angle: -90, position: "insideLeft" }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "12px" }}
                                label={{ value: "Percentage (%)", angle: 90, position: "insideRight" }}
                            />
                            <Tooltip
                                formatter={(value) =>
                                    typeof value === "number" ? value.toFixed(1) : value
                                }
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Bar yAxisId="left" dataKey="count" name="Truck Count" radius={[8, 8, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                            <Bar
                                yAxisId="right"
                                dataKey="percentage"
                                name="Percentage (%)"
                                radius={[8, 8, 0, 0]}
                                fill="rgba(148, 163, 184, 0.5)"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Status Breakdown */}
                <div className="mt-6 space-y-3">
                    <h4 className="font-semibold text-sm">Status Breakdown</h4>
                    {chartData.map((item) => (
                        <div key={item.status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className="text-sm text-muted-foreground">{item.status}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium">{item.count} trucks</span>
                                <span className="text-sm text-muted-foreground w-12 text-right">
                                    {item.percentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
