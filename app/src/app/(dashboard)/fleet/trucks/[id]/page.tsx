import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, User, Gauge, FileText, DollarSign, TrendingUp, TrendingDown, Download, Calendar } from "lucide-react";
import { format } from "date-fns";
import { AssignDriver } from "./_components/assign-driver";
import { ExportTruckButton } from "./_components/export-truck-button";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { formatCurrency } from "@/lib/utils";

interface TruckDetailPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function TruckDetailPage({ params, searchParams }: TruckDetailPageProps) {
    const { id } = await params;
    const searchParamsData = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(searchParamsData, "3m");

    const truck = await prisma.truck.findFirst({
        where: { id, organizationId },
        include: {
            assignedDriver: true,
            trips: {
                where: {
                    scheduledDate: {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    },
                },
                orderBy: { scheduledDate: "desc" },
                take: 10,
                include: {
                    driver: true,
                },
            },
            truckExpenses: {
                where: {
                    expense: {
                        date: {
                            gte: dateRange.from,
                            lte: dateRange.to,
                        },
                    },
                },
                include: {
                    expense: {
                        include: {
                            category: true,
                        },
                    },
                },
            },
        },
    });

    if (!truck) {
        notFound();
    }

    // Calculate financials for the selected period
    const tripsInPeriod = await prisma.trip.findMany({
        where: {
            truckId: id,
            scheduledDate: {
                gte: dateRange.from,
                lte: dateRange.to,
            },
        },
        select: { revenue: true, status: true },
    });

    const totalRevenue = tripsInPeriod.reduce((sum, t) => sum + t.revenue, 0);
    const totalTrips = tripsInPeriod.length;
    const completedTrips = tripsInPeriod.filter(t => t.status === "completed").length;
    const totalExpenses = truck.truckExpenses.reduce((sum, te) => sum + te.expense.amount, 0);
    const profitLoss = totalRevenue - totalExpenses;

    const canEdit = role === "admin" || role === "supervisor";

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <PageHeader
                    title={truck.registrationNo}
                    description={`${truck.make} ${truck.model} (${truck.year}) - ${dateRange.label}`}
                    backHref="/fleet/trucks"
                    action={
                        canEdit
                            ? {
                                label: "Edit Truck",
                                href: `/fleet/trucks/${truck.id}/edit`,
                                icon: Pencil,
                            }
                            : undefined
                    }
                >
                    <ExportTruckButton
                        truckId={truck.id}
                        truckName={truck.registrationNo}
                    />
                </PageHeader>
                <PagePeriodSelector defaultPreset="3m" />
            </div>

            {/* Financial Summary for Selected Period */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Total Trips
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{totalTrips}</p>
                        <p className="text-xs text-muted-foreground">{completedTrips} completed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" /> Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            {profitLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            Profit/Loss
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(profitLoss)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Truck Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <StatusBadge status={truck.status} type="truck" />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Registration No.</span>
                            <span className="font-medium">{truck.registrationNo}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Make / Model</span>
                            <span className="font-medium">
                                {truck.make} {truck.model}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Year</span>
                            <span className="font-medium">{truck.year}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Gauge className="h-4 w-4" /> Current Mileage
                            </span>
                            <span className="font-medium">{truck.currentMileage.toLocaleString()} km</span>
                        </div>
                        {truck.fuelType && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Fuel Type</span>
                                    <span className="font-medium">{truck.fuelType}</span>
                                </div>
                            </>
                        )}
                        {truck.tankCapacity && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Tank Capacity</span>
                                    <span className="font-medium">{truck.tankCapacity} L</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5" /> Assigned Driver
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canEdit ? (
                            <AssignDriver
                                truckId={truck.id}
                                currentDriverId={truck.assignedDriver?.id ?? null}
                                currentDriverName={
                                    truck.assignedDriver
                                        ? `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}`
                                        : null
                                }
                            />
                        ) : truck.assignedDriver ? (
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <User className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <Link
                                        href={`/fleet/drivers/${truck.assignedDriver.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {truck.assignedDriver.firstName} {truck.assignedDriver.lastName}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                        {truck.assignedDriver.phone}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No driver assigned</p>
                        )}
                    </CardContent>
                </Card>

                {truck.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{truck.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Trips ({dateRange.label})</CardTitle>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/operations/trips?truckId=${truck.id}`}>View All</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {truck.trips.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No trips recorded in this period</p>
                    ) : (
                        <div className="space-y-4">
                            {truck.trips.map((trip) => (
                                <div
                                    key={trip.id}
                                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                                >
                                    <div>
                                        <Link
                                            href={`/operations/trips/${trip.id}`}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {trip.originCity} → {trip.destinationCity}
                                        </Link>
                                        <p className="text-sm text-muted-foreground">
                                            {format(trip.scheduledDate, "PPP")} • Driver: {trip.driver.firstName} {trip.driver.lastName}
                                        </p>
                                    </div>
                                    <Badge variant="outline">{trip.status}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
