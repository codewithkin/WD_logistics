"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    ApprovalNotice,
    isPendingApproval,
} from "@/components/ui/approval-notice";
import { useSession } from "@/components/providers/session-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormDescription,
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
import { EntityPicker } from "@/components/ui/entity-picker";
import type { EntityOption } from "@/lib/entity-picker/config";
import { Loader2 } from "lucide-react";
import { createInventoryItem, updateInventoryItem } from "../actions";
import { toast } from "sonner";

const inventoryItemSchema = z.object({
    name: z.string().min(1, "Name is required"),
    sku: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    quantity: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
    minQuantity: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
    unitCost: z.coerce.number().min(0, "Cannot be negative").optional(),
    location: z.string().optional(),
    supplier: z.string().optional(),
    notes: z.string().optional(),
    defaultExpenseCategoryId: z.string().optional().nullable(),
    labelId: z.string().optional().nullable(),
});

type InventoryFormData = z.infer<typeof inventoryItemSchema>;

interface InventoryFormProps {
    item?: {
        id: string;
        name: string;
        sku: string | null;
        category: string | null;
        unit: string | null;
        quantity: number;
        minQuantity: number;
        unitCost: number | null;
        location: string | null;
        supplier: string | null;
        notes: string | null;
        defaultExpenseCategoryId: string | null;
        labelId: string | null;
    };
    /** The storeroom's labels, managed from the inventory list. */
    labels?: Array<{ id: string; name: string }>;
    /** The item's current category, so the picker shows its name immediately. */
    defaultExpenseCategory?: EntityOption | null;
    canSeeValue: boolean;
}

/** The Select's value for "no label" — a Radix item cannot have an empty value. */
const NO_LABEL = "__none__";

export function InventoryForm({
    item,
    defaultExpenseCategory,
    labels = [],
    canSeeValue,
}: InventoryFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    // Non-admins are editing a request, not the record — see
    // lib/edit-requests/gate.ts. The banner below says so, and the
    // reason travels with the change for the admin who reviews it.
    const { role } = useSession();
    const needsApproval = role !== "admin";
    const [approvalReason, setApprovalReason] = useState("");
    const [reasonError, setReasonError] = useState<string | undefined>();
    const isEditing = !!item;

    const form = useForm<InventoryFormData>({
        resolver: zodResolver(inventoryItemSchema) as any,
        defaultValues: {
            name: item?.name ?? "",
            sku: item?.sku ?? "",
            category: item?.category ?? "",
            unit: item?.unit ?? "",
            quantity: item?.quantity ?? 0,
            minQuantity: item?.minQuantity ?? 5,
            unitCost: item?.unitCost ?? 0,
            location: item?.location ?? "",
            supplier: item?.supplier ?? "",
            notes: item?.notes ?? "",
            defaultExpenseCategoryId: item?.defaultExpenseCategoryId ?? null,
            labelId: item?.labelId ?? null,
        },
    });

    const onSubmit = async (data: InventoryFormData) => {
        setIsLoading(true);
        try {
            const payload = {
                ...data,
                sku: data.sku || undefined,
                category: data.category || undefined,
                unit: data.unit || undefined,
                location: data.location || undefined,
                supplier: data.supplier || undefined,
                notes: data.notes || undefined,
                // null, not undefined: clearing the category has to reach the
                // database, or it can never be unset once chosen.
                defaultExpenseCategoryId: data.defaultExpenseCategoryId || null,
                labelId: data.labelId || null,
            };

            if (isEditing && needsApproval && approvalReason.trim().length < 5) {

                setReasonError("Give a short reason so the admin knows why.");

                setIsLoading(false);

                return;

            }

            const result = isEditing
                ? await updateInventoryItem(item.id, payload, approvalReason)
                : await createInventoryItem(payload);

            if (isPendingApproval(result)) {

                toast.success(result.message);

                // Back to the item, not to the request queue: Edit Requests is
                // admin only (ACCESS_CONTROL.md), so a supervisor filing a
                // request was being sent straight to a no-access page instead
                // of a confirmation.
                router.push(isEditing ? `/inventory/${item.id}` : "/inventory");

                return;

            }

            if (result.success) {
                toast.success(isEditing ? "Item updated successfully" : "Item created successfully");
                router.push(isEditing ? `/inventory/${item.id}` : "/inventory");
                router.refresh();
            } else {
                toast.error(result.error || "An error occurred");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Item Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Engine Oil (15W-40)" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="sku"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>SKU</FormLabel>
                                <FormControl>
                                    <Input placeholder="OIL-15W40" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {/* A managed list, not free text: "Brakes", "brakes" and
                        "Brake Parts" used to be three different categories and
                        the list page could not filter by any of them. New
                        labels are added from the Labels button on the stock
                        list. */}
                    <FormField
                        control={form.control}
                        name="labelId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Label</FormLabel>
                                <Select
                                    value={field.value ?? NO_LABEL}
                                    onValueChange={(value) =>
                                        field.onChange(value === NO_LABEL ? null : value)
                                    }
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="No label" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value={NO_LABEL}>No label</SelectItem>
                                        {labels.map((label) => (
                                            <SelectItem key={label.id} value={label.id}>
                                                {label.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    {labels.length === 0
                                        ? "No labels yet — add some with the Labels button on the stock list."
                                        : "How the shelves are organised. The stock list filters by this."}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit</FormLabel>
                                <FormControl>
                                    <Input placeholder="litre, kg, piece..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Quantity in Stock</FormLabel>
                                <FormControl>
                                    <Input type="number" min="0" step="1" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="minQuantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Low Stock Threshold</FormLabel>
                                <FormControl>
                                    <Input type="number" min="0" step="1" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* What kind of cost this item is. Taking it out of stock
                    charges this category against the truck, trailer, trip or
                    driver it went to — set it here once and nobody has to
                    decide while standing at the shelf. */}
                <FormField
                    control={form.control}
                    name="defaultExpenseCategoryId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Record its cost as</FormLabel>
                            <FormControl>
                                <EntityPicker
                                    kind="expenseCategory"
                                    value={field.value ?? undefined}
                                    onChange={(id) => field.onChange(id ?? null)}
                                    initialSelected={defaultExpenseCategory ?? undefined}
                                    placeholder="Select an expense type"
                                    clearable
                                    clearLabel="Decide each time"
                                />
                            </FormControl>
                            <FormDescription>
                                Used when this item is taken out of stock, so the cost lands on
                                the truck or trip it went to.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {canSeeValue && (
                    <FormField
                        control={form.control}
                        name="unitCost"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Cost (USD)</FormLabel>
                                <FormControl>
                                    <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Storage Location</FormLabel>
                                <FormControl>
                                    <Input placeholder="Warehouse A, Shelf 3..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="supplier"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Supplier</FormLabel>
                                <FormControl>
                                    <Input placeholder="Where this is sourced from" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Textarea className="min-h-20" placeholder="Optional notes" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {isEditing && needsApproval && (

                    <ApprovalNotice

                        value={approvalReason}

                        onChange={(value) => {

                            setApprovalReason(value);

                            setReasonError(undefined);

                        }}

                        noun="item"

                        error={reasonError}

                    />

                )}


                <div className="flex gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Update Item" : "Create Item"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
