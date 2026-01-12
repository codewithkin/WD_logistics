import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";


interface Trip {
    id: string;
    originCity: string;
    destinationCity: string;
    status: string;
    scheduledDate: Date;
    truck: { registrationNo: string };
    driver: { firstName: string; lastName: string };
    customer: { name: string } | null;
}

interface RecentTripsProps {
    trips: Trip[];
}

export function RecentTrips({ trips }: RecentTripsProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Trips</CardTitle>
                <Link href="/operations/trips">
                    <Button variant="ghost" size="sm">
                        View All <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                {trips.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                        No trips found
                    </p>
                ) : (
                    <div className="space-y-4">
                        {trips.map((trip) => (
                            <div
                                key={trip.id}
                                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                            >
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        {trip.originCity} → {trip.destinationCity}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {trip.truck.registrationNo} • {trip.driver.firstName}{" "}
                                        {trip.driver.lastName}
                                    </p>
                                    {trip.customer && (
                                        <p className="text-xs text-muted-foreground">
                                            Customer: {trip.customer.name}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right space-y-1">
                                    <StatusBadge status={trip.status} type="trip" />
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(trip.scheduledDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
