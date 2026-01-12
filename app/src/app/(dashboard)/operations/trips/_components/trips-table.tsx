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
import { MoreHorizontal, Eye, Pencil, Trash2, Search, FileEdit, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Role, TRIP_STATUS_LABELS } from "@/lib/types";
import { deleteTrip, requestEditTrip } from "../actions";
import { toast } from "sonner";

interface Trip {
    id: string;
    originCity: string;
    destinationCity: string;
    scheduledDate: Date;
    startDate: Date | null;
    endDate: Date | null;
    status: string;
    estimatedMileage: number;
    actualMileage: number | null;
    revenue: number;
    truck: {
        id: string;
        registrationNo: string;
    };
    driver: {
        id: string;
        firstName: string;
        lastName: string;
    };
    customer: {
        id: string;
        name: string;
    } | null;
}

interface TripsTableProps {
    trips: Trip[];
    role: Role;
}

export function TripsTable({ trips, role }: TripsTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";
    const isStaff = role === "staff";

    const filteredTrips = trips.filter((trip) => {
        const matchesSearch =
            trip.originCity.toLowerCase().includes(search.toLowerCase()) ||
            trip.destinationCity.toLowerCase().includes(search.toLowerCase()) ||
            trip.truck.registrationNo.toLowerCase().includes(search.toLowerCase()) ||
            `${trip.driver.firstName} ${trip.driver.lastName}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || trip.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteTrip(deleteId);
            if (result.success) {
                toast.success("Trip deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete trip");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const handleRequestEdit = async (tripId: string) => {
        try {
            const result = await requestEditTrip(tripId);
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
                            placeholder="Search trips..."
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
                            {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => (
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
                                <TableHead>Route</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Truck</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTrips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                        No trips found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTrips.map((trip) => (
                                    <TableRow key={trip.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <div>
                                                    <p className="font-medium">{trip.originCity}</p>
                                                    <p className="text-sm text-muted-foreground">→ {trip.destinationCity}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <p>{format(trip.scheduledDate, "MMM d, yyyy")}</p>
                                            {trip.endDate && (
                                                <p className="text-sm text-muted-foreground">
                                                    to {format(trip.endDate, "MMM d, yyyy")}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={trip.status} type="trip" />
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/fleet/trucks/${trip.truck.id}`}
                                                className="text-primary hover:underline"
                                            >
                                                {trip.truck.registrationNo}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/fleet/drivers/${trip.driver.id}`}
                                                className="text-primary hover:underline"
                                            >
                                                {trip.driver.firstName} {trip.driver.lastName}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            {trip.customer ? (
                                                <Link
                                                    href={`/customers/${trip.customer.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {trip.customer.name}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${trip.revenue.toLocaleString()}
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
                                                        <Link href={`/operations/trips/${trip.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/operations/trips/${trip.id}/edit`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {isStaff && (
                                                        <DropdownMenuItem onClick={() => handleRequestEdit(trip.id)}>
                                                            <FileEdit className="mr-2 h-4 w-4" />
                                                            Request Edit
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => setDeleteId(trip.id)}
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
                        <AlertDialogTitle>Delete Trip</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this trip? This action cannot be undone.
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
