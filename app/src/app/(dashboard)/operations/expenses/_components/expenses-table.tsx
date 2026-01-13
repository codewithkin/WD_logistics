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
import { MoreHorizontal, Pencil, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { Role } from "@/lib/types";
import { deleteExpense } from "../actions";
import { toast } from "sonner";

interface Expense {
    id: string;
    description: string | null;
    amount: number;
    date: Date;
    receiptUrl: string | null;
    vendor: string | null;
    reference: string | null;
    category: {
        id: string;
        name: string;
    };
    tripExpenses: Array<{
        trip: {
            id: string;
            originCity: string;
            destinationCity: string;
            truck: {
                registrationNo: string;
            };
            driver: {
                firstName: string;
                lastName: string;
            };
        };
    }>;
}

interface ExpensesTableProps {
    expenses: Expense[];
    role: Role;
}

export function ExpensesTable({ expenses, role }: ExpensesTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredExpenses = expenses.filter((expense) => {
        const searchLower = search.toLowerCase();
        const descriptionMatch = expense.description?.toLowerCase().includes(searchLower);
        const categoryMatch = expense.category.name.toLowerCase().includes(searchLower);
        const vendorMatch = expense.vendor?.toLowerCase().includes(searchLower);
        const tripMatch = expense.tripExpenses.some(te =>
            te.trip.originCity.toLowerCase().includes(searchLower) ||
            te.trip.destinationCity.toLowerCase().includes(searchLower)
        );
        return descriptionMatch || categoryMatch || vendorMatch || tripMatch;
    });

    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteExpense(deleteId);
            if (result.success) {
                toast.success("Expense deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete expense");
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
                            placeholder="Search expenses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Total: <span className="font-bold text-foreground">${totalExpenses.toLocaleString()}</span>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Trip</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedExpenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        No expenses found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedExpenses.map((expense) => (
                                    <TableRow key={expense.id}>
                                        <TableCell className="font-medium">
                                            {expense.description || expense.category.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{expense.category.name}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {expense.tripExpenses.length > 0 ? (
                                                <Link
                                                    href={`/operations/trips/${expense.tripExpenses[0].trip.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {expense.tripExpenses[0].trip.originCity} → {expense.tripExpenses[0].trip.destinationCity}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{format(expense.date, "MMM d, yyyy")}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${expense.amount.toLocaleString()}
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
                                                                <Link href={`/operations/expenses/${expense.id}/edit`}>
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
                                                                    onClick={() => setDeleteId(expense.id)}
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
                    </Table>
                </div>

                <div className="mt-6 pt-6 border-t">
                    <PaginationControls
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        pageSize={pagination.pageSize}
                        totalItems={filteredExpenses.length}
                        startIndex={pagination.startIndex}
                        endIndex={pagination.endIndex}
                        onPageChange={pagination.setCurrentPage}
                        onPageSizeChange={(size) => {
                            pagination.setPageSize(size);
                            pagination.goToFirstPage();
                        }}
                        canGoToPreviousPage={pagination.canGoToPreviousPage}
                        canGoToNextPage={pagination.canGoToNextPage}
                        pageSizeOptions={[10, 25, 50]}
                    />
                </div>
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this expense? This action cannot be undone.
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
