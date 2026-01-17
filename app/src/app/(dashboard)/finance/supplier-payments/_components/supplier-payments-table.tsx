"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { MoreHorizontal, Pencil, Trash2, Search, Building2 } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { format } from "date-fns";
import { Role, PAYMENT_METHOD_LABELS } from "@/lib/types";
import { deleteSupplierPayment } from "../actions";
import { toast } from "sonner";

interface SupplierPayment {
    id: string;
    amount: number;
    paymentDate: Date;
    method: string;
    customMethod: string | null;
    reference: string | null;
    description: string | null;
    supplier: {
        id: string;
        name: string;
    };
}

interface SupplierPaymentsTableProps {
    payments: SupplierPayment[];
    role: Role;
    showFinancials?: boolean;
}

export function SupplierPaymentsTable({ payments, role, showFinancials = true }: SupplierPaymentsTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";
    const canViewAmounts = showFinancials && role === "admin";

    const filteredPayments = payments.filter((payment) => {
        return (
            payment.supplier.name.toLowerCase().includes(search.toLowerCase()) ||
            payment.reference?.toLowerCase().includes(search.toLowerCase()) ||
            payment.description?.toLowerCase().includes(search.toLowerCase())
        );
    });

    const pagination = usePagination({ defaultPageSize: 10, totalItems: filteredPayments.length });
    const paginatedPayments = filteredPayments.slice(pagination.startIndex, pagination.endIndex);

    const totalPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteSupplierPayment(deleteId);
            if (result.success) {
                toast.success("Payment deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete payment");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const getMethodLabel = (method: string, customMethod: string | null) => {
        if (method === "other" && customMethod) {
            return customMethod;
        }
        return PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method;
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search payments..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        {canViewAmounts && (
                            <div className="text-sm text-muted-foreground">
                                Total: <span className="font-bold text-foreground">${totalPayments.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Reference</TableHead>
                                {canViewAmounts && <TableHead className="text-right">Amount</TableHead>}
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={canViewAmounts ? 7 : 6} className="text-center h-24 text-muted-foreground">
                                        No supplier payments found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedPayments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>
                                            {format(new Date(payment.paymentDate), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/suppliers/${payment.supplier.id}`}
                                                className="flex items-center gap-2 hover:underline"
                                            >
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                {payment.supplier.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {payment.description || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {getMethodLabel(payment.method, payment.customMethod)}
                                        </TableCell>
                                        <TableCell>{payment.reference || "-"}</TableCell>
                                        {canViewAmounts && (
                                            <TableCell className="text-right font-medium">
                                                ${payment.amount.toLocaleString()}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/finance/supplier-payments/${payment.id}/edit`}>
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
                                                                onClick={() => setDeleteId(payment.id)}
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
                        </TableBody>
                        {filteredPayments.length > 0 && (
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={5}>Total</TableCell>
                                    <TableCell className="text-right font-bold">
                                        ${totalPayments.toLocaleString()}
                                    </TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>

                {filteredPayments.length > 0 && (
                    <div className="mt-4">
                        <PaginationControls {...pagination} totalItems={filteredPayments.length} />
                    </div>
                )}
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this supplier payment? This action cannot be undone
                            and will restore the amount to the supplier&apos;s balance.
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
