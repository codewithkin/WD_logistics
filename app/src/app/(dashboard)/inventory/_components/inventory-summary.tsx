import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, DollarSign, AlertTriangle, Package } from "lucide-react";

interface CategoryBreakdown {
    category: string;
    value: number;
    itemCount: number;
}

interface InventorySummaryProps {
    totalItems: number;
    totalValue: number | null; // null when the viewer can't see value
    lowStockCount: number;
    categoryBreakdown: CategoryBreakdown[];
}

// Cycled per category row in the breakdown so a multi-category warehouse
// doesn't render as a wall of identical green bars — brand green leads,
// blue appears once as the sparing accent, the rest are neutral supporting hues.
const CATEGORY_BAR_COLORS = [
    "linear-gradient(to right, #22c55e, #10b981)",
    "linear-gradient(to right, #3b82f6, #06b6d4)",
    "linear-gradient(to right, #f59e0b, #f97316)",
    "linear-gradient(to right, #a855f7, #ec4899)",
    "linear-gradient(to right, #14b8a6, #0ea5e9)",
];

export function InventorySummary({ totalItems, totalValue, lowStockCount, categoryBreakdown }: InventorySummaryProps) {
    const cards = [
        {
            title: "Total Items",
            value: totalItems.toString(),
            icon: Package,
            description: "distinct items tracked",
            bgGradient: "linear-gradient(to bottom right, rgba(59, 130, 246, 0.1), rgba(34, 211, 238, 0.1))",
            iconGradient: "linear-gradient(to bottom right, #3b82f6, #06b6d4)",
            textColor: "#2563eb",
        },
        ...(totalValue !== null
            ? [
                {
                    title: "Total Stock Value",
                    value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    icon: DollarSign,
                    description: "unit cost × quantity on hand",
                    bgGradient: "linear-gradient(to bottom right, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))",
                    iconGradient: "linear-gradient(to bottom right, #22c55e, #10b981)",
                    textColor: "#16a34a",
                },
            ]
            : []),
        {
            title: "Low Stock Items",
            value: lowStockCount.toString(),
            icon: AlertTriangle,
            description: lowStockCount > 0 ? "need reordering soon" : "everything is well stocked",
            bgGradient: lowStockCount > 0
                ? "linear-gradient(to bottom right, rgba(239, 68, 68, 0.1), rgba(249, 115, 22, 0.1))"
                : "linear-gradient(to bottom right, rgba(107, 114, 128, 0.1), rgba(100, 116, 139, 0.1))",
            iconGradient: lowStockCount > 0
                ? "linear-gradient(to bottom right, #ef4444, #f97316)"
                : "linear-gradient(to bottom right, #6b7280, #64748b)",
            textColor: lowStockCount > 0 ? "#dc2626" : "#4b5563",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <Card
                            key={card.title}
                            className="group hover:shadow-lg transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-2 border-none relative overflow-hidden"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
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

            {totalValue !== null && categoryBreakdown.length > 0 && (
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <div
                                className="p-1.5 rounded-md"
                                style={{ background: "linear-gradient(to bottom right, #22c55e, #10b981)" }}
                            >
                                <Boxes className="h-4 w-4 text-white" />
                            </div>
                            Value by Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {categoryBreakdown.map((cat, index) => {
                                const percentage = totalValue > 0 ? (cat.value / totalValue) * 100 : 0;
                                return (
                                    <div key={cat.category} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{cat.category}</span>
                                            <span className="text-muted-foreground">
                                                ${cat.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                {" "}({cat.itemCount} item{cat.itemCount === 1 ? "" : "s"})
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-2 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${percentage}%`,
                                                    background: CATEGORY_BAR_COLORS[index % CATEGORY_BAR_COLORS.length],
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
