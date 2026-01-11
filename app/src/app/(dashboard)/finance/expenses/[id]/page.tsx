import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
    Calendar,
    DollarSign,
    FileText,
    Pencil,
    Truck,
    MapPin,
    ArrowLeft,
    Tag,
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
            organizationId: user.organizationId,
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
                            truck: {
                                select: {
                                    registrationNo: true,
                                },
                            },
                            driver: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                },
                            },
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

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Details Card */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Expense Information</CardTitle>
                        <Link href={`/finance/expenses/${expense.id}/edit`}>
                            <Button variant="outline" size="sm">
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Amount and Category */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-full flex items-center justify-center"
                                    style={{
                                        backgroundColor: expense.category.color || "#71717a",
                                    }}
                                >
                                    <DollarSign className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {formatCurrency(expense.amount)}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            style={{
                                                backgroundColor: `${expense.category.color}20`,
                                                color: expense.category.color || undefined,
                                            }}
                                        >
                                            <Tag className="mr-1 h-3 w-3" />
                                            {expense.category.name}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Details Grid */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Date</p>
                                    <p className="font-medium">
                                        {new Date(expense.date).toLocaleDateString("en-US", {
                                            weekday: "long",
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </p>
                                </div>
                            </div>

                            {expense.description && (
                                <div className="flex items-start gap-3">
                                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Description</p>
                                        <p className="font-medium">{expense.description}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {expense.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Notes</p>
                                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                                        {expense.notes}
                                    </p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Associations Card */}
                <div className="space-y-6">
                    {/* Associated Trucks */}
                    {expense.truckExpenses.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Truck className="h-4 w-4" />
                                    Associated Trucks
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {expense.truckExpenses.map(({ truck }) => (
                                    <Link
                                        key={truck.id}
                                        href={`/fleet/trucks/${truck.id}`}
                                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Truck className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{truck.registrationNo}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {truck.make} {truck.model}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Associated Trips */}
                    {expense.tripExpenses.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <MapPin className="h-4 w-4" />
                                    Associated Trips
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {expense.tripExpenses.map(({ trip }) => (
                                    <Link
                                        key={trip.id}
                                        href={`/operations/trips/${trip.id}`}
                                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
                                            <MapPin className="h-5 w-5 text-secondary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium truncate">
                                                {trip.originCity} → {trip.destinationCity}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(trip.scheduledDate).toLocaleDateString()} •{" "}
                                                {trip.driver.firstName} {trip.driver.lastName}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* No Associations */}
                    {expense.truckExpenses.length === 0 && expense.tripExpenses.length === 0 && (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                <p>No truck or trip associations</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
