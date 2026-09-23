import Link from "next/link";
import { startOfDayInHarare } from "../_lib/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock, Wrench } from "lucide-react";
import { format } from "date-fns";

interface TaskRequest {
    id: string;
    notes: string;
    date: Date;
    status: string;
    truck: { registrationNo: string } | null;
    trailer: { registrationNo: string } | null;
}

function vehicleName(request: TaskRequest): string {
    if (request.truck) return request.truck.registrationNo;
    if (request.trailer) return `${request.trailer.registrationNo} (trailer)`;
    return "Vehicle removed";
}

export function WorkshopTaskCards({ requests }: { requests: TaskRequest[] }) {
    const now = new Date();
    const todayStart = startOfDayInHarare(now);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const overdue = requests.filter((r) => r.date < todayStart);
    const today = requests.filter((r) => r.date >= todayStart && r.date < tomorrowStart);
    const upcoming = requests.filter((r) => r.date >= tomorrowStart);

    const groups = [
        {
            key: "today",
            title: "Today",
            icon: Wrench,
            items: today,
            tone: "text-primary",
            empty: "Nothing scheduled for today.",
        },
        {
            key: "overdue",
            title: "Overdue",
            icon: AlertTriangle,
            items: overdue,
            tone: "text-destructive",
            empty: "Nothing overdue — good.",
        },
        {
            key: "upcoming",
            title: "Coming up",
            icon: CalendarClock,
            items: upcoming,
            tone: "text-muted-foreground",
            empty: "Nothing booked in yet.",
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {groups.map((group) => {
                const Icon = group.icon;
                return (
                    <Card key={group.key}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Icon className={`h-4 w-4 ${group.tone}`} />
                                {group.title}
                            </CardTitle>
                            <Badge variant={group.items.length ? "default" : "outline"}>
                                {group.items.length}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {group.items.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{group.empty}</p>
                            ) : (
                                group.items.slice(0, 5).map((request) => (
                                    <Link
                                        key={request.id}
                                        href={`/maintenance/${request.id}`}
                                        className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium">{vehicleName(request)}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {format(request.date, "d MMM")}
                                            </span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                            {request.notes}
                                        </p>
                                    </Link>
                                ))
                            )}
                            {group.items.length > 5 && (
                                <p className="text-xs text-muted-foreground">
                                    +{group.items.length - 5} more in the table below
                                </p>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
