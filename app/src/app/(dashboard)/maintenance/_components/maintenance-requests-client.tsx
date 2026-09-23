"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { Role } from "@/lib/types";
import { createMaintenanceRequest, markMaintenanceRequestFixed } from "../actions";
import { toast } from "sonner";
import { format } from "date-fns";

const UNASSIGNED = "unassigned";

const requestSchema = z.object({
    vehicleType: z.enum(["truck", "trailer"]),
    vehicleId: z.string().min(1, "Select a vehicle"),
    notes: z.string().min(1, "Describe the issue"),
    date: z.string().min(1, "Date is required"),
    assignedToId: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface VehicleRef {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
}

interface MaintenanceRequest {
    id: string;
    notes: string;
    date: Date;
    status: string;
    fixedNotes: string | null;
    fixedAt: Date | null;
    truck: VehicleRef | null;
    trailer: VehicleRef | null;
    reportedBy: { name: string };
    fixedBy: { name: string } | null;
    assignedTo: { id: string; name: string } | null;
}

interface WorkshopMember {
    id: string;
    name: string;
    email: string;
}

interface MaintenanceRequestsClientProps {
    requests: MaintenanceRequest[];
    trucks: VehicleRef[];
    trailers: VehicleRef[];
    workshopMembers: WorkshopMember[];
    role: Role;
    currentUserId: string;
}

export function MaintenanceRequestsClient({
    requests,
    trucks,
    trailers,
    workshopMembers,
    role,
    currentUserId,
}: MaintenanceRequestsClientProps) {
    const router = useRouter();
    const canLogIssue = role === "admin" || role === "supervisor";
    const isWorkshop = role === "workshop";
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fixingId, setFixingId] = useState<string | null>(null);
    const [fixNotes, setFixNotes] = useState("");
    const [isFixing, setIsFixing] = useState(false);

    const form = useForm<RequestFormData>({
        resolver: zodResolver(requestSchema),
        defaultValues: {
            vehicleType: "truck",
            vehicleId: "",
            notes: "",
            date: new Date().toISOString().split("T")[0],
            assignedToId: UNASSIGNED,
        },
    });

    const vehicleType = form.watch("vehicleType");
    const vehicles = vehicleType === "trailer" ? trailers : trucks;

    // Workshop's list is already filtered server-side to their own unfinished
    // jobs, so the status dropdown only makes sense for the office.
    const filteredRequests = isWorkshop
        ? requests
        : requests.filter((r) =>
              statusFilter === "all"
                  ? true
                  : statusFilter === "open"
                    ? r.status !== "fixed"
                    : r.status === statusFilter,
          );

    const onCreate = async (data: RequestFormData) => {
        setIsSubmitting(true);
        try {
            const result = await createMaintenanceRequest({
                vehicleType: data.vehicleType,
                vehicleId: data.vehicleId,
                notes: data.notes,
                date: new Date(data.date),
                assignedToId: data.assignedToId === UNASSIGNED ? null : data.assignedToId,
            });
            if (result.success) {
                toast.success("Maintenance issue logged");
                setIsCreateOpen(false);
                form.reset();
                router.refresh();
            } else {
                toast.error(result.error || "Failed to log issue");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMarkFixed = async () => {
        if (!fixingId) return;
        setIsFixing(true);
        try {
            const result = await markMaintenanceRequestFixed(fixingId, fixNotes);
            if (result.success) {
                toast.success("Marked as fixed");
                setFixingId(null);
                setFixNotes("");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update request");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsFixing(false);
        }
    };

    const vehicleCell = (request: MaintenanceRequest) => {
        if (request.truck) {
            return (
                <Link
                    href={`/fleet/trucks/${request.truck.id}`}
                    className="text-primary hover:underline"
                >
                    {request.truck.registrationNo}
                </Link>
            );
        }
        if (request.trailer) {
            return (
                <span className="flex flex-col">
                    <Link
                        href={`/fleet/trailers/${request.trailer.id}`}
                        className="text-primary hover:underline"
                    >
                        {request.trailer.registrationNo}
                    </Link>
                    <span className="text-xs text-muted-foreground">Trailer</span>
                </span>
            );
        }
        return <span className="text-muted-foreground">Removed</span>;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {!isWorkshop ? (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="open">Open (not yet fixed)</SelectItem>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <span />
                )}

                {canLogIssue && (
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Log Issue
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Log Maintenance Issue</DialogTitle>
                                <DialogDescription>
                                    Report a truck or trailer issue for the workshop to resolve.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="vehicleType"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Vehicle type</FormLabel>
                                                <Select
                                                    onValueChange={(value) => {
                                                        field.onChange(value);
                                                        // The two lists are different records —
                                                        // clear the selection or the form would
                                                        // submit a truck id against a trailer.
                                                        form.setValue("vehicleId", "");
                                                    }}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="truck">Truck</SelectItem>
                                                        <SelectItem value="trailer">Trailer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="vehicleId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {vehicleType === "trailer" ? "Trailer" : "Truck"}
                                                </FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                placeholder={`Select ${vehicleType}`}
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {vehicles.length === 0 ? (
                                                            <div className="px-2 py-3 text-sm text-muted-foreground">
                                                                No {vehicleType}s on record yet.
                                                            </div>
                                                        ) : (
                                                            vehicles.map((vehicle) => (
                                                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                                                    {vehicle.registrationNo} - {vehicle.make}{" "}
                                                                    {vehicle.model}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    The day the job is scheduled for — it shows on the
                                                    worker&apos;s task list for that date.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="assignedToId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Assign to</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Leave unassigned" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value={UNASSIGNED}>
                                                            Leave unassigned
                                                        </SelectItem>
                                                        {workshopMembers.map((member) => (
                                                            <SelectItem key={member.id} value={member.id}>
                                                                {member.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>
                                                    {workshopMembers.length === 0
                                                        ? "No workshop users yet — invite one under Users."
                                                        : "Only workshop users appear here. They get a notification straight away."}
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Notes</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Describe the issue..."
                                                        className="min-h-25"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Log Issue
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Issue</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Fixed by / Assigned to</TableHead>
                                    <TableHead>Work done</TableHead>
                                    <TableHead>Reported by</TableHead>
                                    <TableHead className="w-[160px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            {isWorkshop
                                                ? "Nothing assigned to you right now."
                                                : "No maintenance requests found"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => {
                                        const canFix =
                                            request.status !== "fixed" &&
                                            (!isWorkshop || request.assignedTo?.id === currentUserId);

                                        return (
                                            <TableRow key={request.id}>
                                                <TableCell className="font-medium">
                                                    {vehicleCell(request)}
                                                </TableCell>
                                                <TableCell>{format(request.date, "PPP")}</TableCell>
                                                <TableCell className="max-w-xs">
                                                    <Link
                                                        href={`/maintenance/${request.id}`}
                                                        className="line-clamp-2 hover:underline"
                                                        title={request.notes}
                                                    >
                                                        {request.notes}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={request.status} type="maintenance" />
                                                </TableCell>
                                                <TableCell>
                                                    {request.fixedBy ? (
                                                        <span className="flex flex-col">
                                                            <span>{request.fixedBy.name}</span>
                                                            {request.fixedAt && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {format(request.fixedAt, "d MMM yyyy")}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : request.assignedTo ? (
                                                        <span className="flex flex-col">
                                                            <span>{request.assignedTo.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                assigned
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Unassigned</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-xs">
                                                    {request.fixedNotes ? (
                                                        <span
                                                            className="line-clamp-2 text-sm"
                                                            title={request.fixedNotes}
                                                        >
                                                            {request.fixedNotes}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{request.reportedBy.name}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button asChild size="sm" variant="ghost">
                                                            <Link href={`/maintenance/${request.id}`}>View</Link>
                                                        </Button>
                                                        {canFix && (
                                                            <Dialog
                                                                open={fixingId === request.id}
                                                                onOpenChange={(open) => {
                                                                    setFixingId(open ? request.id : null);
                                                                    setFixNotes("");
                                                                }}
                                                            >
                                                                <DialogTrigger asChild>
                                                                    <Button size="sm" variant="outline">
                                                                        Mark Fixed
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Mark as Fixed</DialogTitle>
                                                                        <DialogDescription>
                                                                            {request.truck?.registrationNo ??
                                                                                request.trailer?.registrationNo}{" "}
                                                                            — this notifies the office and whoever
                                                                            logged it.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="space-y-2">
                                                                        <label
                                                                            htmlFor="fix-notes"
                                                                            className="text-sm font-medium"
                                                                        >
                                                                            What did you do? *
                                                                        </label>
                                                                        <Textarea
                                                                            id="fix-notes"
                                                                            placeholder="e.g. Replaced front brake pads and bled the system"
                                                                            value={fixNotes}
                                                                            onChange={(e) => setFixNotes(e.target.value)}
                                                                        />
                                                                        <p className="text-xs text-muted-foreground">
                                                                            This is the record of the repair — the
                                                                            office reads it on the job and in the
                                                                            truck&apos;s history.
                                                                        </p>
                                                                    </div>
                                                                    <DialogFooter>
                                                                        <Button
                                                                            onClick={handleMarkFixed}
                                                                            disabled={isFixing || fixNotes.trim().length < 5}
                                                                        >
                                                                            {isFixing && (
                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                            )}
                                                                            Confirm Fixed
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        )}
                                                    </div>
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
        </div>
    );
}
