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
import { Pencil, Truck, Calendar, Phone, Mail, FileText, CreditCard, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { AssignTruck } from "./_components/assign-truck";
import { ExportDriverButton } from "./_components/export-driver-button";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { formatCurrency } from "@/lib/utils";

interface DriverDetailPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function DriverDetailPage({ params, searchParams }: DriverDetailPageProps) {
    const { id } = await params;
    const searchParamsData = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(searchParamsData, "3m");

    const driver = await prisma.driver.findFirst({
        where: { id, organizationId },
        include: {
            assignedTruck: true,
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
                    truck: true,
                },
            },
        },
    });

    if (!driver) {
        notFound();
    }

    // Calculate driver performance metrics for the selected period
    const allTripsInPeriod = await prisma.trip.findMany({
        where: {
            driverId: id,
            organizationId,
            scheduledDate: {
                gte: dateRange.from,
                lte: dateRange.to,
            },
        },
        select: {
            revenue: true,
            status: true,
        },
    });

    const totalTrips = allTripsInPeriod.length;
    const completedTrips = allTripsInPeriod.filter(t => t.status === "completed").length;
    const totalRevenue = allTripsInPeriod.reduce((sum, t) => sum + t.revenue, 0);

    const canEdit = role === "admin" || role === "supervisor";

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <PageHeader
                    title={`${driver.firstName} ${driver.lastName}`}
                    description={`Driver details - ${dateRange.label}`}
                    backHref="/fleet/drivers"
                    action={
                        canEdit
                            ? {
                                label: "Edit Driver",
                                href: `/fleet/drivers/${driver.id}/edit`,
                                icon: Pencil,
                            }
                            : undefined
                    }
                >
                    <ExportDriverButton
                        driverId={driver.id}
                        driverName={`${driver.firstName} ${driver.lastName}`}
                    />
                </PageHeader>
                <PagePeriodSelector defaultPreset="3m" />
            </div>

            {/* Performance Metrics for Selected Period */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
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
                            <DollarSign className="h-4 w-4" /> Revenue Generated
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Completion Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Driver Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <StatusBadge status={driver.status} type="driver" />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Phone className="h-4 w-4" /> Phone
                            </span>
                            <span className="font-medium">{driver.phone}</span>
                        </div>
                        {driver.email && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Mail className="h-4 w-4" /> Email
                                    </span>
                                    <span className="font-medium">{driver.email}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="h-5 w-5" /> Assigned Truck
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canEdit ? (
                            <AssignTruck
                                driverId={driver.id}
                                currentTruckId={driver.assignedTruck?.id ?? null}
                                currentTruckName={driver.assignedTruck?.registrationNo ?? null}
                            />
                        ) : driver.assignedTruck ? (
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <Truck className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <Link
                                        href={`/fleet/trucks/${driver.assignedTruck.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {driver.assignedTruck.registrationNo}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                        {driver.assignedTruck.make} {driver.assignedTruck.model}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No truck assigned</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5" /> License & Documents
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">License Number</span>
                            <span className="font-medium">{driver.licenseNumber}</span>
                        </div>
                        {driver.licenseExpiration && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">License Expiration</span>
                                    <span className="font-medium">{format(driver.licenseExpiration, "PPP")}</span>
                                </div>
                            </>
                        )}
                        {driver.passportNumber && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Passport Number</span>
                                    <span className="font-medium">{driver.passportNumber}</span>
                                </div>
                            </>
                        )}
                        {driver.passportExpiration && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Passport Expiration</span>
                                    <span className="font-medium">{format(driver.passportExpiration, "PPP")}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {driver.notes && (
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{driver.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Trips</CardTitle>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/operations/trips?driverId=${driver.id}`}>View All</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {driver.trips.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No trips recorded</p>
                    ) : (
                        <div className="space-y-4">
                            {driver.trips.map((trip) => (
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
                                            {format(trip.scheduledDate, "PPP")} • Truck: {trip.truck.registrationNo}
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
