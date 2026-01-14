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
import { MoreHorizontal, Pencil, Trash2, Search, FileText, Loader2 } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { ExportOptionsDialog, type ExportScope } from "@/components/ui/export-options-dialog";
import { format } from "date-fns";
import { Role } from "@/lib/types";
import { deletePayment, exportPaymentsPDF } from "../actions";
import { toast } from "sonner";

interface Payment {
    id: string;
    amount: number;
    paymentDate: Date;
    method: string;
    customMethod: string | null;
    reference: string | null;
    invoice: {
        id: string;
        invoiceNumber: string;
        customer: {
            id: string;
            name: string;
        };
    };
}

interface PaymentsTableProps {
    payments: Payment[];
    role: Role;
}

export function PaymentsTable({ payments, role }: PaymentsTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredPayments = payments.filter((payment) => {
        return (
            payment.invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
            payment.invoice.customer.name.toLowerCase().includes(search.toLowerCase()) ||
            payment.reference?.toLowerCase().includes(search.toLowerCase())
        );
    });

    const pagination = usePagination({ defaultPageSize: 10, totalItems: filteredPayments.length });
    const paginatedPayments = filteredPayments.slice(pagination.startIndex, pagination.endIndex);

    const totalPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deletePayment(deleteId);
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

    const handleExportConfirm = async (scope: ExportScope) => {
        setIsExporting(true);
        try {
            const paymentIds = scope === "current-page"
                ? paginatedPayments.map((p) => p.id)
                : filteredPayments.map((p) => p.id);

            const result = await exportPaymentsPDF({
                paymentIds,
                startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
                endDate: new Date(),
            });

            if (result.success && result.pdf) {
                const byteCharacters = atob(result.pdf);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/pdf" });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename || "payments-report.pdf";
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success("Report exported successfully");
            } else {
                toast.error(result.error || "Failed to generate report");
            }
        } catch {
            toast.error("An error occurred while exporting");
        } finally {
            setIsExporting(false);
        }
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
                        <div className="text-sm text-muted-foreground">
                            Total: <span className="font-bold text-foreground">${totalPayments.toLocaleString()}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExportDialogOpen(true)}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="mr-2 h-4 w-4" />
                            )}
                            Export Report
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No payments found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedPayments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{format(payment.paymentDate, "MMM d, yyyy")}</TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/finance/invoices/${payment.invoice.id}`}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {payment.invoice.invoiceNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/customers/${payment.invoice.customer.id}`}
                                                className="text-primary hover:underline"
                                            >
                                                {payment.invoice.customer.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            {payment.method === "other" && payment.customMethod ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                    {payment.customMethod}
                                                </span>
                                            ) : (
                                                <StatusBadge status={payment.method} type="paymentMethod" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {payment.reference || <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-green-600">
                                            ${payment.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {(canEdit || canDelete) && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Open menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {canEdit && (
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/finance/payments/${payment.id}/edit`}>
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
                                                                    onClick={() => setDeleteId(payment.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {filteredPayments.length > 0 && (
                            <TableFooter>
                                <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={5} className="text-right">
                                        Total ({filteredPayments.length} payments)
                                    </TableCell>
                                    <TableCell className="text-right text-green-600">
                                        ${totalPayments.toLocaleString()}
                                    </TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>
                <div className="mt-4">
                    <PaginationControls {...pagination} totalItems={filteredPayments.length} />
                </div>
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this payment? This action cannot be undone.
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

            <ExportOptionsDialog
                open={exportDialogOpen}
                onOpenChange={setExportDialogOpen}
                currentPageCount={paginatedPayments.length}
                totalCount={filteredPayments.length}
                onExport={handleExportConfirm}
                isLoading={isExporting}
            />
        </Card>
    );
}
