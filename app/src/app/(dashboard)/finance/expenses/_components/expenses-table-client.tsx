"use client";

import { useState, useMemo, useEffect } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Pencil, Trash2, Receipt, Search, Filter, X, Truck, MapPin } from "lucide-react";
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
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [truckFilter, setTruckFilter] = useState<string>("all");
    const [tripFilter, setTripFilter] = useState<string>("all");
    const [assignmentFilter, setAssignmentFilter] = useState<string>("all"); // all, trucks, trips, unassigned

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

    // Extract unique categories, trucks, and trips for filters
    const { categories, trucks, trips } = useMemo(() => {
        const categorySet = new Set<string>();
        const truckSet = new Set<string>();
        const tripSet = new Set<string>();

        expenses.forEach((expense) => {
            categorySet.add(expense.category.name);
            expense.truckExpenses.forEach((te) => truckSet.add(te.truck.registrationNo));
            expense.tripExpenses.forEach((te) =>
                tripSet.add(`${te.trip.originCity}→${te.trip.destinationCity}`)
            );
        });

        return {
            categories: Array.from(categorySet).sort(),
            trucks: Array.from(truckSet).sort(),
            trips: Array.from(tripSet).sort(),
        };
    }, [expenses]);

    // Filter expenses based on all criteria
    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            // Search filter
            const matchesSearch = searchQuery === "" ||
                expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.category.name.toLowerCase().includes(searchQuery.toLowerCase());

            // Category filter
            const matchesCategory = categoryFilter === "all" || expense.category.name === categoryFilter;

            // Truck filter
            const matchesTruck = truckFilter === "all" ||
                expense.truckExpenses.some((te) => te.truck.registrationNo === truckFilter);

            // Trip filter
            const matchesTrip = tripFilter === "all" ||
                expense.tripExpenses.some((te) =>
                    `${te.trip.originCity}→${te.trip.destinationCity}` === tripFilter
                );

            // Assignment filter
            let matchesAssignment = true;
            if (assignmentFilter === "trucks") {
                matchesAssignment = expense.truckExpenses.length > 0;
            } else if (assignmentFilter === "trips") {
                matchesAssignment = expense.tripExpenses.length > 0;
            } else if (assignmentFilter === "unassigned") {
                matchesAssignment = expense.truckExpenses.length === 0 && expense.tripExpenses.length === 0;
            }

            return matchesSearch && matchesCategory && matchesTruck && matchesTrip && matchesAssignment;
        });
    }, [expenses, searchQuery, categoryFilter, truckFilter, tripFilter, assignmentFilter]);

    // Calculate total
    const totalAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    }, [filteredExpenses]);

    const hasActiveFilters = categoryFilter !== "all" || truckFilter !== "all" ||
        tripFilter !== "all" || assignmentFilter !== "all" || searchQuery !== "";

    const clearFilters = () => {
        setSearchQuery("");
        setCategoryFilter("all");
        setTruckFilter("all");
        setTripFilter("all");
        setAssignmentFilter("all");
    };

    // Export handlers
    useEffect(() => {
        const handleExportPDF = () => {
            alert("PDF export for expenses table is not yet implemented");
        };

        const handleExportCSV = () => {
            const csvData = filteredExpenses
                .map((expense) => {
                    const trucks = expense.truckExpenses.map((te) => te.truck.registrationNo).join("; ");
                    const trips = expense.tripExpenses.map((te) => `${te.trip.originCity}→${te.trip.destinationCity}`).join("; ");
                    return [
                        new Date(expense.date).toLocaleDateString(),
                        expense.category.name,
                        expense.description || "",
                        trucks || "N/A",
                        trips || "N/A",
                        expense.vendor || "",
                        expense.reference || "",
                        expense.amount,
                    ].join(",");
                })
                .join("\n");
            const csv = "Date,Category,Description,Trucks,Trips,Vendor,Reference,Amount\n" + csvData;
            const blob = new Blob([csv], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        };

        window.addEventListener("export-pdf", handleExportPDF);
        window.addEventListener("export-csv", handleExportCSV);

        return () => {
            window.removeEventListener("export-pdf", handleExportPDF);
            window.removeEventListener("export-csv", handleExportCSV);
        };
    }, [filteredExpenses]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search expenses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            <X className="mr-2 h-4 w-4" />
                            Clear Filters
                        </Button>
                    )}
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-2">
                    <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Assignment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Assignments</SelectItem>
                            <SelectItem value="trucks">With Trucks</SelectItem>
                            <SelectItem value="trips">With Trips</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                    {category}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {trucks.length > 0 && (
                        <Select value={truckFilter} onValueChange={setTruckFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Truck className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="All Trucks" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Trucks</SelectItem>
                                {trucks.map((truck) => (
                                    <SelectItem key={truck} value={truck}>
                                        {truck}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {trips.length > 0 && (
                        <Select value={tripFilter} onValueChange={setTripFilter}>
                            <SelectTrigger className="w-[180px]">
                                <MapPin className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="All Trips" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Trips</SelectItem>
                                {trips.map((trip) => (
                                    <SelectItem key={trip} value={trip}>
                                        {trip}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
                    <div className="text-sm text-muted-foreground">
                        Showing <span className="font-medium text-foreground">{filteredExpenses.length}</span> of{" "}
                        <span className="font-medium text-foreground">{expenses.length}</span> expenses
                    </div>
                    <div className="text-sm font-medium">
                        Total: <span className="text-lg">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
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
                        {filteredExpenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    {expenses.length === 0 ? "No expenses found" : "No expenses match your filters"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredExpenses.map((expense) => (
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
                                        <div className="flex flex-col gap-1.5">
                                            {expense.truckExpenses.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {expense.truckExpenses.map((te, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-xs">
                                                            <Truck className="mr-1 h-3 w-3" />
                                                            {te.truck.registrationNo}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {expense.tripExpenses.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {expense.tripExpenses.map((te, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-xs">
                                                            <MapPin className="mr-1 h-3 w-3" />
                                                            {te.trip.originCity}→{te.trip.destinationCity}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            {expense.truckExpenses.length === 0 && expense.tripExpenses.length === 0 && (
                                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                                    Unassigned
                                                </Badge>
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
        </div>
    );
}

