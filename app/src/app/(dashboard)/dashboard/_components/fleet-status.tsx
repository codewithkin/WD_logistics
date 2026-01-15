import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FleetStatusProps {
    fleetStatus: {
        active: number;
        inService: number;
        inRepair: number;
        inactive: number;
    };
}

export function FleetStatus({ fleetStatus }: FleetStatusProps) {
    const total =
        fleetStatus.active +
        fleetStatus.inService +
        fleetStatus.inRepair +
        fleetStatus.inactive;

    const statusItems = [
        { label: "Active", value: fleetStatus.active, bgClass: "bg-green-500", color: "#22c55e" },
        { label: "In Service", value: fleetStatus.inService, bgClass: "bg-blue-500", color: "#3b82f6" },
        { label: "In Repair", value: fleetStatus.inRepair, bgClass: "bg-yellow-500", color: "#eab308" },
        { label: "Inactive", value: fleetStatus.inactive, bgClass: "bg-gray-400", color: "#9ca3af" },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Fleet Status</CardTitle>
            </CardHeader>
            <CardContent>
                {total === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                        No trucks registered
                    </p>
                ) : (
                    <div className="space-y-4">
                        {/* Progress Bar */}
                        <div className="h-4 flex rounded-full overflow-hidden">
                            {statusItems.map((item) =>
                                item.value > 0 ? (
                                    <div
                                        key={item.label}
                                        className={item.bgClass}
                                        style={{ width: `${(item.value / total) * 100}%` }}
                                    />
                                ) : null
                            )}
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-2 gap-2">
                            {statusItems.map((item) => (
                                <div key={item.label} className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-sm">
                                        {item.label}: {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
