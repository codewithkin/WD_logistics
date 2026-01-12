import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, User, Gauge, FileText } from "lucide-react";
import { format } from "date-fns";
import { AssignDriver } from "./_components/assign-driver";

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
        },
    });

    if (!truck) {
        notFound();
    }

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
            />

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
