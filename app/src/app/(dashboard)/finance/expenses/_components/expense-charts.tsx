"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { getExpensesForCharts } from "../actions";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Calendar, Truck, MapPin, User } from "lucide-react";

interface Category {
    id: string;
    name: string;
    color: string | null;
}

interface ExpenseChartsProps {
    categories: Category[];
}

interface ChartData {
    byCategory: Array<{ category: string; amount: number; color: string; count: number }>;
    byMonth: Array<{ month: string; amount: number }>;
    byTruck: Array<{ truck: string; amount: number }>;
    byTrip: Array<{ trip: string; amount: number }>;
    byDriver: Array<{ driver: string; amount: number }>;
    total: number;
}

export function ExpenseCharts({ categories }: ExpenseChartsProps) {
    const [data, setData] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("30");

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const chartData = await getExpensesForCharts(parseInt(timeRange));
                setData(chartData);
            } catch (error) {
                console.error("Failed to fetch chart data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [timeRange]);

    // Export handlers
    useEffect(() => {
        const handleExportCSV = () => {
            if (!data) return;
            const csvData = data.byCategory
                .map((item) => `${item.category},${item.count},${item.amount}`)
                .join("\n");
            const csv = "Category,Count,Amount\n" + csvData;
            const blob = new Blob([csv], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `expense-analytics-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        };

        window.addEventListener("export-csv", handleExportCSV);

        return () => {
            window.removeEventListener("export-csv", handleExportCSV);
        };
    }, [data]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-9 w-36" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-48 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (!data) return null;

    const maxCategoryAmount = Math.max(...data.byCategory.map((c) => c.amount), 1);
    const maxTruckAmount = Math.max(...data.byTruck.map((t) => t.amount), 1);
    const maxTripAmount = Math.max(...data.byTrip.map((t) => t.amount), 1);
    const maxDriverAmount = Math.max(...data.byDriver.map((d) => d.amount), 1);

    // Calculate totals for comparison chart
    const truckTotal = data.byTruck.reduce((sum, t) => sum + t.amount, 0);
    const tripTotal = data.byTrip.reduce((sum, t) => sum + t.amount, 0);
    const driverTotal = data.byDriver.reduce((sum, d) => sum + d.amount, 0);
    const comparisonMax = Math.max(truckTotal, tripTotal, driverTotal, 1);

    // Calculate trend
    const getTrend = () => {
        if (data.byMonth.length < 2) return { direction: "neutral", percent: 0 };
        const current = data.byMonth[data.byMonth.length - 1]?.amount || 0;
        const previous = data.byMonth[data.byMonth.length - 2]?.amount || 0;
        if (previous === 0) return { direction: "neutral", percent: 0 };
        const percent = ((current - previous) / previous) * 100;
        return {
            direction: percent > 0 ? "up" : percent < 0 ? "down" : "neutral",
            percent: Math.abs(percent),
        };
    };

    const trend = getTrend();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold">Expense Analytics</h3>
                    <p className="text-sm text-muted-foreground">Insights into your spending patterns</p>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-40">
                        <Calendar className="mr-2 h-4 w-4" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                        <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Total Summary */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Spending</p>
                            <p className="text-4xl font-bold tracking-tight">{formatCurrency(data.total)}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Last {timeRange} days • {data.byCategory.reduce((sum, c) => sum + c.count, 0)} expenses
                            </p>
                        </div>
                        {trend.direction !== "neutral" && (
                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${trend.direction === "up"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                }`}>
                                {trend.direction === "up" ? (
                                    <TrendingUp className="h-4 w-4" />
                                ) : (
                                    <TrendingDown className="h-4 w-4" />
                                )}
                                {trend.percent.toFixed(1)}%
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Expense Comparison Chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Expense Distribution Comparison</CardTitle>
                    <CardDescription>Compare expenses by truck, trip, and driver</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Visual Comparison Bars */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <Truck className="h-4 w-4 text-orange-500" />
                                        <span className="font-medium">Truck Expenses</span>
                                    </div>
                                    <span className="font-semibold">{formatCurrency(truckTotal)}</span>
                                </div>
                                <div className="h-8 w-full bg-secondary rounded-lg overflow-hidden">
                                    <div
                                        className="h-full bg-orange-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                                        style={{ width: `${(truckTotal / comparisonMax) * 100}%`, minWidth: truckTotal > 0 ? '10%' : '0%' }}
                                    >
                                        {truckTotal > 0 && <span className="text-xs text-white font-medium">{((truckTotal / data.total) * 100).toFixed(1)}%</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">Trip Expenses</span>
                                    </div>
                                    <span className="font-semibold">{formatCurrency(tripTotal)}</span>
                                </div>
                                <div className="h-8 w-full bg-secondary rounded-lg overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                                        style={{ width: `${(tripTotal / comparisonMax) * 100}%`, minWidth: tripTotal > 0 ? '10%' : '0%' }}
                                    >
                                        {tripTotal > 0 && <span className="text-xs text-white font-medium">{((tripTotal / data.total) * 100).toFixed(1)}%</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">Driver Expenses</span>
                                    </div>
                                    <span className="font-semibold">{formatCurrency(driverTotal)}</span>
                                </div>
                                <div className="h-8 w-full bg-secondary rounded-lg overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                                        style={{ width: `${(driverTotal / comparisonMax) * 100}%`, minWidth: driverTotal > 0 ? '10%' : '0%' }}
                                    >
                                        {driverTotal > 0 && <span className="text-xs text-white font-medium">{((driverTotal / data.total) * 100).toFixed(1)}%</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 justify-center pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm">
                                <div className="h-3 w-3 rounded-full bg-orange-500" />
                                <span>Trucks: {data.byTruck.length}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <div className="h-3 w-3 rounded-full bg-green-500" />
                                <span>Trips: {data.byTrip.length}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <div className="h-3 w-3 rounded-full bg-blue-500" />
                                <span>Drivers: {data.byDriver.length}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Expense Tables by Entity */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Detailed Expense Breakdown</CardTitle>
                    <CardDescription>View expenses by truck, trip, or driver</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="trucks" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="trucks" className="gap-2">
                                <Truck className="h-4 w-4" />
                                <span className="hidden sm:inline">By Truck</span>
                            </TabsTrigger>
                            <TabsTrigger value="trips" className="gap-2">
                                <MapPin className="h-4 w-4" />
                                <span className="hidden sm:inline">By Trip</span>
                            </TabsTrigger>
                            <TabsTrigger value="drivers" className="gap-2">
                                <User className="h-4 w-4" />
                                <span className="hidden sm:inline">By Driver</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Expenses by Truck Table */}
                        <TabsContent value="trucks" className="mt-4">
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>Truck</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">% of Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.byTruck.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    No truck expenses found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.byTruck.slice(0, 10).map((item, index) => (
                                                <TableRow key={item.truck}>
                                                    <TableCell className="font-medium">#{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Truck className="h-4 w-4 text-orange-500" />
                                                            {item.truck}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(item.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {truckTotal > 0 ? ((item.amount / truckTotal) * 100).toFixed(1) : 0}%
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {data.byTruck.length > 10 && (
                                <p className="text-sm text-muted-foreground text-center mt-2">
                                    Showing top 10 of {data.byTruck.length} trucks
                                </p>
                            )}
                        </TabsContent>

                        {/* Expenses by Trip Table */}
                        <TabsContent value="trips" className="mt-4">
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>Trip</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">% of Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.byTrip.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    No trip expenses found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.byTrip.slice(0, 10).map((item, index) => (
                                                <TableRow key={item.trip}>
                                                    <TableCell className="font-medium">#{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="h-4 w-4 text-green-500" />
                                                            <span className="truncate max-w-48">{item.trip}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(item.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {tripTotal > 0 ? ((item.amount / tripTotal) * 100).toFixed(1) : 0}%
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {data.byTrip.length > 10 && (
                                <p className="text-sm text-muted-foreground text-center mt-2">
                                    Showing top 10 of {data.byTrip.length} trips
                                </p>
                            )}
                        </TabsContent>

                        {/* Expenses by Driver Table */}
                        <TabsContent value="drivers" className="mt-4">
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>Driver</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">% of Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.byDriver.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    No driver expenses found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.byDriver.slice(0, 10).map((item, index) => (
                                                <TableRow key={item.driver}>
                                                    <TableCell className="font-medium">#{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-blue-500" />
                                                            {item.driver}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(item.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {driverTotal > 0 ? ((item.amount / driverTotal) * 100).toFixed(1) : 0}%
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {data.byDriver.length > 10 && (
                                <p className="text-sm text-muted-foreground text-center mt-2">
                                    Showing top 10 of {data.byDriver.length} drivers
                                </p>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* By Category */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Category</CardTitle>
                        <CardDescription>Spending distribution</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.byCategory.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No expense data
                                </p>
                            ) : (
                                data.byCategory.slice(0, 6).map((item) => (
                                    <div key={item.category} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <span className="font-medium truncate">{item.category}</span>
                                                <span className="text-muted-foreground shrink-0">({item.count})</span>
                                            </div>
                                            <span className="font-semibold shrink-0 ml-2">
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(item.amount / maxCategoryAmount) * 100}%`,
                                                    backgroundColor: item.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* By Truck */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Truck</CardTitle>
                        <CardDescription>Top 5 trucks by expense</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.byTruck.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No truck expenses
                                </p>
                            ) : (
                                data.byTruck.slice(0, 5).map((item) => (
                                    <div key={item.truck} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{item.truck}</span>
                                            <span className="font-semibold">
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(item.amount / maxTruckAmount) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* By Trip */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Trip</CardTitle>
                        <CardDescription>Top 5 trips by expense</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.byTrip.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No trip expenses
                                </p>
                            ) : (
                                data.byTrip.slice(0, 5).map((item) => (
                                    <div key={item.trip} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium truncate max-w-32">{item.trip}</span>
                                            <span className="font-semibold shrink-0">
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(item.amount / maxTripAmount) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* By Driver */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">By Driver</CardTitle>
                        <CardDescription>Top 5 drivers by expense</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.byDriver.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No driver expenses
                                </p>
                            ) : (
                                data.byDriver.slice(0, 5).map((item) => (
                                    <div key={item.driver} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium truncate max-w-32">{item.driver}</span>
                                            <span className="font-semibold shrink-0">
                                                {formatCurrency(item.amount)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(item.amount / maxDriverAmount) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Trend */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Monthly Trend</CardTitle>
                    <CardDescription>Expense history over time</CardDescription>
                </CardHeader>
                <CardContent>
                    {data.byMonth.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No monthly data available
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {data.byMonth.map((item) => (
                                <div
                                    key={item.month}
                                    className="rounded-lg border bg-muted/30 p-3 text-center hover:bg-muted/50 transition-colors"
                                >
                                    <p className="text-xs text-muted-foreground font-medium">{item.month}</p>
                                    <p className="text-lg font-bold mt-1">{formatCurrency(item.amount)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
