"use client";

import {
    PieChart,
    Pie,
    Cell,
    Legend,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TripStatusData } from "@/lib/dashboard/trip-status";

interface TripStatusChartProps {
    data: TripStatusData[];
}

export function TripStatusChart({ data }: TripStatusChartProps) {
    // Calculate totals
    const totalTrips = data.reduce((sum, item) => sum + item.count, 0);
    const completedTrips = data.find((item) => item.status === "Completed")?.count || 0;
    const inProgressTrips = data.find((item) => item.status === "In Progress")?.count || 0;
    const scheduledTrips = data.find((item) => item.status === "Scheduled")?.count || 0;
    const cancelledTrips = data.find((item) => item.status === "Cancelled")?.count || 0;

    const completionRate = totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Trip Status Distribution</CardTitle>
                <CardDescription>Current trip status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Total Trips</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalTrips}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-200">In Progress</p>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{inProgressTrips}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">Completed</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">{completedTrips}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">Completion Rate</p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                            {completionRate.toFixed(0)}%
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Donut Chart */}
                    <div className="flex justify-center">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="count"
                                    label={({ status, percentage }) => `${status} (${percentage.toFixed(0)}%)`}
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => [
                                        `${value} trips`,
                                        "Count",
                                    ]}
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--background))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Status Details */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Status Breakdown</h4>
                        {data.map((item) => (
                            <div key={item.status} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-sm font-medium">{item.status}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {item.count} trips ({item.percentage.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full"
                                        style={{
                                            width: `${item.percentage}%`,
                                            backgroundColor: item.color,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Summary Info */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{scheduledTrips}</span> trips scheduled,{" "}
                        <span className="font-semibold text-foreground">{inProgressTrips}</span> in progress, and{" "}
                        <span className="font-semibold text-foreground">{completedTrips}</span> completed.
                        {cancelledTrips > 0 && (
                            <>
                                {" "}
                                <span className="font-semibold text-foreground">{cancelledTrips}</span> were cancelled.
                            </>
                        )}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
