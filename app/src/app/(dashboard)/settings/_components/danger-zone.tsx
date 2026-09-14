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

const CONFIRM_WORD = "WIPE";

export function DangerZone() {
    const router = useRouter();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [isWiping, setIsWiping] = useState(false);

    const handleWipe = async () => {
        setIsWiping(true);
        try {
            const result = await wipeAllData();
            if (result.success) {
                toast.success(`All operational data wiped (${result.deleted} records removed)`);
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
                    Wipe all operational data from this system. This permanently deletes trips,
                    trucks, drivers, customers, suppliers, invoices, payments, expenses,
                    inventory, reports, notifications and edit requests.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                        <p className="text-foreground font-medium mb-1">What stays?</p>
                        <p>
                            Your organization, all users/members (including you), and all
                            employee records are <strong>not</strong> affected.
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => setDialogOpen(true)}
                        className="shrink-0"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Wipe All Data
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
                            Wipe all operational data?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete every trip, truck, driver, customer,
                            supplier, invoice, payment, expense, inventory item, report,
                            notification and edit request. Employees and user accounts are kept.
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
                            {isWiping ? "Wiping..." : "Yes, Wipe Everything"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}