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
import { ArrowRight, Loader2, PackageMinus, PackagePlus } from "lucide-react";
import { addStock, takeOutStock } from "../actions";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";

export type StockDialogMode = "out" | "in";

interface StockMovementDialogProps {
    mode: StockDialogMode;
    item: { id: string; name: string; quantity: number; unit: string | null; unitCost: number | null } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Money values are admin-only, same rule as the rest of the Inventory pages. */
    showValue?: boolean;
}

export function StockMovementDialog({ mode, item, open, onOpenChange, showValue = false }: StockMovementDialogProps) {
    const router = useRouter();
    const [quantity, setQuantity] = useState("1");
    const [destination, setDestination] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setQuantity("1");
            setDestination("");
            setReason("");
            setError(null);
        }
    }, [open, mode, item?.id]);

    if (!item) return null;

    const isOut = mode === "out";
    const unit = item.unit || "units";
    const parsed = Number(quantity);
    const isWholeNumber = Number.isInteger(parsed) && parsed > 0;
    const resulting = isWholeNumber ? item.quantity + (isOut ? -parsed : parsed) : null;
    const exceedsStock = isOut && isWholeNumber && parsed > item.quantity;
    // What this movement is worth, so "18 L out" also reads as "-$55.00".
    const movementValue =
        showValue && item.unitCost != null && isWholeNumber ? item.unitCost * parsed : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isWholeNumber) {
            setError("Enter a whole number greater than zero");
            return;
        }
        if (exceedsStock) {
            setError(`Only ${item.quantity} ${unit} in stock`);
            return;
        }
        if (isOut && !destination.trim()) {
            setError("Say where the stock is going");
            return;
        }
        if (isOut && !reason.trim()) {
            setError("Say why the stock is being taken out");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = isOut
                ? await takeOutStock({ inventoryItemId: item.id, quantity: parsed, destination, reason })
                : await addStock({ inventoryItemId: item.id, quantity: parsed, source: destination, reason });

            if (result.success) {
                const valueSuffix = movementValue != null ? ` — ${formatCurrency(movementValue)}` : "";
                toast.success(
                    isOut
                        ? `Took out ${parsed} ${unit} of ${item.name}${valueSuffix}`
                        : `Added ${parsed} ${unit} of ${item.name}${valueSuffix}`
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

    const Icon = isOut ? PackageMinus : PackagePlus;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span
                            className="p-1.5 rounded-lg"
                            style={{
                                background: isOut
                                    ? "linear-gradient(to bottom right, #f59e0b, #f97316)"
                                    : "linear-gradient(to bottom right, #22c55e, #10b981)",
                            }}
                        >
                            <Icon className="h-4 w-4 text-white" />
                        </span>
                        {isOut ? "Take Out Stock" : "Add Stock"}
                    </DialogTitle>
                    <DialogDescription>{item.name}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/60 py-3 text-sm">
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground">In stock now</div>
                            <div className="text-lg font-semibold">
                                {item.quantity} <span className="text-sm font-normal">{unit}</span>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground">After this</div>
                            <div
                                className={cn(
                                    "text-lg font-semibold",
                                    resulting === null || exceedsStock
                                        ? "text-muted-foreground"
                                        : isOut
                                          ? "text-amber-600"
                                          : "text-green-600"
                                )}
                            >
                                {resulting === null || exceedsStock ? "—" : resulting}{" "}
                                <span className="text-sm font-normal">{unit}</span>
                            </div>
                        </div>
                    </div>

                    {showValue && (
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">
                                {isOut ? "Value going out" : "Value coming in"}
                            </span>
                            {movementValue == null || exceedsStock ? (
                                <span className="text-muted-foreground">
                                    {item.unitCost == null ? "No unit cost recorded" : "—"}
                                </span>
                            ) : (
                                <span className={cn("font-semibold", isOut ? "text-amber-600" : "text-green-600")}>
                                    {isOut ? "−" : "+"}
                                    {formatCurrency(movementValue)}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="stock-quantity">Quantity ({unit})</Label>
                        <Input
                            id="stock-quantity"
                            type="number"
                            min={1}
                            step={1}
                            max={isOut ? item.quantity : undefined}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="stock-destination">
                            {isOut ? "Where is it going?" : "Received from (optional)"}
                        </Label>
                        <Input
                            id="stock-destination"
                            placeholder={isOut ? "e.g. Workshop, Truck ABC-1234, Yard" : "e.g. Supplier name"}
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="stock-reason">{isOut ? "Why?" : "Notes (optional)"}</Label>
                        <Textarea
                            id="stock-reason"
                            className="min-h-16"
                            placeholder={isOut ? "e.g. Oil top-up during service" : "e.g. Invoice #1042"}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || (isOut && item.quantity === 0)}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isOut ? "Take Out" : "Add Stock"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
