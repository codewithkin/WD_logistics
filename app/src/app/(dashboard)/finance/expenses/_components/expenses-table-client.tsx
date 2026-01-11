"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Receipt } from "lucide-react";
import Link from "next/link";
import { deleteExpense } from "../actions";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Expense {
    id: string;
    amount: number;
    description: string | null;
    date: Date;
    vendor: string | null;
    reference: string | null;
    receiptUrl: string | null;
    category: {
        id: string;
        name: string;
        color: string | null;
    };
    truckExpenses: Array<{
        truck: {
            registrationNo: string;
        };
    }>;
    tripExpenses: Array<{
        trip: {
            originCity: string;
            destinationCity: string;
        };
    }>;
}

interface ExpensesTableProps {
    expenses: Expense[];
}

export function ExpensesTableClient({ expenses }: ExpensesTableProps) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this expense?")) return;

        setDeletingId(id);
        try {
            await deleteExpense(id);
            router.refresh();
        } catch (error) {
            console.error("Failed to delete expense:", error);
            alert("Failed to delete expense");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Associations</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {expenses.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                                No expenses found
                            </TableCell>
                        </TableRow>
                    ) : (
                        expenses.map((expense) => (
                            <TableRow key={expense.id}>
                                <TableCell>
                                    {new Date(expense.date).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        style={{
                                            borderColor: expense.category.color || undefined,
                                            color: expense.category.color || undefined,
                                        }}
                                    >
                                        {expense.category.name}
                                    </Badge>
                                </TableCell>
                                <TableCell>{expense.description || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {expense.truckExpenses.length > 0 && (
                                            <div className="text-xs">
                                                <span className="font-medium">Trucks: </span>
                                                {expense.truckExpenses.map(te => te.truck.registrationNo).join(", ")}
                                            </div>
                                        )}
                                        {expense.tripExpenses.length > 0 && (
                                            <div className="text-xs">
                                                <span className="font-medium">Trips: </span>
                                                {expense.tripExpenses.map(te => `${te.trip.originCity}→${te.trip.destinationCity}`).join(", ")}
                                            </div>
                                        )}
                                        {expense.truckExpenses.length === 0 && expense.tripExpenses.length === 0 && (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>{expense.vendor || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {expense.reference || "-"}
                                        {expense.receiptUrl && (
                                            <a
                                                href={expense.receiptUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                <Receipt className="h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(expense.amount)}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/finance/expenses/${expense.id}/edit`}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDelete(expense.id)}
                                                disabled={deletingId === expense.id}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
