import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Package, AlertTriangle, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface InventoryItemDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function InventoryItemDetailPage({
    params,
}: InventoryItemDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const item = await prisma.inventoryItem.findFirst({
        where: { id, organizationId },
        include: {
            allocations: {
                include: {
                    trip: {
                        select: {
                            id: true,
                            origin: true,
                            destination: true,
                        },
                    },
                    truck: {
                        select: {
                            id: true,
                            plateNumber: true,
                        },
                    },
                },
                orderBy: { allocatedAt: "desc" },
                take: 20,
            },
        },
    });

    if (!item) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";
    const isLowStock = item.quantity <= item.minQuantity;
    const totalValue = item.quantity * item.costPerUnit;

    const activeAllocations = item.allocations.filter((a) => !a.returnedAt);
    const allocatedQuantity = activeAllocations.reduce((sum, a) => sum + a.quantity, 0);

    return (
        <div>
            <PageHeader
                title={item.name}
                description={item.sku ? `SKU: ${item.sku}` : "Inventory Item"}
                backHref="/inventory"
                action={
                    canEdit
                        ? {
                            label: "Edit Item",
                            href: `/inventory/${item.id}/edit`,
                        }
                        : undefined
                }
            />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Available Stock</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${isLowStock ? "text-amber-600" : ""}`}>
                                {item.quantity}
                            </span>
                            <span className="text-muted-foreground">{item.unit}</span>
                            {isLowStock && (
                                <Badge variant="outline" className="text-amber-600 ml-2">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Low Stock
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Minimum: {item.minQuantity} {item.unit}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Allocated</CardTitle>
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{allocatedQuantity}</div>
                        <p className="text-xs text-muted-foreground">
                            {activeAllocations.length} active allocation(s)
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cost Per Unit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${item.costPerUnit.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">per {item.unit}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">available stock</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Item Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {item.description && (
                            <div>
                                <p className="text-sm text-muted-foreground">Description</p>
                                <p className="font-medium">{item.description}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">SKU</p>
                                <p className="font-medium">{item.sku || "—"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Unit</p>
                                <p className="font-medium">{item.unit}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Allocation History</CardTitle>
                        {canEdit && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/inventory/${item.id}/allocate`}>Allocate</Link>
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {item.allocations.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">
                                No allocations yet
                            </p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>To</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {item.allocations.map((allocation) => (
                                            <TableRow key={allocation.id}>
                                                <TableCell>
                                                    {format(allocation.allocatedAt, "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell>
                                                    {allocation.trip ? (
                                                        <Link
                                                            href={`/operations/trips/${allocation.trip.id}`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            {allocation.trip.origin} → {allocation.trip.destination}
                                                        </Link>
                                                    ) : allocation.truck ? (
                                                        <Link
                                                            href={`/fleet/trucks/${allocation.truck.id}`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            {allocation.truck.plateNumber}
                                                        </Link>
                                                    ) : (
                                                        "General"
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {allocation.quantity}
                                                </TableCell>
                                                <TableCell>
                                                    {allocation.returnedAt ? (
                                                        <Badge variant="secondary">Returned</Badge>
                                                    ) : (
                                                        <Badge>Active</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
