import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, User, Calendar, Gauge, Shield, FileText } from "lucide-react";
import { format } from "date-fns";
import { TRUCK_STATUS_LABELS, TRUCK_STATUS_COLORS } from "@/lib/types";

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
                orderBy: { startDate: "desc" },
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
                            <Badge className={TRUCK_STATUS_COLORS[truck.status]}>
                                {TRUCK_STATUS_LABELS[truck.status]}
                            </Badge>
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
                                <Gauge className="h-4 w-4" /> Mileage
                            </span>
                            <span className="font-medium">{truck.mileage.toLocaleString()} km</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Assigned Driver</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {truck.assignedDriver ? (
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <User className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <Link
                                        href={`/fleet/drivers/${truck.assignedDriver.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {truck.assignedDriver.name}
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

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="h-5 w-5" /> Service & Insurance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Last Service</span>
                            <span className="font-medium">
                                {truck.lastServiceDate
                                    ? format(truck.lastServiceDate, "PPP")
                                    : "Not recorded"}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Next Service</span>
                            <span className="font-medium">
                                {truck.nextServiceDate
                                    ? format(truck.nextServiceDate, "PPP")
                                    : "Not scheduled"}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Shield className="h-4 w-4" /> Insurance Expiry
                            </span>
                            <span className="font-medium">
                                {truck.insuranceExpiry
                                    ? format(truck.insuranceExpiry, "PPP")
                                    : "Not recorded"}
                            </span>
                        </div>
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
                                            {trip.origin} → {trip.destination}
                                        </Link>
                                        <p className="text-sm text-muted-foreground">
                                            {format(trip.startDate, "PPP")} • Driver: {trip.driver.name}
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
