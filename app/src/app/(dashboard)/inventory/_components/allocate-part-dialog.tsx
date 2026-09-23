"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityPicker } from "@/components/ui/entity-picker";
import type { EntityOption } from "@/lib/entity-picker/config";
import { Textarea } from "@/components/ui/textarea";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Loader2, PackageMinus } from "lucide-react";
import { allocatePart } from "../actions";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const allocateSchema = z.object({
    truckId: z.string().min(1, "Select a truck"),
    allocatedById: z.string().min(1, "Select who is allocating this"),
    quantity: z.coerce.number().int("Must be a whole number").positive("Must be greater than 0"),
    reason: z.string().optional(),
});

type AllocateFormData = z.infer<typeof allocateSchema>;

interface AllocatePartDialogProps {
    inventoryItemId: string;
    availableQuantity: number;
    unit: string | null;
    unitCost?: number | null;
    /** Money values are admin-only, same rule as the rest of the Inventory pages. */
    showValue?: boolean;
}

export function AllocatePartDialog({
    inventoryItemId,
    availableQuantity,
    unit,
    unitCost = null,
    showValue = false,
}: AllocatePartDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    // Kept so the success toast can name the truck the part went to.
    const [pickedTruck, setPickedTruck] = useState<EntityOption | null>(null);

    const form = useForm<AllocateFormData>({
        resolver: zodResolver(allocateSchema) as any,
        defaultValues: {
            truckId: "",
            allocatedById: "",
            quantity: 1,
            reason: "",
        },
    });

    const onSubmit = async (data: AllocateFormData) => {
        setIsLoading(true);
        try {
            const result = await allocatePart({
                inventoryItemId,
                ...data,
                reason: data.reason || undefined,
            });

            if (result.success) {
                // Say what actually left the warehouse, and what it was worth.
                const truck = pickedTruck?.id === data.truckId ? pickedTruck : null;
                const value = showValue && unitCost != null ? unitCost * data.quantity : null;
                toast.success(
                    `Allocated ${data.quantity} ${unit || "units"}${truck ? ` to ${truck.label}` : ""}` +
                        (value != null ? ` — ${formatCurrency(value)}` : "")
                );
                setOpen(false);
                form.reset();
                router.refresh();
            } else {
                toast.error(result.error || "Failed to allocate part");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" disabled={availableQuantity <= 0}>
                    <PackageMinus className="mr-2 h-4 w-4" />
                    Allocate to Truck
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Allocate Part</DialogTitle>
                    <DialogDescription>
                        Record this item being used on a truck. {availableQuantity} {unit || "units"} available.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="truckId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Truck</FormLabel>
                                    <FormControl>
                                        <EntityPicker
                                            kind="truck"
                                            value={field.value}
                                            onChange={(id) => field.onChange(id ?? "")}
                                            onSelect={setPickedTruck}
                                            placeholder="Select truck"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="allocatedById"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Allocated By</FormLabel>
                                    <FormControl>
                                        <EntityPicker
                                            kind="employee"
                                            value={field.value}
                                            onChange={(id) => field.onChange(id ?? "")}
                                            placeholder="Select employee"
                                            defaultFilters={{ status: "active" }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity</FormLabel>
                                    <FormControl>
                                        <Input type="number" min="1" step="1" max={availableQuantity} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea className="min-h-16" placeholder="e.g. Scheduled oil change" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Allocate
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
