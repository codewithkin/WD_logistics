import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Truck, MapPin, Tag, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { canViewExpensesPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

interface ExpenseAnalyticsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function ExpenseAnalyticsPage({ searchParams }: ExpenseAnalyticsPageProps) {
    const params = await searchParams;
    const user = await requireRole(["admin", "supervisor"]);

    // Check if user can view expenses page
    if (!canViewExpensesPage(user.role)) {
        redirect("/dashboard");
    }

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    // Fetch all expenses with associations within the selected period
    const expenses = await prisma.expense.findMany({
        where: {
            organizationId: user.organizationId,
            date: {
                gte: dateRange.from,
                lte: dateRange.to,
            },
        },
        include: {
            category: true,
            truckExpenses: {
                include: {
                    truck: true,
                },
            },
            tripExpenses: {
                include: {
                    trip: {
                        include: {
                            truck: true,
                        },
                    },
                },
            },
        },
    });

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Group by category
    const categoryExpenses = expenses.reduce((acc, expense) => {
        const categoryName = expense.category.name;
        if (!acc[categoryName]) {
            acc[categoryName] = {
                total: 0,
                count: 0,
                color: expense.category.color,
            };
        }
        acc[categoryName].total += expense.amount;
        acc[categoryName].count += 1;
        return acc;
    }, {} as Record<string, { total: number; count: number; color: string | null }>);

    const topCategories = Object.entries(categoryExpenses)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 5);

    // Group by truck
    const truckExpenses = expenses.reduce((acc, expense) => {
        expense.truckExpenses.forEach((te) => {
            const truckKey = te.truck.registrationNo;
            if (!acc[truckKey]) {
                acc[truckKey] = {
                    total: 0,
                    count: 0,
                    truck: te.truck,
                };
            }
            acc[truckKey].total += expense.amount;
            acc[truckKey].count += 1;
        });
        return acc;
    }, {} as Record<string, { total: number; count: number; truck: any }>);

    const topTrucks = Object.entries(truckExpenses)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 5);

    // Group by trip
    const tripExpenses = expenses.reduce((acc, expense) => {
        expense.tripExpenses.forEach((te) => {
            const tripKey = `${te.trip.originCity}-${te.trip.destinationCity}-${te.trip.scheduledDate}`;
            if (!acc[tripKey]) {
                acc[tripKey] = {
                    total: 0,
                    count: 0,
                    trip: te.trip,
                };
            }
            acc[tripKey].total += expense.amount;
            acc[tripKey].count += 1;
        });
        return acc;
    }, {} as Record<string, { total: number; count: number; trip: any }>);

    const topTrips = Object.entries(tripExpenses)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 5);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Expense Analytics"
                    description={`Analyze expenses - ${dateRange.label}`}
                />
                <div className="flex items-center gap-3">
                    <PagePeriodSelector defaultPreset="1m" />
                    <Link href="/finance/expenses">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {dateRange.label} Summary
                    </CardTitle>
                    <CardDescription>
                        Total expenses and breakdown by entity
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Total Expenses</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Number of Expenses</p>
                            <p className="text-2xl font-bold">{expenses.length}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Average Expense</p>
                            <p className="text-2xl font-bold">
                                {expenses.length > 0 ? formatCurrency(totalExpenses / expenses.length) : formatCurrency(0)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Top Categories */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        Top Expense Categories
                    </CardTitle>
                    <CardDescription>
                        Categories with the highest total expenses
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {topCategories.length === 0 ? (
                        <p className="text-muted-foreground">No expense data available</p>
                    ) : (
                        <div className="space-y-4">
                            {topCategories.map(([category, data]) => (
                                <div key={category} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: data.color || "#71717a" }}
                                        />
                                        <div>
                                            <p className="font-medium">{category}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {data.count} {data.count === 1 ? "expense" : "expenses"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(data.total)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {((data.total / totalExpenses) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Top Trucks */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Top Consuming Trucks
                    </CardTitle>
                    <CardDescription>
                        Trucks with the highest associated expenses
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {topTrucks.length === 0 ? (
                        <p className="text-muted-foreground">No truck expenses recorded</p>
                    ) : (
                        <div className="space-y-4">
                            {topTrucks.map(([truckKey, data]) => (
                                <div key={truckKey} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{data.truck.registrationNo}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {data.truck.make} {data.truck.model} • {data.count}{" "}
                                            {data.count === 1 ? "expense" : "expenses"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(data.total)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {((data.total / totalExpenses) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Top Trips */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Top Consuming Trips
                    </CardTitle>
                    <CardDescription>
                        Trips with the highest associated expenses
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {topTrips.length === 0 ? (
                        <p className="text-muted-foreground">No trip expenses recorded</p>
                    ) : (
                        <div className="space-y-4">
                            {topTrips.map(([tripKey, data]) => (
                                <div key={tripKey} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">
                                            {data.trip.originCity} → {data.trip.destinationCity}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(data.trip.scheduledDate).toLocaleDateString()} •
                                            {data.trip.truck.registrationNo} • {data.count}{" "}
                                            {data.count === 1 ? "expense" : "expenses"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatCurrency(data.total)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {((data.total / totalExpenses) * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
