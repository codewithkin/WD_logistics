"use client";

/**
 * The approval queue.
 *
 * Every row opens a real before/after diff (see edit-request-diff.tsx) rather
 * than the raw JSON blob the old screen showed — which was always `{}`,
 * because nothing ever wrote a proposed payload into it.
 */

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
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertTriangle,
    Check,
    ExternalLink,
    Eye,
    Loader2,
    Search,
    Undo2,
    X,
} from "lucide-react";
import { format } from "date-fns";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { Role, EDIT_REQUEST_STATUS_LABELS } from "@/lib/types";
import {
    approveEditRequest,
    rejectEditRequest,
    withdrawEditRequest,
} from "../actions";
import { EditRequestDiff } from "./edit-request-diff";
import { toast } from "sonner";

export interface EditRequestRow {
    id: string;
    entityType: string;
    entityId: string;
    entityLabel: string | null;
    action: string;
    reason: string;
    status: string;
    applyError: string | null;
    createdAt: Date;
    approvedAt: Date | null;
    rejectionReason: string | null;
    requestedBy: {
        id: string;
        name: string;
        email: string;
    };
    approvedBy: {
        id: string;
        name: string;
    } | null;
}

interface Props {
    editRequests: EditRequestRow[];
    role: Role;
    currentUserId: string;
    /** Only admins may accept or refuse; supervisors raise and watch. */
    canApprove: boolean;
}

const ENTITY_LABELS: Record<string, string> = {
    truck: "Truck",
    trailer: "Trailer",
    driver: "Driver",
    trip: "Trip",
    customer: "Customer",
    supplier: "Supplier",
    employee: "Employee",
    invoice: "Invoice",
    payment: "Payment",
    supplier_payment: "Supplier payment",
    expense: "Expense",
    inventory_item: "Inventory item",
};

export function EditRequestsTable({
    editRequests,
    role,
    currentUserId,
    canApprove,
}: Props) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [entityFilter, setEntityFilter] = useState("all");
    const [mineOnly, setMineOnly] = useState(false);

    const [reviewing, setReviewing] = useState<EditRequestRow | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isWorking, setIsWorking] = useState(false);
    const [showRejectReason, setShowRejectReason] = useState(false);

    const filtered = editRequests.filter((request) => {
        const haystack = [
            request.entityLabel ?? "",
            request.reason,
            request.requestedBy.name,
            ENTITY_LABELS[request.entityType] ?? request.entityType,
        ]
            .join(" ")
            .toLowerCase();

        if (search && !haystack.includes(search.toLowerCase())) return false;
        if (statusFilter !== "all" && request.status !== statusFilter) return false;
        if (entityFilter !== "all" && request.entityType !== entityFilter) return false;
        if (mineOnly && request.requestedBy.id !== currentUserId) return false;
        return true;
    });

    const pagination = usePagination({ totalItems: filtered.length });
    const paginatedItems = filtered.slice(
        pagination.startIndex,
        pagination.endIndex,
    );

    const close = () => {
        setReviewing(null);
        setRejectionReason("");
        setShowRejectReason(false);
    };

    const handleApprove = async () => {
        if (!reviewing) return;
        setIsWorking(true);
        try {
            const result = await approveEditRequest(reviewing.id);
            if (result.success) {
                toast.success("Change applied");
                close();
                router.refresh();
            } else {
                toast.error(result.error ?? "Could not apply the change");
            }
        } catch {
            toast.error("Could not apply the change");
        } finally {
            setIsWorking(false);
        }
    };

    const handleReject = async () => {
        if (!reviewing) return;
        setIsWorking(true);
        try {
            const result = await rejectEditRequest(reviewing.id, rejectionReason);
            if (result.success) {
                toast.success("Request turned down");
                close();
                router.refresh();
            } else {
                toast.error(result.error ?? "Could not turn this down");
            }
        } catch {
            toast.error("Could not turn this down");
        } finally {
            setIsWorking(false);
        }
    };

    const handleWithdraw = async (id: string) => {
        setIsWorking(true);
        try {
            const result = await withdrawEditRequest(id);
            if (result.success) {
                toast.success("Request withdrawn");
                close();
                router.refresh();
            } else {
                toast.error(result.error ?? "Could not withdraw this request");
            }
        } catch {
            toast.error("Could not withdraw this request");
        } finally {
            setIsWorking(false);
        }
    };

    const entityTypes = [...new Set(editRequests.map((r) => r.entityType))].sort();

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by record, reason or requester…"
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any status</SelectItem>
                            {Object.entries(EDIT_REQUEST_STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={entityFilter} onValueChange={setEntityFilter}>
                        <SelectTrigger className="w-full sm:w-44">
                            <SelectValue placeholder="Record type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any record</SelectItem>
                            {entityTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {ENTITY_LABELS[type] ?? type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant={mineOnly ? "secondary" : "outline"}
                        onClick={() => setMineOnly((v) => !v)}
                        className="w-full sm:w-auto"
                    >
                        My requests
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Record</TableHead>
                                    <TableHead>Change</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Requested by</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Review</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                            No requests match these filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedItems.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell>
                                                <p className="font-medium">
                                                    {request.entityLabel ??
                                                        `${ENTITY_LABELS[request.entityType] ?? request.entityType} record`}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {ENTITY_LABELS[request.entityType] ?? request.entityType}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={request.action === "delete" ? "destructive" : "secondary"}
                                                >
                                                    {request.action === "delete" ? "Delete" : "Edit"}
                                                </Badge>
                                                {request.applyError && (
                                                    <p
                                                        className="mt-1 flex items-center gap-1 text-xs text-amber-600"
                                                        title={request.applyError}
                                                    >
                                                        <AlertTriangle className="h-3 w-3" /> Last attempt failed
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                <p className="truncate text-sm">{request.reason}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(request.createdAt, "d MMM yyyy, HH:mm")}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {request.requestedBy.name}
                                                {request.requestedBy.id === currentUserId && (
                                                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={request.status} type="editRequest" />
                                                {request.status === "rejected" && request.rejectionReason && (
                                                    <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
                                                        {request.rejectionReason}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setReviewing(request);
                                                        setShowRejectReason(false);
                                                        setRejectionReason("");
                                                    }}
                                                >
                                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                    {canApprove && request.status === "pending" ? "Review" : "View"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {pagination.totalPages > 1 && (
                <PaginationControls {...pagination} totalItems={filtered.length} />
            )}

            <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && close()}>
                <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
                    {reviewing && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {reviewing.action === "delete" ? "Delete" : "Change"}{" "}
                                    {reviewing.entityLabel ??
                                        ENTITY_LABELS[reviewing.entityType] ??
                                        reviewing.entityType}
                                </DialogTitle>
                                <DialogDescription>
                                    Asked for by {reviewing.requestedBy.name} on{" "}
                                    {format(reviewing.createdAt, "d MMM yyyy, HH:mm")} — &ldquo;
                                    {reviewing.reason}&rdquo;
                                </DialogDescription>
                            </DialogHeader>

                            <EditRequestDiff
                                requestId={reviewing.id}
                                action={reviewing.action}
                                entityLabel={
                                    reviewing.entityLabel ??
                                    ENTITY_LABELS[reviewing.entityType] ??
                                    reviewing.entityType
                                }
                            />

                            {reviewing.applyError && (
                                <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                                    The last attempt to apply this failed: {reviewing.applyError}
                                </p>
                            )}

                            {showRejectReason && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">
                                        Why are you turning this down?
                                    </label>
                                    <Textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="The requester sees this."
                                        rows={3}
                                    />
                                </div>
                            )}

                            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/edit-requests?highlight=${reviewing.id}`}>
                                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                        Permalink
                                    </Link>
                                </Button>

                                <div className="flex flex-wrap gap-2">
                                    {reviewing.status === "pending" &&
                                        reviewing.requestedBy.id === currentUserId && (
                                            <Button
                                                variant="outline"
                                                onClick={() => handleWithdraw(reviewing.id)}
                                                disabled={isWorking}
                                            >
                                                <Undo2 className="mr-1.5 h-4 w-4" />
                                                Withdraw
                                            </Button>
                                        )}

                                    {canApprove && reviewing.status === "pending" && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    showRejectReason ? handleReject() : setShowRejectReason(true)
                                                }
                                                disabled={isWorking}
                                            >
                                                {isWorking && showRejectReason ? (
                                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <X className="mr-1.5 h-4 w-4" />
                                                )}
                                                {showRejectReason ? "Confirm refusal" : "Turn down"}
                                            </Button>
                                            <Button onClick={handleApprove} disabled={isWorking}>
                                                {isWorking && !showRejectReason ? (
                                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Check className="mr-1.5 h-4 w-4" />
                                                )}
                                                Approve and apply
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {role !== "admin" && (
                <p className="text-xs text-muted-foreground">
                    Only an admin can approve a change. Yours stay here until one does.
                </p>
            )}
        </div>
    );
}
