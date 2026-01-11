import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
    Calendar,
    DollarSign,
    Truck,
    MapPin,
    ArrowLeft,
    Pencil,
    Tag
} from "lucide-react";

interface ExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function ExpensePage({ params }: ExpensePageProps) {
    const { id } = await params;
    const user = await requireRole(["admin", "supervisor", "staff"]);

    const expense = await prisma.expense.findUnique({
        where: {
            id,
            organizationId: user.organizationId
        },
        include: {
            category: true,
            truckExpenses: {
                include: {
                    truck: {
                        select: {
                            id: true,
                            registrationNo: true,
                            make: true,
                            model: true,
                        },
                    },
                },
            },
            tripExpenses: {
                include: {
                    trip: {
                        select: {
                            id: true,
                            originCity: true,
                            destinationCity: true,
                            scheduledDate: true,
                        },
                    },
                },
            },
        },
    });

    if (!expense) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Link href="/finance/expenses">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <PageHeader
                    title="Expense Details"
                    description={`View expense from ${new Date(expense.date).toLocaleDateString()}`}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Main Details Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Expense Information</CardTitle>
                        <Link href={`/finance/expenses/${expense.id}/edit`}>
                            <Button variant="outline" size="sm">
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Amount */}
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <DollarSign className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Amount</p>
                                <p className="text-2xl font-bold">{formatCurrency(expense.amount)}</p>
                            </div>
                        </div>

                        {/* Category */}
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                                <Tag className="h-5 w-5 text-secondary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Category</p>
                                <div className="flex items-center gap-2">
                                    {expense.category.color && (
                                        <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: expense.category.color }}
                                        />
                                    )}
                                    <p className="font-medium">{expense.category.name}</p>
                                </div>
                            </div>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Date</p>
                                <p className="font-medium">
                                    {new Date(expense.date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Associations Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Associations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Associated Trucks */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-medium">Trucks</p>
                            </div>
                            {expense.truckExpenses.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {expense.truckExpenses.map((te) => (
                                        <Link
                                            key={te.truck.id}
                                            href={`/fleet/trucks/${te.truck.id}`}
                                        >
                                            <Badge
                                                variant="secondary"
                                                className="hover:bg-secondary/80 cursor-pointer"
                                            >
                                                {te.truck.registrationNo}
                                                <span className="ml-1 text-xs text-muted-foreground">
                                                    {te.truck.make} {te.truck.model}
                                                </span>
                                            </Badge>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No trucks associated with this expense
                                </p>
                            )}
                        </div>

                        {/* Associated Trips */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-medium">Trips</p>
                            </div>
                            {expense.tripExpenses.length > 0 ? (
                                <div className="space-y-2">
                                    {expense.tripExpenses.map((te) => (
                                        <Link
                                            key={te.trip.id}
                                            href={`/operations/trips/${te.trip.id}`}
                                        >
                                            <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                                                <div>
                                                    <p className="font-medium">
                                                        {te.trip.originCity} → {te.trip.destinationCity}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(te.trip.scheduledDate).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No trips associated with this expense
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <Link href="/finance/expenses">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Expenses
                    </Button>
                </Link>
                <Link href={`/finance/expenses/${expense.id}/edit`}>
                    <Button>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Expense
                    </Button>
                </Link>
            </div>
        </div>
    );
}
