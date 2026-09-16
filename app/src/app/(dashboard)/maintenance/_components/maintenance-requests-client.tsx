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
import { Badge } from "@/components/ui/badge";
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
import { Plus, Wrench, CheckCircle2, Loader2 } from "lucide-react";
import { Role } from "@/lib/types";
import { createMaintenanceRequest, markMaintenanceRequestFixed } from "../actions";
import { toast } from "sonner";
import { format } from "date-fns";

const requestSchema = z.object({
    truckId: z.string().min(1, "Select a truck"),
    notes: z.string().min(1, "Describe the issue"),
    date: z.string().min(1, "Date is required"),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface MaintenanceRequest {
    id: string;
    notes: string;
    date: Date;
    status: string;
    fixedNotes: string | null;
    fixedAt: Date | null;
    truck: { id: string; registrationNo: string; make: string; model: string };
    reportedBy: { name: string };
    fixedBy: { name: string } | null;
}

interface Truck {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
}

interface MaintenanceRequestsClientProps {
    requests: MaintenanceRequest[];
    trucks: Truck[];
    role: Role;
}

export function MaintenanceRequestsClient({ requests, trucks, role }: MaintenanceRequestsClientProps) {
    const router = useRouter();
    const canLogIssue = role === "admin" || role === "supervisor";
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fixingId, setFixingId] = useState<string | null>(null);
    const [fixNotes, setFixNotes] = useState("");
    const [isFixing, setIsFixing] = useState(false);

    const form = useForm<RequestFormData>({
        resolver: zodResolver(requestSchema),
        defaultValues: {
            truckId: "",
            notes: "",
            date: new Date().toISOString().split("T")[0],
        },
    });

    const filteredRequests = requests.filter(
        (r) => statusFilter === "all" || r.status === statusFilter
    );

    const onCreate = async (data: RequestFormData) => {
        setIsSubmitting(true);
        try {
            const result = await createMaintenanceRequest({
                truckId: data.truckId,
                notes: data.notes,
                date: new Date(data.date),
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
            const result = await markMaintenanceRequestFixed(fixingId, fixNotes || undefined);
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                </Select>

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
                                    Report a truck issue for the workshop to resolve.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="truckId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Truck</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select truck" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {trucks.map((truck) => (
                                                            <SelectItem key={truck.id} value={truck.id}>
                                                                {truck.registrationNo} - {truck.make} {truck.model}
                                                            </SelectItem>
                                                        ))}
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
                                    <TableHead>Truck</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reported By</TableHead>
                                    <TableHead className="w-[120px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No maintenance requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRequests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell className="font-medium">
                                                <Link
                                                    href={`/fleet/trucks/${request.truck.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {request.truck.registrationNo}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{format(request.date, "PPP")}</TableCell>
                                            <TableCell className="max-w-xs truncate">{request.notes}</TableCell>
                                            <TableCell>
                                                {request.status === "fixed" ? (
                                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        Fixed
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                        <Wrench className="mr-1 h-3 w-3" />
                                                        Open
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{request.reportedBy.name}</TableCell>
                                            <TableCell>
                                                {request.status === "open" && (
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
                                                                    {request.truck.registrationNo} — this notifies admin and supervisor.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <Textarea
                                                                placeholder="What was done (optional)..."
                                                                value={fixNotes}
                                                                onChange={(e) => setFixNotes(e.target.value)}
                                                            />
                                                            <DialogFooter>
                                                                <Button onClick={handleMarkFixed} disabled={isFixing}>
                                                                    {isFixing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                    Confirm Fixed
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
