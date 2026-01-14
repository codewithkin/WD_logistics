import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
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
    CreditCard,
    Clock,
    CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { NotifyDriverButton } from "./_components/notify-driver-button";
import { TripProfitLossTable } from "./_components/trip-profit-loss-table";
import { TripRevenueExpenseChart } from "./_components/trip-revenue-expense-chart";

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
            tripExpenses: {
                include: {
                    expense: {
                        include: {
                            category: true,
                        },
                    },
                },
            },
            invoices: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    total: true,
                    amountPaid: true,
                    balance: true,
                    status: true,
                    isCredit: true,
                    dueDate: true,
                },
            },
        },
    });

    if (!trip) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";
    const totalExpenses = trip.tripExpenses.reduce((sum, te) => sum + te.expense.amount, 0);

    // Calculate invoice-based metrics
    const tripInvoice = trip.invoices[0]; // Main invoice for this trip
    const invoiceTotal = tripInvoice?.total || 0;
    const invoicePaid = tripInvoice?.amountPaid || 0;
    const invoiceBalance = tripInvoice?.balance || 0;
    const isInvoicePaid = tripInvoice?.status === "paid";
    const isCredit = tripInvoice?.isCredit || false;

    // Gross Profit = Revenue - Expenses (regardless of payment status)
    const grossProfit = trip.revenue - totalExpenses;

    // Net Profit = Only counted when invoice is paid
    const netProfit = isInvoicePaid ? grossProfit : 0;

    // Pending Revenue = Invoice balance that hasn't been paid yet
    const pendingRevenue = isCredit && !isInvoicePaid ? invoiceBalance : 0;

    return (
        <div>
            <PageHeader
                title={`${trip.originCity} → ${trip.destinationCity}`}
                description={`Trip scheduled for ${format(trip.scheduledDate, "PPP")}`}
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
                            <StatusBadge status={trip.status} type="trip" />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Origin</span>
                            <span className="font-medium">{trip.originCity}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Destination</span>
                            <span className="font-medium">{trip.destinationCity}</span>
                        </div>
                        {trip.estimatedMileage && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Estimated Mileage</span>
                                    <span className="font-medium">{trip.estimatedMileage.toLocaleString()} km</span>
                                </div>
                            </>
                        )}
                        {trip.actualMileage && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Actual Mileage</span>
                                    <span className="font-medium">{trip.actualMileage.toLocaleString()} km</span>
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
                            <span className="text-muted-foreground">Scheduled Date</span>
                            <span className="font-medium">{format(trip.scheduledDate, "PPP")}</span>
                        </div>
                        {trip.startDate && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Start Date</span>
                                    <span className="font-medium">{format(trip.startDate, "PPP")}</span>
                                </div>
                            </>
                        )}
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">End Date</span>
                            <span className="font-medium">
                                {trip.endDate ? format(trip.endDate, "PPP") : "Not Completed"}
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
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/fleet/drivers/${trip.driver.id}`}
                                    className="font-medium text-primary hover:underline"
                                >
                                    {trip.driver.firstName} {trip.driver.lastName}
                                </Link>
                                <NotifyDriverButton
                                    tripId={trip.id}
                                    driverName={`${trip.driver.firstName} ${trip.driver.lastName}`}
                                    driverPhone={trip.driver.whatsappNumber || trip.driver.phone}
                                    alreadyNotified={trip.driverNotified}
                                />
                            </div>
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
                            <span className="text-muted-foreground">Gross Profit</span>
                            <span
                                className={`font-bold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                                ${grossProfit.toLocaleString()}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                                {isInvoicePaid ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Clock className="h-4 w-4 text-amber-500" />
                                )}
                                Net Profit
                            </span>
                            <span
                                className={`font-bold ${isInvoicePaid
                                    ? netProfit >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    : "text-muted-foreground"
                                    }`}
                            >
                                {isInvoicePaid ? `$${netProfit.toLocaleString()}` : "Awaiting Payment"}
                            </span>
                        </div>
                        {pendingRevenue > 0 && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <CreditCard className="h-4 w-4 text-amber-500" />
                                        Pending (Credit)
                                    </span>
                                    <span className="font-medium text-amber-600">
                                        ${pendingRevenue.toLocaleString()}
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {trip.loadDescription && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="h-5 w-5" /> Load Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">{trip.loadDescription}</p>
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
                {/* Revenue vs Expenses Pie Chart */}
                <TripRevenueExpenseChart
                    revenue={trip.revenue}
                    expenses={totalExpenses}
                />

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
                        {trip.tripExpenses.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No expenses recorded</p>
                        ) : (
                            <div className="space-y-3">
                                {trip.tripExpenses.map((te) => (
                                    <div
                                        key={te.id}
                                        className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                                    >
                                        <div>
                                            <p className="font-medium">{te.expense.description}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {te.expense.category?.name || "Uncategorized"} •{" "}
                                                {format(te.expense.date, "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        <span className="font-medium">${te.expense.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {trip.customer && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Trip Invoice</CardTitle>
                            {canEdit && !tripInvoice && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/finance/invoices/new?customerId=${trip.customerId}&tripId=${trip.id}&amount=${trip.revenue}`}>Create Invoice</Link>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {tripInvoice ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Link
                                            href={`/finance/invoices/${tripInvoice.id}`}
                                            className="text-primary hover:underline font-medium"
                                        >
                                            {tripInvoice.invoiceNumber}
                                        </Link>
                                        <div className="flex items-center gap-2">
                                            {tripInvoice.isCredit && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                                    Credit
                                                </span>
                                            )}
                                            <StatusBadge status={tripInvoice.status} type="invoice" />
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Total</span>
                                        <span className="font-medium">${tripInvoice.total.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Paid</span>
                                        <span className="font-medium text-green-600">${tripInvoice.amountPaid.toLocaleString()}</span>
                                    </div>
                                    {tripInvoice.balance > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Balance</span>
                                            <span className="font-medium text-amber-600">${tripInvoice.balance.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {tripInvoice.dueDate && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Due Date</span>
                                            <span className="font-medium">{format(tripInvoice.dueDate, "MMM d, yyyy")}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-4">
                                    No invoice created for this trip yet
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Profit & Loss Table */}
            <TripProfitLossTable
                tripId={trip.id}
                tripName={`${trip.originCity} → ${trip.destinationCity}`}
                revenue={trip.revenue}
                expenses={trip.tripExpenses}
                invoice={tripInvoice ? {
                    id: tripInvoice.id,
                    invoiceNumber: tripInvoice.invoiceNumber,
                    total: tripInvoice.total,
                    amountPaid: tripInvoice.amountPaid,
                    balance: tripInvoice.balance,
                    status: tripInvoice.status,
                    isCredit: tripInvoice.isCredit,
                } : null}
            />
        </div>
    );
}
