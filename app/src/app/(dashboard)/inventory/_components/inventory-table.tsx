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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MoreHorizontal,
    Pencil,
    Trash2,
    Search,
    Eye,
    AlertTriangle,
} from "lucide-react";
import { Role } from "@/lib/types";
import { deleteInventoryItem } from "../actions";
import { toast } from "sonner";

interface InventoryItem {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    quantity: number;
    minQuantity: number;
    unitCost: number | null;
    location: string | null;
    supplier: string | null;
    notes: string | null;
    _count: {
        allocations: number;
    };
}

interface InventoryTableProps {
    items: InventoryItem[];
    role: Role;
}

export function InventoryTable({ items, role }: InventoryTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [stockFilter, setStockFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredItems = items.filter((item) => {
        const matchesSearch =
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.sku?.toLowerCase().includes(search.toLowerCase());

        const matchesFilter =
            stockFilter === "all" ||
            (stockFilter === "low" && item.quantity <= item.minQuantity) ||
            (stockFilter === "in_stock" && item.quantity > item.minQuantity);

        return matchesSearch && matchesFilter;
    });

    const lowStockCount = items.filter((i) => i.quantity <= i.minQuantity).length;
    const totalValue = items.reduce((sum, i) => sum + i.quantity * (i.unitCost ?? 0), 0);

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

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search items..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Stock status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Items</SelectItem>
                                <SelectItem value="low">Low Stock</SelectItem>
                                <SelectItem value="in_stock">In Stock</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {lowStockCount > 0 && (
                            <span className="text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" />
                                {lowStockCount} low stock
                            </span>
                        )}
                        <span>
                            Total Value:{" "}
                            <span className="font-bold text-foreground">
                                ${totalValue.toLocaleString()}
                            </span>
                        </span>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Cost/Unit</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                                <TableHead className="text-right">Allocations</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="text-center h-24 text-muted-foreground"
                                    >
                                        No inventory items found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => {
                                    const isLowStock = item.quantity <= item.minQuantity;
                                    const value = item.quantity * (item.unitCost ?? 0);

                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell>
                                                {item.sku || <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={isLowStock ? "text-amber-600 font-semibold" : ""}>
                                                    {item.quantity}
                                                </span>
                                                {isLowStock && (
                                                    <Badge variant="outline" className="ml-2 text-amber-600">
                                                        Low
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.category || <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ${(item.unitCost ?? 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${value.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {item._count.allocations}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Open menu</span>
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
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/inventory/${item.id}/edit`}>
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canDelete && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
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
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this item? This action cannot be undone.
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
