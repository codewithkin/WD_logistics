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
import { Pencil, User, Gauge, FileText, DollarSign, TrendingUp, TrendingDown, Download } from "lucide-react";
import { format } from "date-fns";
import { AssignDriver } from "./_components/assign-driver";
import { ExportTruckButton } from "./_components/export-truck-button";

interface TruckDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function TruckDetailPage({ params }: TruckDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const truck = await prisma.truck.findFirst({
        where: { id, organizationId },
        include: {
            assignedDriver: true,
            trips: {
                orderBy: { scheduledDate: "desc" },
                take: 5,
                include: {
                    driver: true,
                },
            },
            truckExpenses: {
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

    // Calculate financials
    const allTrips = await prisma.trip.findMany({
        where: { truckId: id },
        select: { revenue: true },
    });
    const totalRevenue = allTrips.reduce((sum, t) => sum + t.revenue, 0);
    const totalExpenses = truck.truckExpenses.reduce((sum, te) => sum + te.expense.amount, 0);
    const profitLoss = totalRevenue - totalExpenses;

    const canEdit = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title={truck.registrationNo}
                description={`${truck.make} ${truck.model} (${truck.year})`}
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

            {/* Financial Summary */}
            <div className="grid gap-6 md:grid-cols-3 mt-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" /> Total Revenue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{allTrips.length} trips</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-600" /> Total Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{truck.truckExpenses.length} expenses</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <DollarSign className={`h-4 w-4 ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`} /> Profit/Loss
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {profitLoss >= 0 ? "+" : ""}${profitLoss.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {totalRevenue > 0 ? ((profitLoss / totalRevenue) * 100).toFixed(1) : 0}% margin
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Trips</CardTitle>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/operations/trips?truckId=${truck.id}`}>View All</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {truck.trips.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No trips recorded</p>
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
