"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { MoreHorizontal, Eye, Pencil, Trash2, Search, PackageMinus, PackagePlus } from "lucide-react";
import { Role } from "@/lib/types";
import { deleteInventoryItem } from "../actions";
import { toast } from "sonner";
import { StockMovementDialog, type StockDialogMode } from "./stock-movement-dialog";

interface InventoryItem {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    unit: string | null;
    quantity: number;
    minQuantity: number;
    unitCost: number | null;
    location: string | null;
}

interface InventoryTableProps {
    items: InventoryItem[];
    role: Role;
    canSeeValue: boolean;
}

export function InventoryTable({ items, role, canSeeValue }: InventoryTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [stockAction, setStockAction] = useState<{ mode: StockDialogMode; item: InventoryItem } | null>(null);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredItems = items.filter((item) => {
        const term = search.toLowerCase();
        return (
            item.name.toLowerCase().includes(term) ||
            item.sku?.toLowerCase().includes(term) ||
            item.category?.toLowerCase().includes(term) ||
            item.location?.toLowerCase().includes(term)
        );
    });

    const pagination = usePagination({
        defaultPageSize: 10,
        totalItems: filteredItems.length,
    });

    const paginatedItems = filteredItems.slice(pagination.startIndex, pagination.endIndex);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteInventoryItem(deleteId);
            if (result.success) {
                toast.success("Item deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete item");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search items..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">SKU</TableHead>
                                <TableHead className="hidden sm:table-cell">Category</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                {canSeeValue && (
                                    <TableHead className="text-right hidden lg:table-cell">Unit Cost</TableHead>
                                )}
                                {canSeeValue && <TableHead className="text-right">Total Value</TableHead>}
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={canSeeValue ? 8 : 6} className="text-center py-8 text-muted-foreground">
                                        No inventory items found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedItems.map((item) => {
                                    const isLowStock = item.quantity <= item.minQuantity;
                                    const totalValue = (item.unitCost ?? 0) * item.quantity;
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                <Link href={`/inventory/${item.id}`} className="hover:underline">
                                                    {item.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">{item.sku || "-"}</TableCell>
                                            <TableCell className="hidden sm:table-cell">{item.category || "-"}</TableCell>
                                            <TableCell className="text-right">
                                                {item.quantity} {item.unit || ""}
                                            </TableCell>
                                            {canSeeValue && (
                                                <TableCell className="text-right hidden lg:table-cell">
                                                    {item.unitCost != null ? formatCurrency(item.unitCost) : "-"}
                                                </TableCell>
                                            )}
                                            {canSeeValue && (
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(totalValue)}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center">
                                                {isLowStock ? (
                                                    <Badge variant="destructive">Low Stock</Badge>
                                                ) : (
                                                    <Badge variant="secondary">In Stock</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/inventory/${item.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {canEdit && (
                                                            <>
                                                                <DropdownMenuItem
                                                                    onClick={() => setStockAction({ mode: "out", item })}
                                                                    disabled={item.quantity === 0}
                                                                >
                                                                    <PackageMinus className="mr-2 h-4 w-4" />
                                                                    Take Out Stock
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => setStockAction({ mode: "in", item })}>
                                                                    <PackagePlus className="mr-2 h-4 w-4" />
                                                                    Add Stock
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/inventory/${item.id}/edit`}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {canDelete && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => setDeleteId(item.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={filteredItems.length}
                    setCurrentPage={pagination.setCurrentPage}
                    setPageSize={pagination.setPageSize}
                    startIndex={pagination.startIndex}
                    endIndex={pagination.endIndex}
                    canGoToPreviousPage={pagination.canGoToPreviousPage}
                    canGoToNextPage={pagination.canGoToNextPage}
                    goToFirstPage={pagination.goToFirstPage}
                    goToLastPage={pagination.goToLastPage}
                    goToPreviousPage={pagination.goToPreviousPage}
                    goToNextPage={pagination.goToNextPage}
                />
            </CardContent>

            <StockMovementDialog
                mode={stockAction?.mode ?? "out"}
                item={stockAction?.item ?? null}
                open={!!stockAction}
                onOpenChange={(open) => !open && setStockAction(null)}
            />

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this item? This action cannot be undone.
                            Items with existing allocations cannot be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
