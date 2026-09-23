import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Wrench } from "lucide-react";
import { downtimeDaysFor } from "@/app/(dashboard)/maintenance/_lib/history";

interface MaintenanceRow {
    id: string;
    notes: string;
    date: Date;
    status: string;
    fixedAt: Date | null;
    fixedNotes: string | null;
    assignedTo: { name: string } | null;
    fixedBy: { name: string } | null;
}

/**
 * Repair history for one vehicle: how often it comes in, how long it's off
 * the road, and what was actually done each time. Sits next to the revenue
 * and expense cards because "in the workshop" is one of the two ways a truck
 * stops paying for itself.
 *
 * Shared by the truck and trailer detail pages — maintenance can be raised
 * against either, so both deserve the same history.
 */
export function VehicleMaintenanceHistory({
    requests,
    periodLabel,
    vehicleLabel = "truck",
}: {
    requests: MaintenanceRow[];
    periodLabel: string;
    /** Named in the empty state, e.g. "trailer". */
    vehicleLabel?: string;
}) {
    const open = requests.filter((r) => r.status !== "fixed").length;
    const downtime =
        Math.round(requests.reduce((sum, r) => sum + downtimeDaysFor(r), 0) * 10) / 10;

    return (
        <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Wrench className="h-5 w-5" /> Maintenance history ({periodLabel})
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/maintenance">Open workshop</Link>
                </Button>
            </CardHeader>
            <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-4">
                    <Stat label="Jobs" value={requests.length} />
                    <Stat label="Still open" value={open} />
                    <Stat label="Days out of service" value={downtime} />
                </div>

                {requests.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">
                        No maintenance logged for this {vehicleLabel} in this period.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="border-b pb-4 last:border-0 last:pb-0"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Link
                                        href={`/maintenance/${request.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {format(request.date, "PPP")}
                                    </Link>
                                    <StatusBadge status={request.status} type="maintenance" />
                                </div>
                                <p className="mt-1 text-sm">{request.notes}</p>
                                {request.fixedNotes ? (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        <span className="font-medium">Work done:</span>{" "}
                                        {request.fixedNotes}
                                        {request.fixedBy ? ` — ${request.fixedBy.name}` : ""}
                                    </p>
                                ) : (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {request.assignedTo
                                            ? `Assigned to ${request.assignedTo.name}`
                                            : "Not assigned yet"}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}
