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
            gradient: "from-blue-500 to-cyan-500",
            bgGradient: "from-blue-500/10 to-cyan-500/10",
            iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
            title: "Trips This Month",
            value: stats.tripsThisMonth.toString(),
            icon: Route,
            description: "scheduled & completed",
            roles: ["admin", "supervisor", "staff"] as Role[],
            gradient: "from-purple-500 to-pink-500",
            bgGradient: "from-purple-500/10 to-pink-500/10",
            iconColor: "text-purple-600 dark:text-purple-400",
        },
        {
            title: "Revenue This Month",
            value: `$${stats.revenueThisMonth.toLocaleString()}`,
            icon: DollarSign,
            description: "from completed trips",
            roles: ["admin", "supervisor"] as Role[],
            gradient: "from-green-500 to-emerald-500",
            bgGradient: "from-green-500/10 to-emerald-500/10",
            iconColor: "text-green-600 dark:text-green-400",
        },
        {
            title: "Overdue Invoices",
            value: stats.overdueInvoicesCount.toString(),
            icon: AlertTriangle,
            description: "require attention",
            roles: ["admin"] as Role[],
            variant: stats.overdueInvoicesCount > 0 ? "destructive" : "default",
            gradient: stats.overdueInvoicesCount > 0 ? "from-red-500 to-orange-500" : "from-gray-500 to-slate-500",
            bgGradient: stats.overdueInvoicesCount > 0 ? "from-red-500/10 to-orange-500/10" : "from-gray-500/10 to-slate-500/10",
            iconColor: stats.overdueInvoicesCount > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400",
        },
    ];

    const visibleCards = cards.filter((card) => card.roles.includes(role));

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
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-50 group-hover:opacity-70 transition-opacity duration-300`} />

                        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                                <Icon className="h-4 w-4 text-white" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className={`text-2xl font-bold ${card.iconColor} transition-transform duration-300 group-hover:scale-105`}>
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
