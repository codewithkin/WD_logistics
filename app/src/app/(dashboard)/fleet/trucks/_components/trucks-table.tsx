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
import { MoreHorizontal, Eye, Pencil, Trash2, Search, FileEdit } from "lucide-react";
import { Role } from "@/lib/types";
import { deleteTruck, requestEditTruck } from "../actions";
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
}

interface TrucksTableProps {
    trucks: Truck[];
    role: Role;
}

export function TrucksTable({ trucks, role }: TrucksTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTrucks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                        No trucks found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedTrucks.map((truck) => (
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
                        totalItems={filteredTrucks.length}
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
        </Card>
    );
}
