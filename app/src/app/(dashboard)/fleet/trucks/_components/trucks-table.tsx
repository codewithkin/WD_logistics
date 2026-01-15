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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { ExportOptionsDialog, type ExportScope } from "@/components/ui/export-options-dialog";
import { MoreHorizontal, Eye, Pencil, Trash2, Search, FileEdit, FileText, Download, Loader2 } from "lucide-react";
import { Role, TRUCK_STATUS_LABELS } from "@/lib/types";
import { deleteTruck, requestEditTruck, exportTrucksPDF } from "../actions";
import { toast } from "sonner";

interface Truck {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    status: string;
    currentMileage: number;
    fuelType: string | null;
    assignedDriver: {
        id: string;
        firstName: string;
        lastName: string;
    } | null;
    _count: {
        trips: number;
    };
    totalExpenses: number;
    totalRevenue: number;
}

interface TrucksTableProps {
    trucks: Truck[];
    role: Role;
    periodLabel?: string;
}

export function TrucksTable({ trucks, role, periodLabel }: TrucksTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";
    const isStaff = role === "staff";

    const filteredTrucks = trucks.filter((truck) => {
        const matchesSearch =
            truck.registrationNo.toLowerCase().includes(search.toLowerCase()) ||
            truck.make.toLowerCase().includes(search.toLowerCase()) ||
            truck.model.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || truck.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Calculate totals for filtered trucks
    const totals = filteredTrucks.reduce(
        (acc, truck) => ({
            mileage: acc.mileage + truck.currentMileage,
            trips: acc.trips + truck._count.trips,
            revenue: acc.revenue + truck.totalRevenue,
            expenses: acc.expenses + truck.totalExpenses,
            profitLoss: acc.profitLoss + (truck.totalRevenue - truck.totalExpenses),
        }),
        { mileage: 0, trips: 0, revenue: 0, expenses: 0, profitLoss: 0 }
    );

    const pagination = usePagination({
        defaultPageSize: 10,
        totalItems: filteredTrucks.length,
    });

    const paginatedTrucks = filteredTrucks.slice(pagination.startIndex, pagination.endIndex);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteTruck(deleteId);
            if (result.success) {
                toast.success("Truck deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete truck");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const handleRequestEdit = async (truckId: string) => {
        try {
            const result = await requestEditTruck(truckId);
            if (result.success) {
                toast.success("Edit request submitted for approval");
            } else {
                toast.error(result.error || "Failed to submit request");
            }
        } catch {
            toast.error("An error occurred");
        }
    };

    const handleExportConfirm = async (scope: ExportScope) => {
        setIsExporting(true);
        try {
            const truckIds = scope === "current-page"
                ? paginatedTrucks.map((t) => t.id)
                : filteredTrucks.map((t) => t.id);

            const result = await exportTrucksPDF({
                truckIds,
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
                a.download = result.filename || "truck-report.pdf";
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

    const handleExportCSV = (scope: ExportScope) => {
        const dataToExport = scope === "current-page" ? paginatedTrucks : filteredTrucks;

        const escapeCSV = (value: string) => {
            if (value.includes(",") || value.includes('"') || value.includes("\n")) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        };

        const csvData = dataToExport
            .map((truck) => [
                escapeCSV(truck.registrationNo),
                escapeCSV(`${truck.make} ${truck.model}`),
                truck.year,
                escapeCSV(TRUCK_STATUS_LABELS[truck.status as keyof typeof TRUCK_STATUS_LABELS] || truck.status),
                truck.currentMileage,
                escapeCSV(truck.fuelType || "N/A"),
                escapeCSV(truck.assignedDriver ? `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}` : "Unassigned"),
                truck._count.trips,
            ].join(","))
            .join("\n");

        const header = "Registration No,Make/Model,Year,Status,Mileage,Fuel Type,Driver,Trips";
        const csv = header + "\n" + csvData;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trucks-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search trucks..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {Object.entries(TRUCK_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                <TableHead>Registration No.</TableHead>
                                <TableHead>Make / Model</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Mileage</TableHead>
                                <TableHead>Assigned Driver</TableHead>
                                <TableHead>Trips</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Expenses</TableHead>
                                <TableHead className="text-right">Profit/Loss</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTrucks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center h-24 text-muted-foreground">
                                        No trucks found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedTrucks.map((truck) => {
                                    const profitLoss = truck.totalRevenue - truck.totalExpenses;
                                    return (
                                        <TableRow key={truck.id}>
                                            <TableCell className="font-medium">{truck.registrationNo}</TableCell>
                                            <TableCell>
                                                {truck.make} {truck.model}
                                            </TableCell>
                                            <TableCell>{truck.year}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={truck.status} type="truck" />
                                            </TableCell>
                                            <TableCell>{truck.currentMileage.toLocaleString()} km</TableCell>
                                            <TableCell>
                                                {truck.assignedDriver ? (
                                                    <Link
                                                        href={`/fleet/drivers/${truck.assignedDriver.id}`}
                                                        className="text-primary hover:underline"
                                                    >
                                                        {truck.assignedDriver.firstName} {truck.assignedDriver.lastName}
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground">Unassigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{truck._count.trips}</TableCell>
                                            <TableCell className="text-right text-green-600">
                                                ${truck.totalRevenue.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-red-600">
                                                ${truck.totalExpenses.toLocaleString()}
                                            </TableCell>
                                            <TableCell className={`text-right font-medium ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {profitLoss >= 0 ? "+" : ""}${profitLoss.toLocaleString()}
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
                                                            <Link href={`/fleet/trucks/${truck.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {canEdit && (
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/fleet/trucks/${truck.id}/edit`}>
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {isStaff && (
                                                            <DropdownMenuItem onClick={() => handleRequestEdit(truck.id)}>
                                                                <FileEdit className="mr-2 h-4 w-4" />
                                                                Request Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canDelete && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setDeleteId(truck.id)}
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
                        {filteredTrucks.length > 0 && (
                            <TableFooter>
                                <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={4} className="text-right">
                                        Totals ({filteredTrucks.length} trucks)
                                    </TableCell>
                                    <TableCell>{totals.mileage.toLocaleString()} km</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell>{totals.trips}</TableCell>
                                    <TableCell className="text-right text-green-600">
                                        ${totals.revenue.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-red-600">
                                        ${totals.expenses.toLocaleString()}
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${totals.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {totals.profitLoss >= 0 ? "+" : ""}${totals.profitLoss.toLocaleString()}
                                    </TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>

                <div className="mt-6 pt-6 border-t">
                    <PaginationControls
                        {...pagination}
                        totalItems={filteredTrucks.length}
                        pageSizeOptions={[10, 25, 50]}
                    />
                </div>
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Truck</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this truck? This action cannot be undone.
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
                currentPageCount={paginatedTrucks.length}
                totalCount={filteredTrucks.length}
                onExport={handleExportConfirm}
                isLoading={isExporting}
            />
        </Card>
    );
}
