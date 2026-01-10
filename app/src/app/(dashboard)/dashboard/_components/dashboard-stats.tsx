import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Route, DollarSign, ClipboardEdit, AlertTriangle } from "lucide-react";
import { Role } from "@/lib/types";

interface DashboardStatsProps {
    stats: {
        activeTrucks: number;
        totalTrucks: number;
        tripsThisMonth: number;
        revenueThisMonth: number;
        pendingEditRequests: number;
        overdueInvoicesCount: number;
    };
    role: Role;
}

export function DashboardStats({ stats, role }: DashboardStatsProps) {
    const cards = [
        {
            title: "Active Trucks",
            value: `${stats.activeTrucks}/${stats.totalTrucks}`,
            icon: Truck,
            description: "trucks in operation",
            roles: ["admin", "supervisor", "staff"] as Role[],
        },
        {
            title: "Trips This Month",
            value: stats.tripsThisMonth.toString(),
            icon: Route,
            description: "scheduled & completed",
            roles: ["admin", "supervisor", "staff"] as Role[],
        },
        {
            title: "Revenue This Month",
            value: `$${stats.revenueThisMonth.toLocaleString()}`,
            icon: DollarSign,
            description: "from completed trips",
            roles: ["admin", "supervisor"] as Role[],
        },
        {
            title: "Pending Requests",
            value: stats.pendingEditRequests.toString(),
            icon: ClipboardEdit,
            description: "awaiting approval",
            roles: ["admin", "supervisor"] as Role[],
        },
        {
            title: "Overdue Invoices",
            value: stats.overdueInvoicesCount.toString(),
            icon: AlertTriangle,
            description: "require attention",
            roles: ["admin"] as Role[],
            variant: stats.overdueInvoicesCount > 0 ? "destructive" : "default",
        },
    ];

    const visibleCards = cards.filter((card) => card.roles.includes(role));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleCards.map((card) => {
                const Icon = card.icon;
                return (
                    <Card key={card.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <Icon className={`h-4 w-4 ${card.variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${card.variant === "destructive" ? "text-destructive" : ""}`}>
                                {card.value}
                            </div>
                            <p className="text-xs text-muted-foreground">{card.description}</p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
