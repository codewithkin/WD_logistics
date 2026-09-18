import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pencil, MapPin, Truck as TruckIcon, DollarSign, Boxes, History } from "lucide-react";
import { format } from "date-fns";
import { canViewInventoryValue, canManageInventory } from "@/lib/permissions";
import { AllocatePartDialog } from "../_components/allocate-part-dialog";
import { StockActions } from "../_components/stock-actions";
import { StockMovementsTable } from "../_components/stock-movements-table";

interface InventoryItemDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function InventoryItemDetailPage({ params }: InventoryItemDetailPageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);
    const { role, organizationId } = session;

    const item = await prisma.inventoryItem.findFirst({
        where: { id, organizationId },
        include: {
            allocations: {
                orderBy: { allocatedAt: "desc" },
                include: {
                    truck: { select: { registrationNo: true, make: true, model: true } },
                    allocatedBy: { select: { firstName: true, lastName: true } },
                },
            },
            movements: {
                orderBy: { createdAt: "desc" },
                include: { performedBy: { select: { name: true } } },
            },
        },
    });

    if (!item) {
        notFound();
    }

    const canSeeValue = canViewInventoryValue(role);
    const canManage = canManageInventory(role);
    const isLowStock = item.quantity <= item.minQuantity;
    const totalValue = (item.unitCost ?? 0) * item.quantity;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    const [trucks, employees] = canManage
        ? await Promise.all([
            prisma.truck.findMany({
                where: { organizationId },
                select: { id: true, registrationNo: true, make: true, model: true },
                orderBy: { registrationNo: "asc" },
            }),
            prisma.employee.findMany({
                where: { organizationId },
                select: { id: true, firstName: true, lastName: true },
                orderBy: { firstName: "asc" },
            }),
        ])
        : [[], []];

    return (
        <div className="space-y-6">
            <PageHeader
                title={item.name}
                description="Stock levels and a full record of what came in and went out"
                backHref="/inventory"
                action={
                    canManage
                        ? { label: "Edit Item", href: `/inventory/${item.id}/edit`, icon: Pencil }
                        : undefined
                }
            >
                {canManage && (
                    <StockActions
                        item={{ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit, unitCost: item.unitCost }}
                        showValue={canSeeValue}
                    />
                )}
            </PageHeader>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Boxes className="h-5 w-5" /> Item Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            {isLowStock ? (
                                <Badge variant="destructive">Low Stock</Badge>
                            ) : (
                                <Badge variant="secondary">In Stock</Badge>
                            )}
                        </div>
                        {item.sku && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">SKU</span>
                                    <span className="font-medium">{item.sku}</span>
                                </div>
                            </>
                        )}
                        {item.category && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Category</span>
                                    <span className="font-medium">{item.category}</span>
                                </div>
                            </>
                        )}
                        {item.location && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <MapPin className="h-4 w-4" /> Location
                                    </span>
                                    <span className="font-medium">{item.location}</span>
                                </div>
                            </>
                        )}
                        {item.supplier && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Supplier</span>
                                    <span className="font-medium">{item.supplier}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5" /> Stock Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Quantity in Stock</span>
                            <span className="font-medium">
                                {item.quantity} {item.unit || ""}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Low Stock Threshold</span>
                            <span className="font-medium">
                                {item.minQuantity} {item.unit || ""}
                            </span>
                        </div>
                        {canSeeValue && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Unit Cost</span>
                                    <span className="font-medium">
                                        {item.unitCost != null ? formatCurrency(item.unitCost) : "-"}
                                    </span>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground font-medium">Total Value</span>
                                    <span className="font-bold text-lg">{formatCurrency(totalValue)}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {item.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5" /> Stock History
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Every time stock came in or went out — when, where, why, and who recorded it.
                    </p>
                </CardHeader>
                <CardContent>
                    <StockMovementsTable
                        movements={item.movements.map((m) => ({
                            ...m,
                            inventoryItem: { id: item.id, name: item.name, unit: item.unit, unitCost: item.unitCost },
                        }))}
                        showValue={canSeeValue}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TruckIcon className="h-5 w-5" /> Allocation History
                    </CardTitle>
                    {canManage && (
                        <AllocatePartDialog
                            inventoryItemId={item.id}
                            availableQuantity={item.quantity}
                            unit={item.unit}
                            unitCost={item.unitCost}
                            showValue={canSeeValue}
                            trucks={trucks}
                            employees={employees}
                        />
                    )}
                </CardHeader>
                <CardContent>
                    {item.allocations.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No allocations recorded for this item
                        </p>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Truck</TableHead>
                                        <TableHead>Allocated By</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead>Reason</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {item.allocations.map((allocation) => (
                                        <TableRow key={allocation.id}>
                                            <TableCell>
                                                {format(new Date(allocation.allocatedAt), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                {allocation.truck.registrationNo} - {allocation.truck.make}{" "}
                                                {allocation.truck.model}
                                            </TableCell>
                                            <TableCell>
                                                {allocation.allocatedBy.firstName} {allocation.allocatedBy.lastName}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {allocation.quantity} {item.unit || ""}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {allocation.reason || "-"}
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
    );
}
