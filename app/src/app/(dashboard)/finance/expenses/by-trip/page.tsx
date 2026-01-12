import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Truck as TruckIcon } from "lucide-react";

export default async function ExpensesByTripPage() {
    const user = await requireRole(["admin", "supervisor", "staff"]);

    // Get all trips with their associated expenses
    const trips = await prisma.trip.findMany({
        where: {
            organizationId: user.organizationId,
        },
        include: {
            truck: true,
            driver: true,
            tripExpenses: {
                include: {
                    expense: {
                        include: {
                            category: true,
                        },
                    },
                },
                orderBy: {
                    expense: {
                        date: "desc",
                    },
                },
            },
        },
        orderBy: {
            scheduledDate: "desc",
        },
    });

    // Calculate totals per trip
    const tripsWithTotals = trips.map((trip) => {
        const total = trip.tripExpenses.reduce(
            (sum, te) => sum + te.expense.amount,
            0
        );
        return {
            ...trip,
            total,
            expenseCount: trip.tripExpenses.length,
        };
    }).filter(trip => trip.expenseCount > 0); // Only show trips with expenses

    const grandTotal = tripsWithTotals.reduce((sum, trip) => sum + trip.total, 0);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expenses by Trip"
                description="View all expenses assigned to each trip"
            />

            <div className="flex justify-between items-center">
                <Link href="/finance/expenses">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Expenses
                    </Button>
                </Link>
                <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="text-2xl font-bold">{formatCurrency(grandTotal)}</span>
                </div>
            </div>

            {tripsWithTotals.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        No trip expenses found
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {tripsWithTotals.map((trip) => (
                        <Card key={trip.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5" />
                                            {trip.originCity} → {trip.destinationCity}
                                        </CardTitle>
                                        <CardDescription className="mt-1 space-y-1">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(trip.scheduledDate).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <TruckIcon className="h-3 w-3" />
                                                {trip.truck.registrationNo} • {trip.driver.firstName} {trip.driver.lastName}
                                            </div>
                                            <div>
                                                <StatusBadge status={trip.status} type="trip" />
                                            </div>
                                        </CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">
                                            {formatCurrency(trip.total)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {trip.expenseCount} {trip.expenseCount === 1 ? "expense" : "expenses"}
                                        </div>
                                        {trip.revenue > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Revenue: {formatCurrency(trip.revenue)}
                                                <br />
                                                Net: {formatCurrency(trip.revenue - trip.total)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {trip.tripExpenses.map((te) => (
                                        <div
                                            key={te.expense.id}
                                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge
                                                        variant="outline"
                                                        style={{
                                                            borderColor: te.expense.category.color || undefined,
                                                            color: te.expense.category.color || undefined,
                                                        }}
                                                    >
                                                        {te.expense.category.name}
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(te.expense.date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="text-sm">
                                                    {te.expense.description || "No description"}
                                                </div>
                                                {te.expense.vendor && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Vendor: {te.expense.vendor}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="font-bold">
                                                        {formatCurrency(te.expense.amount)}
                                                    </div>
                                                </div>
                                                <Link href={`/finance/expenses/${te.expense.id}/edit`}>
                                                    <Button variant="ghost" size="sm">
                                                        View
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
