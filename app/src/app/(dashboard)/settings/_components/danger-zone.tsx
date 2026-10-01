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
                        ". Only the seeded administrator account remains.",
                );
                if (!result.whatsappTold) {
                    toast.warning(
                        "The stored WhatsApp pairing was cleared, but WhatsApp may still list this device. Remove it under Linked Devices, then scan a new QR code to reconnect.",
                    );
                } else {
                    toast.info(
                        "WhatsApp was unpaired. Scan a new QR code under Settings → WhatsApp to reconnect.",
                    );
                }
                if (result.fileDeletionFailures > 0) {
                    toast.warning(
                        `${result.fileDeletionFailures} uploaded file(s) could not be deleted from storage. Review the server logs and remove them manually if needed.`,
                    );
                }
                setDialogOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to reset data");
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
                    Permanently remove all operational records, users, company profile and settings,
                    accounts, categories, notifications, invitations, WhatsApp contacts and
                    conversation history for this organisation. Only the seeded administrator
                    account remains. The organisation’s required login shell remains, but its
                    profile is blank. The WhatsApp device will be unpaired and must be scanned
                    again before messaging can resume.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                        <p className="text-foreground font-medium mb-1">What stays?</p>
                        <p>
                            Only the seeded administrator account and the minimal organisation
                            record required for sign-in. The administrator must invite the team,
                            rebuild the company profile and settings, and pair WhatsApp again.
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

            <AlertDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setConfirmText("");
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                            Reset the whole organisation?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Every operational record, company profile field, account, category and
                            non-seeded user account will be permanently deleted. The seeded admin
                            account is the only account that remains; the organisation record
                            remains only so that account can sign in.
                            <br />
                            <br />
                            The WhatsApp device will be logged out and unpaired. You will need to
                            scan a new QR code to reconnect it. If WhatsApp cannot be reached,
                            this reset will stop before any data is deleted.
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
