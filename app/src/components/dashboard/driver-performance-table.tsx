"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DriverPerformanceMetric } from "@/lib/dashboard/driver-performance";
import { Star } from "lucide-react";

interface DriverPerformanceTableProps {
    data: DriverPerformanceMetric[];
}

/**
 * Get color for heat map based on efficiency percentage
 */
function getEfficiencyColor(efficiency: number): {
    bgClass: string;
    textClass: string;
    barColor: string;
} {
    if (efficiency >= 90) {
        return {
            bgClass: "bg-green-50 dark:bg-green-950",
            textClass: "text-green-700 dark:text-green-200",
            barColor: "#10b981",
        };
    } else if (efficiency >= 75) {
        return {
            bgClass: "bg-yellow-50 dark:bg-yellow-950",
            textClass: "text-yellow-700 dark:text-yellow-200",
            barColor: "#f59e0b",
        };
    } else if (efficiency >= 60) {
        return {
            bgClass: "bg-orange-50 dark:bg-orange-950",
            textClass: "text-orange-700 dark:text-orange-200",
            barColor: "#f97316",
        };
    } else {
        return {
            bgClass: "bg-red-50 dark:bg-red-950",
            textClass: "text-red-700 dark:text-red-200",
            barColor: "#ef4444",
        };
    }
}

export function DriverPerformanceTable({ data }: DriverPerformanceTableProps) {
    const topDrivers = data.slice(0, 10);
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const avgEfficiency =
        data.length > 0
            ? Math.round(data.reduce((sum, d) => sum + d.efficiency, 0) / data.length)
            : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Driver Performance Metrics</CardTitle>
                <CardDescription>Top 10 drivers by revenue (last 3 months)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Total Drivers</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{data.length}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">Avg Efficiency</p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{avgEfficiency}%</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50 dark:bg-gray-800">
                                <TableHead className="font-semibold">Driver Name</TableHead>
                                <TableHead className="text-right font-semibold">Trips</TableHead>
                                <TableHead className="text-right font-semibold">Completed</TableHead>
                                <TableHead className="text-right font-semibold">Revenue</TableHead>
                                <TableHead className="text-center font-semibold">Rating</TableHead>
                                <TableHead className="text-right font-semibold">Efficiency</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topDrivers.map((driver, idx) => {
                                const efficiencyColor = getEfficiencyColor(driver.efficiency);
                                const completionRate =
                                    driver.totalTrips > 0
                                        ? Math.round((driver.completedTrips / driver.totalTrips) * 100)
                                        : 0;

                                return (
                                    <TableRow key={driver.driverId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                                    {idx + 1}
                                                </div>
                                                {driver.driverName}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{driver.totalTrips}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline">{completionRate}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${driver.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-1">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-4 h-4 ${
                                                            i < Math.floor(driver.rating)
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-gray-300 dark:text-gray-600"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className={`p-2 rounded-lg ${efficiencyColor.bgClass}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-sm font-bold ${efficiencyColor.textClass}`}>
                                                        {driver.efficiency}%
                                                    </span>
                                                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full"
                                                            style={{
                                                                width: `${driver.efficiency}%`,
                                                                backgroundColor: efficiencyColor.barColor,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Legend */}
                <div className="mt-6 grid grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-sm text-muted-foreground">Excellent (90%+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-sm text-muted-foreground">Good (75-89%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span className="text-sm text-muted-foreground">Fair (60-74%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span className="text-sm text-muted-foreground">Needs Improvement (&lt;60%)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
