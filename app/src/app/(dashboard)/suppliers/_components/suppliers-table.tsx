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
import { StatusBadge } from "@/components/ui/status-badge";
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
import { MoreHorizontal, Eye, Pencil, Trash2, Search } from "lucide-react";
import { Role } from "@/lib/types";
import { deleteSupplier } from "../actions";
import { toast } from "sonner";

interface Supplier {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    contactPerson: string | null;
    status: string;
    balance: number;
    periodExpenseTotal?: number;
    _count: {
        expenses: number;
    };
}

interface SuppliersTableProps {
    suppliers: Supplier[];
    role: Role;
    periodLabel?: string;
}

export function SuppliersTable({ suppliers, role, periodLabel = "This Month" }: SuppliersTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredSuppliers = suppliers.filter((supplier) => {
        return (
            supplier.name.toLowerCase().includes(search.toLowerCase()) ||
            supplier.email?.toLowerCase().includes(search.toLowerCase()) ||
            supplier.phone?.toLowerCase().includes(search.toLowerCase()) ||
            supplier.contactPerson?.toLowerCase().includes(search.toLowerCase())
        );
    });

    const pagination = usePagination({
        defaultPageSize: 10,
        totalItems: filteredSuppliers.length,
    });

    const paginatedSuppliers = filteredSuppliers.slice(pagination.startIndex, pagination.endIndex);

    // Calculate totals for filtered results
    const totalBalance = filteredSuppliers.reduce((sum, s) => sum + s.balance, 0);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteSupplier(deleteId);
            if (result.success) {
                toast.success("Supplier deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete supplier");
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
                            placeholder="Search suppliers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="text-center" title={`Expenses in ${periodLabel}`}>Expenses ({periodLabel})</TableHead>
                                <TableHead className="text-right" title={`Expense Total in ${periodLabel}`}>Expense Total ({periodLabel})</TableHead>
                                <TableHead className="text-right">Balance Owed</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                        No suppliers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedSuppliers.map((supplier) => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/suppliers/${supplier.id}`}
                                                className="hover:underline"
                                            >
                                                {supplier.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{supplier.contactPerson || "-"}</TableCell>
                                        <TableCell>{supplier.phone || "-"}</TableCell>
                                        <TableCell>{supplier.email || "-"}</TableCell>
                                        <TableCell className="text-center">
                                            {supplier._count.expenses}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-amber-600">
                                            {formatCurrency(supplier.periodExpenseTotal || 0)}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${supplier.balance > 0 ? "text-red-600" : ""}`}>
                                            {formatCurrency(supplier.balance)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <StatusBadge status={supplier.status} type="customer" />
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
                                                        <Link href={`/suppliers/${supplier.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/suppliers/${supplier.id}/edit`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => setDeleteId(supplier.id)}
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
                                ))
                            )}
                            {paginatedSuppliers.length > 0 && (
                                <TableRow className="bg-muted/50 font-medium">
                                    <TableCell colSpan={5}>Total</TableCell>
                                    <TableCell className={`text-right ${totalBalance > 0 ? "text-red-600" : ""}`}>
                                        {formatCurrency(totalBalance)}
                                    </TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={filteredSuppliers.length}
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

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this supplier? This action cannot be undone.
                            Suppliers with associated expenses cannot be deleted.
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
