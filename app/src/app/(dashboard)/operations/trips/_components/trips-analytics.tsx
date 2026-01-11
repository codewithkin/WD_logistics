"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, TrendingUp, Truck, MapPin, DollarSign, CheckCircle, Clock, XCircle, Calendar } from "lucide-react";
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

interface Trip {
    id: string;
    originCity: string;
    destinationCity: string;
    status: string;
    revenue: number;
    estimatedMileage: number;
    actualMileage: number | null;
    scheduledDate: Date;
    truck: { registrationNo: string };
    driver: { firstName: string; lastName: string };
    customer: { name: string } | null;
}

interface TripsAnalyticsProps {
    analytics: {
        totalTrips: number;
        completedTrips: number;
        inProgressTrips: number;
        scheduledTrips: number;
        cancelledTrips: number;
        totalRevenue: number;
        totalMileage: number;
        completionRate: number;
    };
    trips: Trip[];
    canExport: boolean;
}

const STATUS_COLORS = {
    completed: "#10b981",
    in_progress: "#f59e0b",
    scheduled: "#3b82f6",
    cancelled: "#ef4444",
};

export function TripsAnalytics({ analytics, trips, canExport }: TripsAnalyticsProps) {
    const statusData = [
        { name: "Completed", value: analytics.completedTrips, color: STATUS_COLORS.completed },
        { name: "In Progress", value: analytics.inProgressTrips, color: STATUS_COLORS.in_progress },
        { name: "Scheduled", value: analytics.scheduledTrips, color: STATUS_COLORS.scheduled },
        { name: "Cancelled", value: analytics.cancelledTrips, color: STATUS_COLORS.cancelled },
    ].filter(d => d.value > 0);

    // Group trips by month for bar chart
    const monthlyData = trips.reduce((acc, trip) => {
        const month = format(new Date(trip.scheduledDate), "MMM yyyy");
        if (!acc[month]) {
            acc[month] = { month, trips: 0, revenue: 0 };
        }
        acc[month].trips += 1;
        acc[month].revenue += trip.revenue;
        return acc;
    }, {} as Record<string, { month: string; trips: number; revenue: number }>);

    const monthlyChartData = Object.values(monthlyData).slice(-6);

    const handleExportCSV = () => {
        const headers = ["Origin", "Destination", "Status", "Revenue", "Mileage", "Date", "Truck", "Driver", "Customer"];
        const rows = trips.map(t => [
            t.originCity,
            t.destinationCity,
            t.status,
            t.revenue.toString(),
            (t.actualMileage || t.estimatedMileage).toString(),
            format(new Date(t.scheduledDate), "yyyy-MM-dd"),
            t.truck.registrationNo,
            `${t.driver.firstName} ${t.driver.lastName}`,
            t.customer?.name || "N/A",
        ]);

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trips-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        // For PDF export, we'll open a print-friendly view
        window.print();
    };

    return (
        <div className="space-y-6">
            {/* Export Buttons */}
            {canExport && (
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleExportCSV}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                    </Button>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalTrips}</div>
                        <p className="text-xs text-muted-foreground">
                            {analytics.inProgressTrips} in progress
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${analytics.totalRevenue.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            From all trips
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Mileage</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analytics.totalMileage.toLocaleString()} km
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Across all trips
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {analytics.completionRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {analytics.completedTrips} completed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Status Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">Completed</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                            {analytics.completedTrips}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">In Progress</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                            {analytics.inProgressTrips}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Scheduled</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                            {analytics.scheduledTrips}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">Cancelled</span>
                        </div>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                            {analytics.cancelledTrips}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Trip Status Distribution</CardTitle>
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
                        <CardTitle>Monthly Trips & Revenue</CardTitle>
                        <CardDescription>Last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" />
                                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--background))",
                                            border: "1px solid hsl(var(--border))",
                                        }}
                                    />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="trips" fill="#3b82f6" name="Trips" />
                                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
