import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Truck, Calendar, Phone, Mail, FileText } from "lucide-react";
import { format } from "date-fns";
import { AssignTruck } from "./_components/assign-truck";

interface DriverDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function DriverDetailPage({ params }: DriverDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const driver = await prisma.driver.findFirst({
        where: { id, organizationId },
        include: {
            assignedTruck: true,
            trips: {
                orderBy: { scheduledDate: "desc" },
                take: 5,
                include: {
                    truck: true,
                },
            },
        },
    });

    if (!driver) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title={`${driver.firstName} ${driver.lastName}`}
                description="Driver details"
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
            />

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
                            <Calendar className="h-5 w-5" /> License Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">License Number</span>
                            <span className="font-medium">{driver.licenseNumber}</span>
                        </div>
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
