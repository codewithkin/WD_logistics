import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Route, DollarSign, AlertTriangle } from "lucide-react";
import { Role } from "@/lib/types";

interface DashboardStatsProps {
    stats: {
        activeTrucks: number;
        totalTrucks: number;
        tripsThisMonth: number;
        revenueThisMonth: number;
        overdueInvoicesCount: number;
        periodLabel: string;
    };
    role: Role;
}

export function DashboardStats({ stats, role }: DashboardStatsProps) {
    const periodLabel = stats.periodLabel || "This Period";
    
    const cardStyles = [
        {
            title: "Active Trucks",
            value: `${stats.activeTrucks}/${stats.totalTrucks}`,
            icon: Truck,
            description: "trucks in operation",
            roles: ["admin", "supervisor", "staff"] as Role[],
            bgGradient: "linear-gradient(to bottom right, rgba(59, 130, 246, 0.1), rgba(34, 211, 238, 0.1))",
            iconGradient: "linear-gradient(to bottom right, #3b82f6, #06b6d4)",
            textColor: "#2563eb",
        },
        {
            title: `Trips (${periodLabel})`,
            value: stats.tripsThisMonth.toString(),
            icon: Route,
            description: "scheduled & completed",
            roles: ["admin", "supervisor", "staff"] as Role[],
            bgGradient: "linear-gradient(to bottom right, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))",
            iconGradient: "linear-gradient(to bottom right, #a855f7, #ec4899)",
            textColor: "#9333ea",
        },
        {
            title: `Revenue (${periodLabel})`,
            value: `$${stats.revenueThisMonth.toLocaleString()}`,
            icon: DollarSign,
            description: "from completed trips",
            roles: ["admin", "supervisor"] as Role[],
            bgGradient: "linear-gradient(to bottom right, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))",
            iconGradient: "linear-gradient(to bottom right, #22c55e, #10b981)",
            textColor: "#16a34a",
        },
        {
            title: "Overdue Invoices",
            value: stats.overdueInvoicesCount.toString(),
            icon: AlertTriangle,
            description: "require attention",
            roles: ["admin"] as Role[],
            bgGradient: stats.overdueInvoicesCount > 0
                ? "linear-gradient(to bottom right, rgba(239, 68, 68, 0.1), rgba(249, 115, 22, 0.1))"
                : "linear-gradient(to bottom right, rgba(107, 114, 128, 0.1), rgba(100, 116, 139, 0.1))",
            iconGradient: stats.overdueInvoicesCount > 0
                ? "linear-gradient(to bottom right, #ef4444, #f97316)"
                : "linear-gradient(to bottom right, #6b7280, #64748b)",
            textColor: stats.overdueInvoicesCount > 0 ? "#dc2626" : "#4b5563",
        },
    ];

    const visibleCards = cardStyles.filter((card) => card.roles.includes(role));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleCards.map((card, index) => {
                const Icon = card.icon;
                return (
                    <Card
                        key={card.title}
                        className="group hover:shadow-lg transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-2 border-none relative overflow-hidden"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        {/* Background gradient */}
                        <div
                            className="absolute inset-0 opacity-50 group-hover:opacity-70 transition-opacity duration-300"
                            style={{ background: card.bgGradient }}
                        />

                        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <div
                                className="p-2 rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-110"
                                style={{ background: card.iconGradient }}
                            >
                                <Icon className="h-4 w-4 text-white" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div
                                className="text-2xl font-bold transition-transform duration-300 group-hover:scale-105"
                                style={{ color: card.textColor }}
                            >
                                {card.value}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
