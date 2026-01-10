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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Search, Check, X, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Role, EDIT_REQUEST_STATUS_LABELS } from "@/lib/types";
import { approveEditRequest, rejectEditRequest } from "../actions";
import { toast } from "sonner";

interface EditRequest {
    id: string;
    entityType: string;
    entityId: string;
    description: string;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewNotes: string | null;
    requestedBy: {
        id: string;
        name: string;
        email: string;
    };
    reviewedBy: {
        id: string;
        name: string;
    } | null;
}

interface EditRequestsTableProps {
    editRequests: EditRequest[];
    role: Role;
}

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    pending: "outline",
    approved: "default",
    rejected: "destructive",
};

const entityLabels: Record<string, string> = {
    truck: "Truck",
    driver: "Driver",
    trip: "Trip",
    expense: "Expense",
    customer: "Customer",
    invoice: "Invoice",
    employee: "Employee",
    inventory: "Inventory",
};

const entityRoutes: Record<string, string> = {
    truck: "/fleet/trucks",
    driver: "/fleet/drivers",
    trip: "/operations/trips",
    expense: "/operations/expenses",
    customer: "/customers",
    invoice: "/finance/invoices",
    employee: "/employees",
    inventory: "/inventory",
};

export function EditRequestsTable({ editRequests, role }: EditRequestsTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedRequest, setSelectedRequest] = useState<EditRequest | null>(null);
    const [action, setAction] = useState<"approve" | "reject" | "view" | null>(null);
    const [reviewNotes, setReviewNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canReview = role === "admin" || role === "supervisor";

    const filteredRequests = editRequests.filter((request) => {
        const matchesSearch =
            request.description.toLowerCase().includes(search.toLowerCase()) ||
            request.requestedBy.name.toLowerCase().includes(search.toLowerCase()) ||
            entityLabels[request.entityType]?.toLowerCase().includes(search.toLowerCase());

        const matchesFilter =
            statusFilter === "all" || request.status === statusFilter;

        return matchesSearch && matchesFilter;
    });

    const pendingCount = editRequests.filter((r) => r.status === "pending").length;

    const handleApprove = async () => {
        if (!selectedRequest) return;
        setIsSubmitting(true);
        try {
            const result = await approveEditRequest(selectedRequest.id, reviewNotes);
            if (result.success) {
                toast.success("Edit request approved");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to approve request");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
            setSelectedRequest(null);
            setAction(null);
            setReviewNotes("");
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        setIsSubmitting(true);
        try {
            const result = await rejectEditRequest(selectedRequest.id, reviewNotes);
            if (result.success) {
                toast.success("Edit request rejected");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to reject request");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
            setSelectedRequest(null);
            setAction(null);
            setReviewNotes("");
        }
    };

    const getEntityLink = (entityType: string, entityId: string) => {
        const baseRoute = entityRoutes[entityType];
        return baseRoute ? `${baseRoute}/${entityId}` : null;
    };

    return (
        <>
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search requests..."
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
                                    {Object.entries(EDIT_REQUEST_STATUS_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {pendingCount > 0 && canReview && (
                            <Badge variant="outline" className="text-amber-600">
                                {pendingCount} pending review
                            </Badge>
                        )}
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Status</TableHead>
                                    {canReview && <TableHead>Reviewed By</TableHead>}
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={canReview ? 7 : 6}
                                            className="text-center h-24 text-muted-foreground"
                                        >
                                            No edit requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const entityLink = getEntityLink(request.entityType, request.entityId);

                                        return (
                                            <TableRow key={request.id}>
                                                <TableCell>
                                                    {format(request.createdAt, "MMM d, yyyy")}
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(request.createdAt, "h:mm a")}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary">
                                                            {entityLabels[request.entityType] || request.entityType}
                                                        </Badge>
                                                        {entityLink && (
                                                            <Link href={entityLink}>
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                            </Link>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[300px]">
                                                    <p className="truncate">{request.description}</p>
                                                </TableCell>
                                                <TableCell>{request.requestedBy.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={statusVariants[request.status] || "secondary"}>
                                                        {EDIT_REQUEST_STATUS_LABELS[
                                                            request.status as keyof typeof EDIT_REQUEST_STATUS_LABELS
                                                        ] || request.status}
                                                    </Badge>
                                                </TableCell>
                                                {canReview && (
                                                    <TableCell>
                                                        {request.reviewedBy?.name || (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">Open menu</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setSelectedRequest(request);
                                                                    setAction("view");
                                                                }}
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
                                                            </DropdownMenuItem>
                                                            {canReview && request.status === "pending" && (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        onClick={() => {
                                                                            setSelectedRequest(request);
                                                                            setAction("approve");
                                                                        }}
                                                                    >
                                                                        <Check className="mr-2 h-4 w-4" />
                                                                        Approve
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive"
                                                                        onClick={() => {
                                                                            setSelectedRequest(request);
                                                                            setAction("reject");
                                                                        }}
                                                                    >
                                                                        <X className="mr-2 h-4 w-4" />
                                                                        Reject
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
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* View Details Dialog */}
            <Dialog
                open={action === "view" && !!selectedRequest}
                onOpenChange={() => {
                    setSelectedRequest(null);
                    setAction(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Request Details</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Entity Type</p>
                                    <p className="font-medium">
                                        {entityLabels[selectedRequest.entityType] || selectedRequest.entityType}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge variant={statusVariants[selectedRequest.status] || "secondary"}>
                                        {EDIT_REQUEST_STATUS_LABELS[
                                            selectedRequest.status as keyof typeof EDIT_REQUEST_STATUS_LABELS
                                        ] || selectedRequest.status}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Requested By</p>
                                    <p className="font-medium">{selectedRequest.requestedBy.name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Requested On</p>
                                    <p className="font-medium">
                                        {format(selectedRequest.createdAt, "MMM d, yyyy h:mm a")}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Description</p>
                                <p className="text-sm">{selectedRequest.description}</p>
                            </div>
                            {selectedRequest.reviewedAt && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Reviewed By</p>
                                        <p className="font-medium">
                                            {selectedRequest.reviewedBy?.name || "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Reviewed On</p>
                                        <p className="font-medium">
                                            {format(selectedRequest.reviewedAt, "MMM d, yyyy h:mm a")}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {selectedRequest.reviewNotes && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Review Notes</p>
                                    <p className="text-sm">{selectedRequest.reviewNotes}</p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedRequest(null);
                                setAction(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <Dialog
                open={action === "approve" && !!selectedRequest}
                onOpenChange={() => {
                    setSelectedRequest(null);
                    setAction(null);
                    setReviewNotes("");
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve Edit Request</DialogTitle>
                        <DialogDescription>
                            Approve this edit request from {selectedRequest?.requestedBy.name}?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Request:</p>
                            <p className="text-sm">{selectedRequest?.description}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">
                                Notes (optional):
                            </p>
                            <Textarea
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder="Add notes about this approval..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedRequest(null);
                                setAction(null);
                                setReviewNotes("");
                            }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleApprove} disabled={isSubmitting}>
                            {isSubmitting ? "Approving..." : "Approve"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog
                open={action === "reject" && !!selectedRequest}
                onOpenChange={() => {
                    setSelectedRequest(null);
                    setAction(null);
                    setReviewNotes("");
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Edit Request</DialogTitle>
                        <DialogDescription>
                            Reject this edit request from {selectedRequest?.requestedBy.name}?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Request:</p>
                            <p className="text-sm">{selectedRequest?.description}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">
                                Reason for rejection:
                            </p>
                            <Textarea
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder="Explain why this request is being rejected..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedRequest(null);
                                setAction(null);
                                setReviewNotes("");
                            }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Rejecting..." : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
