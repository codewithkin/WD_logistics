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
import { EntityPicker } from "@/components/ui/entity-picker";
import type { EntityOption } from "@/lib/entity-picker/config";
import { ArrowRight, Loader2, PackageMinus, PackagePlus } from "lucide-react";
import { addStock, takeOutStock } from "../actions";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";

export type StockDialogMode = "out" | "in";

/**
 * Where stock goes when it leaves the shelf.
 *
 * This used to be one free-text box, so "Truck ABC-1234" was a sentence and
 * nothing more: the truck's costs never moved, which is what the client
 * reported. Naming the actual record is what lets the value of the parts land
 * on it as an expense.
 */
type GoingTo = "truck" | "trailer" | "trip" | "driver" | "other";

const GOING_TO: Array<{ value: GoingTo; label: string; picker: string }> = [
    { value: "truck", label: "A truck", picker: "Select a truck" },
    { value: "trailer", label: "A trailer", picker: "Select a trailer" },
    { value: "trip", label: "A trip", picker: "Select a trip" },
    { value: "driver", label: "A driver", picker: "Select a driver" },
    { value: "other", label: "Somewhere else", picker: "" },
];

interface StockMovementDialogProps {
    mode: StockDialogMode;
    item:
        | {
              id: string;
              name: string;
              quantity: number;
              unit: string | null;
              unitCost: number | null;
              /**
               * The kind of cost this item is, set on the item itself, so the
               * common case needs no decision at the shelf.
               */
              defaultExpenseCategory?: { id: string; name: string } | null;
          }
        | null;
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
    const [goingTo, setGoingTo] = useState<GoingTo>("truck");
    const [goingToId, setGoingToId] = useState<string | null>(null);
    const [goingToLabel, setGoingToLabel] = useState("");
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultCategory: EntityOption | undefined = item?.defaultExpenseCategory
        ? { id: item.defaultExpenseCategory.id, label: item.defaultExpenseCategory.name }
        : undefined;

    useEffect(() => {
        if (open) {
            setQuantity("1");
            setDestination("");
            setReason("");
            setGoingTo("truck");
            setGoingToId(null);
            setGoingToLabel("");
            setCategoryId(item?.defaultExpenseCategory?.id ?? null);
            setError(null);
        }
    }, [open, mode, item?.id, item?.defaultExpenseCategory?.id]);

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

    // A cost only lands somewhere when we know both which record the stock went
    // to and what kind of cost it is. The dialog says which of those is missing
    // rather than taking the stock out in silence.
    const linkedToRecord = goingTo !== "other" && Boolean(goingToId);
    const willPostCost = linkedToRecord && Boolean(categoryId) && item.unitCost != null;
    const goingToConfig = GOING_TO.find((option) => option.value === goingTo)!;

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
        if (isOut && goingTo !== "other" && !goingToId) {
            setError(`${goingToConfig.picker} it is going to, or choose "Somewhere else"`);
            return;
        }
        if (isOut && goingTo === "other" && !destination.trim()) {
            setError("Say where the stock is going");
            return;
        }
        if (isOut && linkedToRecord && !categoryId) {
            setError("Choose which kind of expense this is, so the cost lands in the right place");
            return;
        }
        if (isOut && !reason.trim()) {
            setError("Say why the stock is being taken out");
            return;
        }

        setIsSubmitting(true);
        try {
            // The written destination stays readable either way — the record's
            // own label when one was picked, otherwise whatever was typed.
            const destinationText = (linkedToRecord ? goingToLabel : destination).trim();

            const result = isOut
                ? await takeOutStock({
                      inventoryItemId: item.id,
                      quantity: parsed,
                      destination: destinationText,
                      reason,
                      truckId: goingTo === "truck" ? goingToId : null,
                      trailerId: goingTo === "trailer" ? goingToId : null,
                      tripId: goingTo === "trip" ? goingToId : null,
                      driverId: goingTo === "driver" ? goingToId : null,
                      expenseCategoryId: categoryId,
                  })
                : await addStock({ inventoryItemId: item.id, quantity: parsed, source: destination, reason });

            if (result.success) {
                const valueSuffix = movementValue != null ? ` — ${formatCurrency(movementValue)}` : "";
                toast.success(
                    isOut
                        ? `Took out ${parsed} ${unit} of ${item.name}${valueSuffix}`
                        : `Added ${parsed} ${unit} of ${item.name}${valueSuffix}`
                );
                // Whether the cost actually moved used to be invisible. Say it.
                const posted =
                    "postedAmount" in result && typeof result.postedAmount === "number"
                        ? result.postedAmount
                        : null;
                if (posted != null) {
                    toast.success(
                        showValue
                            ? `${formatCurrency(posted)} recorded as a cost on ${destinationText}`
                            : `Recorded as a cost on ${destinationText}`
                    );
                } else if (isOut && linkedToRecord) {
                    toast.warning(
                        `No cost was recorded against ${destinationText} — this item has no unit cost.`
                    );
                }
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

                    {isOut ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="stock-going-to">Where is it going?</Label>
                                <Select
                                    value={goingTo}
                                    onValueChange={(value) => {
                                        setGoingTo(value as GoingTo);
                                        setGoingToId(null);
                                        setGoingToLabel("");
                                    }}
                                >
                                    <SelectTrigger id="stock-going-to">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GOING_TO.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {goingTo === "other" ? (
                                <div className="space-y-2">
                                    <Label htmlFor="stock-destination">Where exactly?</Label>
                                    <Input
                                        id="stock-destination"
                                        placeholder="e.g. Workshop, Yard, Head office"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Written down, but not charged to anything — nothing in the fleet
                                        carries this cost.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="stock-going-to-record">
                                            {goingToConfig.label.replace(/^A /, "Which ")}?
                                        </Label>
                                        <EntityPicker
                                            id="stock-going-to-record"
                                            kind={goingTo}
                                            value={goingToId}
                                            onChange={(id) => setGoingToId(id)}
                                            onSelect={(option) => setGoingToLabel(option?.label ?? "")}
                                            placeholder={goingToConfig.picker}
                                        />
                                    </div>

                                    {/* The cost of the parts lands here. Without a
                                        category there is nowhere for it to go, so the
                                        server refuses rather than moving stock and
                                        losing the money. */}
                                    <div className="space-y-2">
                                        <Label htmlFor="stock-category">Record the cost as</Label>
                                        <EntityPicker
                                            id="stock-category"
                                            kind="expenseCategory"
                                            value={categoryId}
                                            onChange={(id) => setCategoryId(id)}
                                            initialSelected={defaultCategory}
                                            placeholder="Select an expense type"
                                        />
                                        <p
                                            className={cn(
                                                "text-xs",
                                                willPostCost ? "text-muted-foreground" : "text-amber-600"
                                            )}
                                        >
                                            {willPostCost
                                                ? "Its costs go up by what this stock is worth."
                                                : item.unitCost == null
                                                  ? "This item has no unit cost, so no cost can be recorded — the stock still leaves."
                                                  : "Pick an expense type so the cost is charged to the right place."}
                                        </p>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="stock-destination">Received from (optional)</Label>
                            <Input
                                id="stock-destination"
                                placeholder="e.g. Supplier name"
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                            />
                        </div>
                    )}

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
