import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { getWorkshopMembers } from "../actions";
import { MaintenanceDetailActions } from "../_components/maintenance-detail-actions";
import { downtimeDaysFor } from "../_lib/history";

interface MaintenanceDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function MaintenanceDetailPage({ params }: MaintenanceDetailPageProps) {
    const session = await requireRole(["admin", "supervisor", "workshop"]);
    const { id } = await params;
    const canManage = session.role === "admin" || session.role === "supervisor";

    const request = await prisma.maintenanceRequest.findFirst({
        where: { id, organizationId: session.organizationId },
        include: {
            truck: { select: { id: true, registrationNo: true, make: true, model: true } },
            trailer: { select: { id: true, registrationNo: true, make: true, model: true } },
            reportedBy: { select: { name: true, email: true } },
            assignedTo: { select: { id: true, name: true } },
            assignedBy: { select: { name: true } },
            fixedBy: { select: { name: true } },
        },
    });

    if (!request) notFound();

    // A workshop user sees their own live jobs and nothing else — not another
    // worker's job, and not one they already closed. 404 rather than a redirect,
    // so the URL doesn't confirm the record exists.
    if (
        session.role === "workshop" &&
        (request.assignedToId !== session.user.id || request.status === "fixed")
    ) {
        notFound();
    }

    const workshopMembers = canManage ? await getWorkshopMembers() : [];
    const vehicle = request.truck ?? request.trailer;
    const isTrailer = !!request.trailer;
    const vehicleHref = request.truck
        ? `/fleet/trucks/${request.truck.id}`
        : request.trailer
          ? `/fleet/trailers/${request.trailer.id}`
          : null;

    const timeline = [
        {
            label: "Logged",
            who: request.reportedBy.name,
            at: request.createdAt,
            detail: `Scheduled for ${format(request.date, "d MMMM yyyy")}`,
        },
        ...(request.assignedAt && request.assignedTo
            ? [
                  {
                      label: "Assigned",
                      who: request.assignedTo.name,
                      at: request.assignedAt,
                      detail: request.assignedBy ? `by ${request.assignedBy.name}` : "",
                  },
              ]
            : []),
        ...(request.status === "in_progress"
            ? [{ label: "Work started", who: request.assignedTo?.name ?? "—", at: request.updatedAt, detail: "" }]
            : []),
        ...(request.fixedAt
            ? [
                  {
                      label: "Fixed",
                      who: request.fixedBy?.name ?? "—",
                      at: request.fixedAt,
                      detail: `${downtimeDaysFor(request)} days out of service`,
                  },
              ]
            : []),
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title={vehicle ? `${vehicle.registrationNo} — maintenance` : "Maintenance job"}
                description={
                    vehicle
                        ? `${isTrailer ? "Trailer" : "Truck"} · ${vehicle.make} ${vehicle.model}`
                        : "The vehicle for this job has been removed"
                }
                backHref="/maintenance"
            />

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle>Reported issue</CardTitle>
                            <StatusBadge status={request.status} type="maintenance" />
                        </div>
                        <CardDescription>
                            Logged by {request.reportedBy.name} on{" "}
                            {format(request.createdAt, "d MMMM yyyy 'at' HH:mm")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {request.notes}
                        </p>

                        <Separator />

                        <div>
                            <h3 className="mb-2 text-sm font-semibold">Work done</h3>
                            {request.fixedNotes ? (
                                <>
                                    <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                                        {request.fixedNotes}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {request.fixedBy?.name ?? "Unknown"}
                                        {request.fixedAt
                                            ? ` · ${format(request.fixedAt, "d MMMM yyyy 'at' HH:mm")}`
                                            : ""}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Not fixed yet — the workshop records what was done when they close
                                    the job.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <Row label="Vehicle">
                                {vehicle && vehicleHref ? (
                                    <Link href={vehicleHref} className="text-primary hover:underline">
                                        {vehicle.registrationNo}
                                    </Link>
                                ) : (
                                    <span className="text-muted-foreground">Removed</span>
                                )}
                            </Row>
                            <Row label="Type">{isTrailer ? "Trailer" : "Truck"}</Row>
                            <Row label="Scheduled for">{format(request.date, "d MMMM yyyy")}</Row>
                            <Row label="Assigned to">
                                {request.assignedTo?.name ?? (
                                    <span className="text-muted-foreground">Unassigned</span>
                                )}
                            </Row>
                            <Row label="Fixed by">
                                {request.fixedBy?.name ?? (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </Row>
                            <Row label="Days out of service">{downtimeDaysFor(request)}</Row>
                        </CardContent>
                    </Card>

                    <MaintenanceDetailActions
                        requestId={request.id}
                        status={request.status}
                        assignedToId={request.assignedToId}
                        currentUserId={session.user.id}
                        role={session.role}
                        workshopMembers={workshopMembers}
                        vehicleLabel={vehicle?.registrationNo ?? "this vehicle"}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">History</CardTitle>
                </CardHeader>
                <CardContent>
                    <ol className="space-y-4">
                        {timeline.map((event, index) => (
                            <li key={`${event.label}-${index}`} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                                    {index < timeline.length - 1 && (
                                        <span className="mt-1 h-full w-px flex-1 bg-border" />
                                    )}
                                </div>
                                <div className="pb-2">
                                    <p className="text-sm font-medium">
                                        {event.label} — {event.who}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(event.at, "d MMM yyyy 'at' HH:mm")}
                                        {event.detail ? ` · ${event.detail}` : ""}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </CardContent>
            </Card>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{children}</span>
        </div>
    );
}
