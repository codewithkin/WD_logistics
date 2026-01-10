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
import { MoreHorizontal, Eye, Pencil, Trash2, Search, FileEdit } from "lucide-react";
import { DriverStatus, Role, DRIVER_STATUS_LABELS, DRIVER_STATUS_COLORS } from "@/lib/types";
import { deleteDriver, requestEditDriver } from "../actions";
import { toast } from "sonner";

interface Driver {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    licenseNumber: string;
    licenseExpiry: Date | null;
    status: DriverStatus;
    assignedTruck: {
        id: string;
        registrationNo: string;
    } | null;
    _count: {
        trips: number;
    };
}

interface DriversTableProps {
    drivers: Driver[];
    role: Role;
}

export function DriversTable({ drivers, role }: DriversTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";
    const isStaff = role === "staff";

    const filteredDrivers = drivers.filter((driver) => {
        const driverName = `${driver.firstName} ${driver.lastName}`.toLowerCase();
        const matchesSearch =
            driverName.includes(search.toLowerCase()) ||
            driver.phone.toLowerCase().includes(search.toLowerCase()) ||
            driver.licenseNumber.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || driver.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteDriver(deleteId);
            if (result.success) {
                toast.success("Driver deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete driver");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const handleRequestEdit = async (driverId: string) => {
        try {
            const result = await requestEditDriver(driverId);
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
                            placeholder="Search drivers..."
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
                            {Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => (
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
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>License</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assigned Truck</TableHead>
                                <TableHead>Trips</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDrivers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No drivers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredDrivers.map((driver) => (
                                    <TableRow key={driver.id}>
                                        <TableCell className="font-medium">{driver.firstName} {driver.lastName}</TableCell>
                                        <TableCell>{driver.phone}</TableCell>
                                        <TableCell>{driver.licenseNumber}</TableCell>
                                        <TableCell>
                                            <Badge className={DRIVER_STATUS_COLORS[driver.status]}>
                                                {DRIVER_STATUS_LABELS[driver.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {driver.assignedTruck ? (
                                                <Link
                                                    href={`/fleet/trucks/${driver.assignedTruck.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {driver.assignedTruck.registrationNo}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{driver._count.trips}</TableCell>
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
                                                        <Link href={`/fleet/drivers/${driver.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/fleet/drivers/${driver.id}/edit`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {isStaff && (
                                                        <DropdownMenuItem onClick={() => handleRequestEdit(driver.id)}>
                                                            <FileEdit className="mr-2 h-4 w-4" />
                                                            Request Edit
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => setDeleteId(driver.id)}
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
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Driver</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this driver? This action cannot be undone.
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
