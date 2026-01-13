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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Pencil, Trash2, Search, Eye, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Role, EMPLOYEE_STATUS_LABELS } from "@/lib/types";
import { deleteEmployee, exportEmployeesPDF } from "../actions";
import { toast } from "sonner";

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    position: string;
    department: string | null;
    status: string;
    startDate: Date;
}

interface EmployeesTableProps {
    employees: Employee[];
    role: Role;
}

export function EmployeesTable({ employees, role }: EmployeesTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const canEdit = role === "admin" || role === "supervisor";
    const canDelete = role === "admin";

    const filteredEmployees = employees.filter((employee) => {
        const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        const matchesSearch =
            fullName.includes(search.toLowerCase()) ||
            employee.email?.toLowerCase().includes(search.toLowerCase()) ||
            employee.position.toLowerCase().includes(search.toLowerCase());

        const matchesFilter =
            statusFilter === "all" || employee.status === statusFilter;

        return matchesSearch && matchesFilter;
    });

    const pagination = usePagination({ defaultPageSize: 10, totalItems: filteredEmployees.length });
    const paginatedEmployees = filteredEmployees.slice(pagination.startIndex, pagination.endIndex);

    const handleDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            const result = await deleteEmployee(deleteId);
            if (result.success) {
                toast.success("Employee deleted successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete employee");
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
            const employeeIds = scope === "current-page"
                ? paginatedEmployees.map((emp) => emp.id)
                : filteredEmployees.map((emp) => emp.id);

            const result = await exportEmployeesPDF({
                employeeIds,
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
                a.download = result.filename || "employees-report.pdf";
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

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div className="flex flex-col gap-4 flex-1 md:flex-row md:items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search employees..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                <TableHead>Position</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Hire Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredEmployees.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center h-24 text-muted-foreground"
                                    >
                                        No employees found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedEmployees.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <p className="font-medium">
                                                        {employee.firstName} {employee.lastName}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{employee.position}</TableCell>
                                        <TableCell>
                                            {employee.department || (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {employee.email && <p>{employee.email}</p>}
                                                {employee.phone && (
                                                    <p className="text-muted-foreground">{employee.phone}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(employee.startDate, "MMM d, yyyy")}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={employee.status} type="employee" />
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
                                                        <Link href={`/employees/${employee.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {canEdit && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/employees/${employee.id}/edit`}>
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
                                                                onClick={() => setDeleteId(employee.id)}
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
                <div className="mt-4">
                    <PaginationControls {...pagination} totalItems={filteredEmployees.length} />
                </div>
            </CardContent>

            <ExportOptionsDialog
                open={exportDialogOpen}
                onOpenChange={setExportDialogOpen}
                currentPageCount={employees.length}
                totalCount={employees.length}
                onExport={handleExportConfirm}
                isLoading={isExporting}
            />

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this employee? This action cannot be
                            undone.
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
