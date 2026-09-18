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
import { MoreHorizontal, Eye, Pencil, Trash2, Search, FileEdit, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { ExportOptionsDialog, type ExportScope } from "@/components/ui/export-options-dialog";
import { Role, TRAILER_STATUS_LABELS } from "@/lib/types";
import { deleteTrailer, requestEditTrailer, exportTrailersPDF } from "../actions";
import { toast } from "sonner";

interface Trailer {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    status: string;
    type: string | null;
    assignedTruck: {
        id: string;
        registrationNo: string;
    } | null;
}

interface TrailersTableProps {
    trailers: Trailer[];
    role: Role;
}

export function TrailersTable({ trailers, role }: TrailersTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("pdf");
    const [isExporting, setIsExporting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";
    const isStaff = role === "staff";

    const filteredTrailers = trailers.filter((trailer) => {
        const matchesSearch =
            trailer.registrationNo.toLowerCase().includes(search.toLowerCase()) ||
            trailer.make.toLowerCase().includes(search.toLowerCase()) ||
            trailer.model.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || trailer.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const pagination = usePagination({
        defaultPageSize: 10,
        totalItems: filteredTrailers.length,
    });

    const paginatedTrailers = filteredTrailers.slice(pagination.startIndex, pagination.endIndex);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteTrailer(deleteId);
            if (result.success) {
                toast.success("Trailer deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete trailer");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    const handleRequestEdit = async (trailerId: string) => {
        try {
            const result = await requestEditTrailer(trailerId);
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
            const trailerIds = scope === "current-page"
                ? paginatedTrailers.map((t) => t.id)
                : filteredTrailers.map((t) => t.id);

            const result = await exportTrailersPDF({ trailerIds });

            if (result.success) {
                const byteCharacters = atob(result.pdf);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename || "trailer-report.pdf";
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
        const dataToExport = scope === "current-page" ? paginatedTrailers : filteredTrailers;

        const escapeCSV = (value: string) =>
            /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

        const rows = dataToExport.map((trailer) => [
            escapeCSV(trailer.registrationNo),
            escapeCSV(`${trailer.make} ${trailer.model}`),
            trailer.year,
            escapeCSV(trailer.type || "N/A"),
            escapeCSV(TRAILER_STATUS_LABELS[trailer.status as keyof typeof TRAILER_STATUS_LABELS] || trailer.status),
            escapeCSV(trailer.assignedTruck?.registrationNo || "Unassigned"),
        ].join(","));

        const csv = ["Registration No,Make/Model,Year,Type,Status,Assigned Truck", ...rows].join("\n");
        const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `trailers-${new Date().toISOString().split("T")[0]}.csv`;
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
                            placeholder="Search trailers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {Object.entries(TRAILER_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={isExporting}>
                                    {isExporting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileText className="mr-2 h-4 w-4" />
                                    )}
                                    Export Report
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() => {
                                        setExportFormat("pdf");
                                        setExportDialogOpen(true);
                                    }}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Export as PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setExportFormat("csv");
                                        setExportDialogOpen(true);
                                    }}
                                >
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    Export as CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Registration No.</TableHead>
                                <TableHead>Make / Model</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assigned Truck</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTrailers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No trailers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedTrailers.map((trailer) => (
                                    <TableRow key={trailer.id}>
                                        <TableCell className="font-medium">{trailer.registrationNo}</TableCell>
                                        <TableCell>
                                            {trailer.make} {trailer.model}
                                        </TableCell>
                                        <TableCell>{trailer.year}</TableCell>
                                        <TableCell>{trailer.type || "-"}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={trailer.status} type="trailer" />
                                        </TableCell>
                                        <TableCell>
                                            {trailer.assignedTruck ? (
                                                <Link
                                                    href={`/fleet/trucks/${trailer.assignedTruck.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {trailer.assignedTruck.registrationNo}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">Unassigned</span>
                                            )}
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
                                                        <Link href={`/fleet/trailers/${trailer.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/fleet/trailers/${trailer.id}/edit`}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {isStaff && (
                                                        <DropdownMenuItem onClick={() => handleRequestEdit(trailer.id)}>
                                                            <FileEdit className="mr-2 h-4 w-4" />
                                                            Request Edit
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => setDeleteId(trailer.id)}
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
                        totalItems={filteredTrailers.length}
                        pageSizeOptions={[10, 25, 50]}
                    />
                </div>
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Trailer</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this trailer? This action cannot be undone.
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
                currentPageCount={paginatedTrailers.length}
                totalCount={filteredTrailers.length}
                onExport={(scope) =>
                    exportFormat === "csv" ? handleExportCSV(scope) : handleExportConfirm(scope)
                }
                isLoading={isExporting}
            />
        </Card>
    );
}
