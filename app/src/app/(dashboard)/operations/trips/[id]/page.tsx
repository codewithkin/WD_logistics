import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Pencil,
    MapPin,
    Calendar,
    Truck,
    User,
    DollarSign,
    Package,
    FileText,
    Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { TRIP_STATUS_LABELS, TRIP_STATUS_COLORS } from "@/lib/types";

interface TripDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const trip = await prisma.trip.findFirst({
        where: { id, organizationId },
        include: {
            truck: true,
            driver: true,
            customer: true,
            expenses: {
                include: {
                    category: true,
                },
            },
            invoices: true,
        },
    });

    if (!trip) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";
    const totalExpenses = trip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = trip.revenue - totalExpenses;

    return (
        <div>
            <PageHeader
                title={`${trip.origin} → ${trip.destination}`}
                description={`Trip on ${format(trip.startDate, "PPP")}`}
                backHref="/operations/trips"
                action={
                    canEdit
                        ? {
                            label: "Edit Trip",
                            href: `/operations/trips/${trip.id}/edit`,
                            icon: Pencil,
                        }
                        : undefined
                }
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="h-5 w-5" /> Route Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge className={TRIP_STATUS_COLORS[trip.status]}>
                                {TRIP_STATUS_LABELS[trip.status]}
                            </Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Origin</span>
                            <span className="font-medium">{trip.origin}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Destination</span>
                            <span className="font-medium">{trip.destination}</span>
                        </div>
                        {trip.distance && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Distance</span>
                                    <span className="font-medium">{trip.distance.toLocaleString()} km</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="h-5 w-5" /> Schedule
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Start Date</span>
                            <span className="font-medium">{format(trip.startDate, "PPP")}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">End Date</span>
                            <span className="font-medium">
                                {trip.endDate ? format(trip.endDate, "PPP") : "In Progress"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Assigned Resources</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Truck className="h-4 w-4" /> Truck
                            </span>
                            <Link
                                href={`/fleet/trucks/${trip.truck.id}`}
                                className="font-medium text-primary hover:underline"
                            >
                                {trip.truck.registrationNo}
                            </Link>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <User className="h-4 w-4" /> Driver
                            </span>
                            <Link
                                href={`/fleet/drivers/${trip.driver.id}`}
                                className="font-medium text-primary hover:underline"
                            >
                                {trip.driver.name}
                            </Link>
                        </div>
                        {trip.customer && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Customer</span>
                                    <Link
                                        href={`/customers/${trip.customer.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {trip.customer.name}
                                    </Link>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5" /> Financials
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-medium text-green-600">
                                ${trip.revenue.toLocaleString()}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Expenses</span>
                            <span className="font-medium text-red-600">
                                ${totalExpenses.toLocaleString()}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Profit</span>
                            <span
                                className={`font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                                ${profit.toLocaleString()}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {trip.cargoDescription && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="h-5 w-5" /> Cargo
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">{trip.cargoDescription}</p>
                        </CardContent>
                    </Card>
                )}

                {trip.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{trip.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid gap-6 mt-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Receipt className="h-5 w-5" /> Trip Expenses
                        </CardTitle>
                        {canEdit && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/operations/expenses/new?tripId=${trip.id}`}>Add Expense</Link>
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {trip.expenses.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No expenses recorded</p>
                        ) : (
                            <div className="space-y-3">
                                {trip.expenses.map((expense) => (
                                    <div
                                        key={expense.id}
                                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                                    >
                                        <div>
                                            <p className="font-medium">{expense.description}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {expense.category?.name || "Uncategorized"} •{" "}
                                                {format(expense.date, "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        <span className="font-medium">${expense.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Related Invoices</CardTitle>
                        {canEdit && trip.customer && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/finance/invoices/new?tripId=${trip.id}`}>Create Invoice</Link>
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {trip.invoices.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No invoices created</p>
                        ) : (
                            <div className="space-y-3">
                                {trip.invoices.map((invoice) => (
                                    <div
                                        key={invoice.id}
                                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                                    >
                                        <div>
                                            <Link
                                                href={`/finance/invoices/${invoice.id}`}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {invoice.invoiceNumber}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {format(invoice.issueDate, "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-medium">
                                                ${invoice.totalAmount.toLocaleString()}
                                            </span>
                                            <Badge variant="outline" className="ml-2">
                                                {invoice.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
