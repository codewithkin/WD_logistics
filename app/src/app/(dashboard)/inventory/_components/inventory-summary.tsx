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

export function InventorySummary({ totalItems, totalValue, lowStockCount, categoryBreakdown }: InventorySummaryProps) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                    </CardContent>
                </Card>

                {totalValue !== null && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                        <AlertTriangle className={lowStockCount > 0 ? "h-4 w-4 text-destructive" : "h-4 w-4 text-muted-foreground"} />
                    </CardHeader>
                    <CardContent>
                        <div className={lowStockCount > 0 ? "text-2xl font-bold text-destructive" : "text-2xl font-bold"}>
                            {lowStockCount}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {totalValue !== null && categoryBreakdown.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Boxes className="h-4 w-4" />
                            Value by Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {categoryBreakdown.map((cat) => {
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
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
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
