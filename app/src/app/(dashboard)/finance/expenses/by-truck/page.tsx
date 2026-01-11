import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Truck, Calendar } from "lucide-react";

export default async function ExpensesByTruckPage() {
    const user = await requireRole(["admin", "supervisor", "staff"]);

    // Get all trucks with their associated expenses
    const trucks = await prisma.truck.findMany({
        where: {
            organizationId: user.organizationId,
        },
        include: {
            truckExpenses: {
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
            registrationNo: "asc",
        },
    });

    // Calculate totals per truck
    const trucksWithTotals = trucks.map((truck) => {
        const total = truck.truckExpenses.reduce(
            (sum, te) => sum + te.expense.amount,
            0
        );
        return {
            ...truck,
            total,
            expenseCount: truck.truckExpenses.length,
        };
    }).filter(truck => truck.expenseCount > 0); // Only show trucks with expenses

    const grandTotal = trucksWithTotals.reduce((sum, truck) => sum + truck.total, 0);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expenses by Truck"
                description="View all expenses assigned to each truck"
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

            {trucksWithTotals.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        No truck expenses found
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {trucksWithTotals.map((truck) => (
                        <Card key={truck.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Truck className="h-5 w-5" />
                                            {truck.registrationNo}
                                        </CardTitle>
                                        <CardDescription>
                                            {truck.make} {truck.model} ({truck.year}) • {truck.status}
                                        </CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold">
                                            {formatCurrency(truck.total)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {truck.expenseCount} {truck.expenseCount === 1 ? "expense" : "expenses"}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {truck.truckExpenses.map((te) => (
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
