"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/lib/types";
import {
    assignMaintenanceRequest,
    markMaintenanceRequestFixed,
    startMaintenanceWork,
} from "../actions";

const UNASSIGNED = "unassigned";

interface MaintenanceDetailActionsProps {
    requestId: string;
    status: string;
    assignedToId: string | null;
    currentUserId: string;
    role: Role;
    /** The user currently assigned, so the picker reads as a name at once. */
    assignedTo?: { id: string; name: string; email?: string } | null;
    vehicleLabel: string;
}

export function MaintenanceDetailActions({
    requestId,
    status,
    assignedToId,
    currentUserId,
    role,
    assignedTo,
    vehicleLabel,
}: MaintenanceDetailActionsProps) {
    const router = useRouter();
    const canManage = role === "admin" || role === "supervisor";
    const isDone = status === "fixed";
    const canFix = !isDone && (canManage || assignedToId === currentUserId);

    const [assignee, setAssignee] = useState(assignedToId ?? UNASSIGNED);
    const [isAssigning, setIsAssigning] = useState(false);
    const [fixNotes, setFixNotes] = useState("");
    const [isFixing, setIsFixing] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    const run = async <T,>(
        setBusy: (busy: boolean) => void,
        fn: () => Promise<{ success: boolean; error?: string } & T>,
        successMessage: string,
        redirectTo?: string,
    ) => {
        setBusy(true);
        try {
            const result = await fn();
            if (result.success) {
                toast.success(successMessage);
                if (redirectTo) router.push(redirectTo);
                else router.refresh();
            } else {
                toast.error(result.error || "That didn't work");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setBusy(false);
        }
    };

    if (isDone && !canManage) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
                {canManage && !isDone && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Assign to a workshop user</label>
                        <EntityPicker
                            kind="user"
                            value={assignee === UNASSIGNED ? null : assignee}
                            onChange={(id) => setAssignee(id ?? UNASSIGNED)}
                            initialSelected={
                                assignedTo
                                    ? {
                                          id: assignedTo.id,
                                          label: assignedTo.name,
                                          description: assignedTo.email,
                                      }
                                    : undefined
                            }
                            clearable
                            clearLabel="Unassigned"
                            placeholder="Unassigned"
                            lockedFilters={{ role: "workshop" }}
                        />
                        <Button
                            className="w-full"
                            variant="outline"
                            disabled={isAssigning || assignee === (assignedToId ?? UNASSIGNED)}
                            onClick={() =>
                                run(
                                    setIsAssigning,
                                    () =>
                                        assignMaintenanceRequest(
                                            requestId,
                                            assignee === UNASSIGNED ? null : assignee,
                                        ),
                                    assignee === UNASSIGNED
                                        ? "Job unassigned"
                                        : "Assigned — they've been notified",
                                )
                            }
                        >
                            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save assignment
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Only users with the workshop role can be assigned. If the
                            list is empty, invite one under Users.
                        </p>
                    </div>
                )}

                {!isDone && status !== "in_progress" && (canManage || assignedToId === currentUserId) && (
                    <Button
                        className="w-full"
                        variant="secondary"
                        disabled={isStarting}
                        onClick={() =>
                            run(setIsStarting, () => startMaintenanceWork(requestId), "Marked as in progress")
                        }
                    >
                        {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Start work
                    </Button>
                )}

                {canFix && (
                    <div className="space-y-2">
                        <label htmlFor="detail-fix-notes" className="text-sm font-medium">
                            What did you do? *
                        </label>
                        <Textarea
                            id="detail-fix-notes"
                            placeholder={`e.g. Replaced the alternator on ${vehicleLabel}`}
                            value={fixNotes}
                            onChange={(e) => setFixNotes(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Required — this is the repair record the office reads later.
                        </p>
                        <Button
                            className="w-full"
                            disabled={isFixing || fixNotes.trim().length < 5}
                            onClick={() =>
                                run(
                                    setIsFixing,
                                    () => markMaintenanceRequestFixed(requestId, fixNotes),
                                    "Job closed",
                                    // A closed job is no longer visible to the
                                    // workshop, so refreshing in place would
                                    // land them on a 404 — send them back to
                                    // their task list instead.
                                    role === "workshop" ? "/maintenance" : undefined,
                                )
                            }
                        >
                            {isFixing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Mark fixed
                        </Button>
                    </div>
                )}

                {isDone && canManage && (
                    <p className="text-sm text-muted-foreground">
                        This job is closed. It stays visible to admins and supervisors, and is hidden
                        from the workshop.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
