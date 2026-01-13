"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Users, UserCheck, UserX, Truck, Route, IdCard, Coffee, UserMinus, Loader2 } from "lucide-react";
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
import { exportDriversPDF } from "../actions";

interface Driver {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    licenseNumber: string;
    licenseType: string;
    status: string;
    assignedTruck: { registrationNo: string } | null;
    _count: { trips: number };
}

interface DriversAnalyticsProps {
    analytics: {
        totalDrivers: number;
        activeDrivers: number;
        inactiveDrivers: number;
        onLeaveDrivers: number;
        terminatedDrivers: number;
        driversWithTruck: number;
        driversWithoutTruck: number;
        totalTrips: number;
        licenseBreakdown: Array<{ type: string; count: number }>;
    };
    drivers: Driver[];
    canExport: boolean;
}

const STATUS_COLORS = {
    active: "#10b981",
    inactive: "#6b7280",
    on_leave: "#f59e0b",
    terminated: "#ef4444",
};

const LICENSE_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"
];

export function DriversAnalytics({ analytics, drivers, canExport }: DriversAnalyticsProps) {
    const [isExporting, setIsExporting] = useState(false);

    const statusData = [
        { name: "Active", value: analytics.activeDrivers, color: STATUS_COLORS.active },
        { name: "Inactive", value: analytics.inactiveDrivers, color: STATUS_COLORS.inactive },
        { name: "On Leave", value: analytics.onLeaveDrivers, color: STATUS_COLORS.on_leave },
        { name: "Terminated", value: analytics.terminatedDrivers, color: STATUS_COLORS.terminated },
    ].filter(d => d.value > 0);

    const assignmentData = [
        { name: "With Truck", value: analytics.driversWithTruck, color: "#10b981" },
        { name: "Without Truck", value: analytics.driversWithoutTruck, color: "#f59e0b" },
    ].filter(d => d.value > 0);

    // Top performers by trips
    const topPerformers = [...drivers]
        .sort((a, b) => b._count.trips - a._count.trips)
        .slice(0, 5)
        .map(d => ({
            name: `${d.firstName} ${d.lastName.charAt(0)}.`,
            trips: d._count.trips,
        }));

    const handleExportCSV = () => {
        const headers = ["First Name", "Last Name", "Email", "Phone", "License Number", "License Type", "Status", "Assigned Truck", "Trips"];
        const rows = drivers.map(d => [
            d.firstName,
            d.lastName,
            d.email || "N/A",
            d.phone,
            d.licenseNumber,
            d.licenseType,
            d.status,
            d.assignedTruck?.registrationNo || "N/A",
            d._count.trips.toString(),
        ]);

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `drivers-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const result = await exportDriversPDF();
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
                a.download = result.filename || "drivers-report.pdf";
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("PDF export error:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const averageTripsPerDriver = analytics.totalDrivers > 0
        ? analytics.totalTrips / analytics.totalDrivers
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
                        <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalDrivers}</div>
                        <p className="text-xs text-muted-foreground">
                            {analytics.activeDrivers} active
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Truck Assignment</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.driversWithTruck}</div>
                        <p className="text-xs text-muted-foreground">
                            {analytics.driversWithoutTruck} without truck
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
                        <Route className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalTrips}</div>
                        <p className="text-xs text-muted-foreground">
                            Across all drivers
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Trips/Driver</CardTitle>
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {averageTripsPerDriver.toFixed(1)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Per driver
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">Active</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                            {analytics.activeDrivers}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <UserMinus className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Inactive</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                            {analytics.inactiveDrivers}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Coffee className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">On Leave</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                            {analytics.onLeaveDrivers}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <UserX className="h-5 w-5 text-red-600" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">Terminated</span>
                        </div>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                            {analytics.terminatedDrivers}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Driver Status Distribution</CardTitle>
                        <CardDescription>Breakdown by current status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top Performers</CardTitle>
                        <CardDescription>Drivers with most trips</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topPerformers} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                                    <YAxis type="category" dataKey="name" width={80} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--background))",
                                            border: "1px solid hsl(var(--border))",
                                        }}
                                    />
                                    <Bar dataKey="trips" fill="#3b82f6" name="Trips" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* License Type Breakdown */}
            {analytics.licenseBreakdown.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>License Types</CardTitle>
                        <CardDescription>Distribution by license type</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.licenseBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="count"
                                        nameKey="type"
                                        label={(props: any) => `${props.type}: ${props.count}`}
                                    >
                                        {analytics.licenseBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={LICENSE_COLORS[index % LICENSE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
