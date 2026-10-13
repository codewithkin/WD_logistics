"use client";

/**
 * The storeroom's own label list — Brakes, Filters, Oils, Tyres.
 *
 * Categories used to be free text on each item, so a fleet ended up with
 * "Brakes", "brakes" and "Brake Parts" as three different things and the list
 * page had no way to filter by any of them. The client asked for proper
 * organisation they define themselves.
 *
 * Supervisors manage these as well as admins, deliberately: a label is how the
 * people in the storeroom find a part, not a line in the chart of accounts.
 * Expense categories stay admin-only (ACCESS_CONTROL.md) — these are not the
 * same thing and the dialog does not pretend they are.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
    createInventoryLabel,
    deleteInventoryLabel,
    listInventoryLabels,
    renameInventoryLabel,
    reorderInventoryLabels,
    type InventoryLabelRow,
} from "../_actions/labels";

interface ManageLabelsDialogProps {
    /** The list as the page already loaded it, so the dialog opens filled in. */
    labels: InventoryLabelRow[];
}

export function ManageLabelsDialog({ labels: initialLabels }: ManageLabelsDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [labels, setLabels] = useState(initialLabels);
    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [busy, startTransition] = useTransition();
    const [isWorking, setIsWorking] = useState(false);

    // The page is the source of truth while the dialog is shut.
    useEffect(() => setLabels(initialLabels), [initialLabels]);

    /** Runs an action, then pulls the list back and refreshes the page behind. */
    const run = async (work: () => Promise<{ success: boolean; error?: string; message?: string }>) => {
        setIsWorking(true);
        try {
            const result = await work();
            if (!result.success) {
                toast.error(result.error || "That didn't work");
                return false;
            }
            if (result.message) toast.success(result.message);
            setLabels(await listInventoryLabels());
            startTransition(() => router.refresh());
            return true;
        } catch {
            toast.error("That didn't work");
            return false;
        } finally {
            setIsWorking(false);
        }
    };

    const add = async () => {
        const name = newName.trim();
        if (!name) return;
        if (await run(() => createInventoryLabel({ name }))) {
            setNewName("");
            toast.success(`"${name}" added`);
        }
    };

    const saveRename = async (id: string) => {
        const name = editingName.trim();
        if (!name) return;
        if (await run(() => renameInventoryLabel(id, { name }))) {
            setEditingId(null);
            toast.success("Renamed — every item carrying it reads the new name");
        }
    };

    const move = async (index: number, by: -1 | 1) => {
        const next = [...labels];
        const target = index + by;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setLabels(next);
        await run(() => reorderInventoryLabels(next.map((label) => label.id)));
    };

    const working = busy || isWorking;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Tags className="mr-2 h-4 w-4" />
                    Labels
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Stock labels</DialogTitle>
                    <DialogDescription>
                        How the shelves are organised. Renaming one renames it everywhere, and the
                        order here is the order of the filters on the list.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-2">
                    <Input
                        placeholder="New label, e.g. Brakes"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void add();
                            }
                        }}
                    />
                    <Button type="button" onClick={() => void add()} disabled={working || !newName.trim()}>
                        {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add
                    </Button>
                </div>

                <div className="max-h-72 space-y-1 overflow-y-auto">
                    {labels.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No labels yet. Add one above and items can be filed under it.
                        </p>
                    ) : (
                        labels.map((label, index) => (
                            <div
                                key={label.id}
                                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                            >
                                {editingId === label.id ? (
                                    <>
                                        <Input
                                            autoFocus
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    void saveRename(label.id);
                                                }
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                            className="h-8"
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => void saveRename(label.id)}
                                            disabled={working}
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => setEditingId(null)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm font-medium">{label.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {label.itemCount} {label.itemCount === 1 ? "item" : "items"}
                                        </span>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => void move(index, -1)}
                                            disabled={working || index === 0}
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => void move(index, 1)}
                                            disabled={working || index === labels.length - 1}
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                setEditingId(label.id);
                                                setEditingName(label.name);
                                            }}
                                            disabled={working}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => void run(() => deleteInventoryLabel(label.id))}
                                            disabled={working}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <p className="text-xs text-muted-foreground">
                    Removing a label leaves its items in stock — they simply become unlabelled.
                </p>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
