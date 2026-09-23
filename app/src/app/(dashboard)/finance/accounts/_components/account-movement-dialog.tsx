"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Loader2 } from "lucide-react";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/accounts";
import { formatCurrency, cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { recordAccountMovementAction } from "../actions";
import { toast } from "sonner";

export type MovementDirection = "deposit" | "withdrawal";

interface AccountMovementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialAccount?: AccountType;
    initialDirection?: MovementDirection;
    balances: Record<string, number>;
}

export function AccountMovementDialog({
    open,
    onOpenChange,
    initialAccount = "petty_cash",
    initialDirection = "deposit",
    balances,
}: AccountMovementDialogProps) {
    const router = useRouter();
    const [direction, setDirection] = useState<MovementDirection>(initialDirection);
    const [accountType, setAccountType] = useState<AccountType>(initialAccount);
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setDirection(initialDirection);
            setAccountType(initialAccount);
            setAmount("");
            setDescription("");
            setError(null);
        }
    }, [open, initialAccount, initialDirection]);

    // Recording money *into* an account is the one movement with no paper
    // trail behind it, so it is admin-only; money out stays with supervisors.
    const { role } = useSession();
    const canRecordMoneyIn = role === "admin";
    const isIn = canRecordMoneyIn && direction === "deposit";

    // A supervisor who opened the dialog on the deposit tab is moved off it.
    useEffect(() => {
        if (!canRecordMoneyIn && direction === "deposit") {
            setDirection("withdrawal");
        }
    }, [canRecordMoneyIn, direction]);
    const currentBalance = balances[accountType] ?? 0;
    const parsed = Number(amount);
    const validAmount = amount !== "" && parsed > 0;
    const resulting = validAmount ? currentBalance + (isIn ? parsed : -parsed) : null;
    const overdraws = !isIn && resulting !== null && resulting < 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validAmount) {
            setError("Enter an amount greater than zero");
            return;
        }
        if (overdraws) {
            setError(`${ACCOUNT_TYPE_LABELS[accountType]} only has ${formatCurrency(currentBalance)}`);
            return;
        }
        if (description.trim().length < 3) {
            setError("Add a short note saying what this money is for");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await recordAccountMovementAction({
                accountType,
                direction,
                amount: parsed,
                description,
            });
            if (result.success) {
                toast.success(
                    `${formatCurrency(parsed)} ${isIn ? "added to" : "taken out of"} ${ACCOUNT_TYPE_LABELS[accountType]}`
                );
                onOpenChange(false);
                router.refresh();
            } else {
                setError(result.error || "Something went wrong");
            }
        } catch {
            setError("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Record Money In / Out</DialogTitle>
                    <DialogDescription>
                        Keeps a paper trail of cash handed over or taken out, with who recorded it.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Money in is admin-only (see finance/accounts/actions.ts).
                        Hiding the option rather than letting it fail keeps the
                        dialog honest, and the server refuses it regardless. */}
                    <div className={cn("grid gap-2", canRecordMoneyIn ? "grid-cols-2" : "grid-cols-1")}>
                        {canRecordMoneyIn && (
                        <button
                            type="button"
                            onClick={() => setDirection("deposit")}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors",
                                isIn
                                    ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                                    : "border-border text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <ArrowDownLeft className="h-4 w-4" />
                            Money in
                        </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setDirection("withdrawal")}
                            className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors",
                                !isIn
                                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                    : "border-border text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <ArrowUpRight className="h-4 w-4" />
                            Money out
                        </button>
                    </div>

                    <div className="space-y-2">
                        <Label>Account</Label>
                        <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ACCOUNT_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {ACCOUNT_TYPE_LABELS[type]} · {formatCurrency(balances[type] ?? 0)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="movement-amount">Amount (USD)</Label>
                        <Input
                            id="movement-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/60 py-3 text-sm">
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground">Balance now</div>
                            <div className="font-semibold">{formatCurrency(currentBalance)}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground">After this</div>
                            <div
                                className={cn(
                                    "font-semibold",
                                    resulting === null
                                        ? "text-muted-foreground"
                                        : overdraws
                                          ? "text-destructive"
                                          : isIn
                                            ? "text-green-600"
                                            : "text-amber-600"
                                )}
                            >
                                {resulting === null ? "—" : formatCurrency(resulting)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="movement-description">What is this for?</Label>
                        <Textarea
                            id="movement-description"
                            className="min-h-16"
                            placeholder={
                                isIn
                                    ? "e.g. Petty cash float handed to Tendai by Mr Dziruni"
                                    : "e.g. Cash taken out for fuel advance, trip to Beitbridge"
                            }
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className={cn(!isIn && "bg-amber-500 hover:bg-amber-600 text-white")}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isIn ? "Record Money In" : "Record Money Out"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
