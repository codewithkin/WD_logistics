"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Trash2 } from "lucide-react";
import { wipeAllData } from "../actions";
import { toast } from "sonner";

// Must match what wipeAllData checks server-side: the typed phrase is the
// confirmation, not just a client-side gate on the button.
const CONFIRM_WORD = "DELETE ALL DATA";

export function DangerZone() {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [isWiping, setIsWiping] = useState(false);

    const handleWipe = async () => {
        setIsWiping(true);
        try {
            const result = await wipeAllData(confirmText);
            if (result.success) {
                toast.success(
                    `System reset — ${result.deleted} records removed` +
                        (result.usersRemoved
                            ? `, including ${result.usersRemoved} ${result.usersRemoved === 1 ? "account" : "accounts"}`
                            : "") +
                        ".",
                );
                // Said separately rather than buried in the line above: this
                // is the one part that can fail on its own, and an admin who
                // thinks the assistant has forgotten last month's
                // conversations when it has not should hear about it.
                if (result.assistantMemoryCleared === false) {
                    toast.warning(
                        "Everything else is gone, but the assistant's memory could not be cleared. Restart the agent and try again.",
                    );
                }
                setDialogOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to wipe data");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsWiping(false);
            setConfirmText("");
        }
    };

    return (
        <Card className="mt-6 border-destructive/40">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Danger Zone
                </CardTitle>
                <CardDescription>
                    Empty the system and start again. This permanently deletes every trip,
                    truck, trailer, driver, customer, supplier, invoice, payment, expense,
                    stock item, employee, report, notification and edit request — along with
                    every other user account, every contact allowed to use the WhatsApp
                    assistant, and everything the assistant remembers. The three accounts
                    come back at zero.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                        <p className="text-foreground font-medium mb-1">What stays?</p>
                        <p>
                            Your organisation and its settings — the letterhead, bank details
                            and VAT number — <strong>your own account, and nobody else&apos;s</strong>.
                            The WhatsApp line stays paired; the assistant simply will not know
                            anyone until you add them again. A standard set of expense
                            categories is put back, so an expense can be recorded on the first
                            day — rename or delete the ones that do not suit you.
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => setDialogOpen(true)}
                        className="shrink-0"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Reset Everything
                    </Button>
                </div>
            </CardContent>

            <AlertDialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setConfirmText("");
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                            Reset the whole system?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Every trip, truck, trailer, driver, customer, supplier, invoice,
                            payment, expense, stock item, employee, report, notification and
                            edit request will be permanently deleted.
                            <br />
                            <br />
                            <strong>Everyone else loses their account.</strong> Supervisors,
                            staff and workshop users are removed and will be signed out;
                            you will need to invite the real team afterwards. The assistant
                            forgets every conversation and every number allowed to use it.
                            <br />
                            <br />
                            This action <strong>cannot be undone</strong>. Type{" "}
                            <strong>{CONFIRM_WORD}</strong> to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={CONFIRM_WORD}
                        disabled={isWiping}
                        autoFocus
                        className="mt-2"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isWiping}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleWipe}
                            disabled={confirmText !== CONFIRM_WORD || isWiping}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isWiping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isWiping ? "Resetting..." : "Yes, reset everything"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}