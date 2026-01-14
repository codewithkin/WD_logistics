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
import { ExportOptionsDialog, type ExportScope } from "@/components/ui/export-options-dialog";
import { MoreHorizontal, Eye, Pencil, Trash2, Search, FileText, Loader2, FileSpreadsheet } from "lucide-react";
import { Role } from "@/lib/types";
import { deleteCustomer, exportCustomersPDF, exportCustomerDetailWord } from "../actions";
import { toast } from "sonner";

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    balance: number;
    _count: {
        trips: number;
        invoices: number;
    };
}

interface CustomersTableProps {
    customers: Customer[];
    role: Role;
}

export function CustomersTable({ customers, role }: CustomersTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportingCustomerId, setExportingCustomerId] = useState<string | null>(null);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredCustomers = customers.filter((customer) => {
        return (
            customer.name.toLowerCase().includes(search.toLowerCase()) ||
            customer.email?.toLowerCase().includes(search.toLowerCase()) ||
            customer.phone?.toLowerCase().includes(search.toLowerCase())
        );
    });

    const pagination = usePagination({
        defaultPageSize: 10,
        totalItems: filteredCustomers.length,
    });

    const paginatedCustomers = filteredCustomers.slice(pagination.startIndex, pagination.endIndex);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteCustomer(deleteId);
            if (result.success) {
                toast.success("Customer deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete customer");
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
            const customerIds = scope === "current-page"
                ? paginatedCustomers.map((c) => c.id)
                : filteredCustomers.map((c) => c.id);

            const result = await exportCustomersPDF({
                customerIds,
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
                a.download = result.filename || "customer-report.pdf";
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

    const handleExportCustomerWord = async (customerId: string) => {
        setExportingCustomerId(customerId);
        try {
            const result = await exportCustomerDetailWord(customerId);

            if (result.success && result.doc) {
                const byteCharacters = atob(result.doc);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename || "customer-report.docx";
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success("Customer report exported successfully");
            } else {
                toast.error(result.error || "Failed to generate report");
            }
        } catch {
            toast.error("An error occurred while exporting");
        } finally {
            setExportingCustomerId(null);
        }
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search customers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
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

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Balance</TableHead>
                                <TableHead>Trips</TableHead>
                                <TableHead>Invoices</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No customers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">{customer.name}</TableCell>
                                        <TableCell>
                                            <div>
                                                {customer.email && <p className="text-sm">{customer.email}</p>}
                                                {customer.phone && (
                                                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={customer.status} type="customer" />
                                        </TableCell>
                                        <TableCell>
                                            <span className={customer.balance > 0 ? "text-green-600 font-medium" : customer.balance < 0 ? "text-red-600 font-medium" : ""}>
                                                ${Math.abs(customer.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                {customer.balance > 0 ? " (Credit)" : customer.balance < 0 ? " (Owed)" : ""}
                                            </span>
                                        </TableCell>
                                        <TableCell>{customer._count.trips}</TableCell>
                                        <TableCell>{customer._count.invoices}</TableCell>
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
                                                        <Link href={`/customers/${customer.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/customers/${customer.id}/edit`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        onClick={() => handleExportCustomerWord(customer.id)}
                                                        disabled={exportingCustomerId === customer.id}
                                                    >
                                                        {exportingCustomerId === customer.id ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                                                        )}
                                                        Generate Report
                                                    </DropdownMenuItem>
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => setDeleteId(customer.id)}
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
                    </Table>
                </div>

                <div className="mt-6 pt-6 border-t">
                    <PaginationControls
                        {...pagination}
                        totalItems={filteredCustomers.length}
                        pageSizeOptions={[10, 25, 50]}
                    />
                </div>
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this customer? This action cannot be undone.
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
                currentPageCount={paginatedCustomers.length}
                totalCount={filteredCustomers.length}
                onExport={handleExportConfirm}
                isLoading={isExporting}
            />
        </Card>
    );
}
