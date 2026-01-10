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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { MoreHorizontal, Eye, Pencil, Trash2, Search, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { InvoiceStatus, Role, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/lib/types";
import { deleteInvoice } from "../actions";
import { toast } from "sonner";

interface Invoice {
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date;
    total: number;
    amountPaid: number;
    balance: number;
    status: string;
    customer: {
        id: string;
        name: string;
    };
    payments: Array<{ amount: number }>;
}

interface InvoicesTableProps {
    invoices: Invoice[];
    role: Role;
}

export function InvoicesTable({ invoices, role }: InvoicesTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredInvoices = invoices.filter((invoice) => {
        const matchesSearch =
            invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
            invoice.customer.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteInvoice(deleteId);
            if (result.success) {
                toast.success("Invoice deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete invoice");
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
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search invoices..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Issue Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                        No invoices found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices.map((invoice) => {
                                    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
                                    const isOverdue =
                                        invoice.status !== "paid" &&
                                        invoice.status !== "cancelled" &&
                                        new Date(invoice.dueDate) < new Date();

                                    return (
                                        <TableRow key={invoice.id}>
                                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/customers/${invoice.customer.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {invoice.customer.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{format(invoice.issueDate, "MMM d, yyyy")}</TableCell>
                                            <TableCell>
                                                <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                                    {format(invoice.dueDate, "MMM d, yyyy")}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={INVOICE_STATUS_COLORS[invoice.status as InvoiceStatus]}>
                                                    {INVOICE_STATUS_LABELS[invoice.status as InvoiceStatus]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ${invoice.total.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span
                                                    className={
                                                        invoice.balance <= 0
                                                            ? "text-green-600"
                                                            : invoice.amountPaid > 0
                                                                ? "text-amber-600"
                                                                : "text-muted-foreground"
                                                    }
                                                >
                                                    ${invoice.amountPaid.toLocaleString()}
                                                </span>
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
                                                            <Link href={`/finance/invoices/${invoice.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {canEdit && (
                                                            <>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/finance/invoices/${invoice.id}/edit`}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/finance/payments/new?invoiceId=${invoice.id}`}>
                                                                        <CreditCard className="mr-2 h-4 w-4" />
                                                                        Record Payment
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {canDelete && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setDeleteId(invoice.id)}
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
                        <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this invoice? This action cannot be undone.
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
