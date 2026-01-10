"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { createInventoryItem, updateInventoryItem } from "../actions";
import { toast } from "sonner";

const inventorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    sku: z.string().optional(),
    category: z.string().optional(),
    quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
    minQuantity: z.coerce.number().min(0, "Min quantity cannot be negative"),
    unitCost: z.coerce.number().min(0, "Cost cannot be negative").optional(),
    location: z.string().optional(),
    supplier: z.string().optional(),
    notes: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

interface InventoryItemFormProps {
    item?: {
        id: string;
        name: string;
        sku: string | null;
        category: string | null;
        quantity: number;
        minQuantity: number;
        unitCost: number | null;
        location: string | null;
        supplier: string | null;
        notes: string | null;
    };
}

export function InventoryItemForm({ item }: InventoryItemFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!item;

    const form = useForm<InventoryFormData>({
        resolver: zodResolver(inventorySchema),
        defaultValues: {
            name: item?.name ?? "",
            sku: item?.sku ?? "",
            category: item?.category ?? "",
            quantity: item?.quantity ?? 0,
            minQuantity: item?.minQuantity ?? 5,
            unitCost: item?.unitCost ?? 0,
            location: item?.location ?? "",
            supplier: item?.supplier ?? "",
            notes: item?.notes ?? "",
        },
    });

    const onSubmit = async (data: InventoryFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateInventoryItem(item.id, data)
                : await createInventoryItem(data);

            if (result.success) {
                toast.success(isEditing ? "Item updated successfully" : "Item created successfully");
                router.push("/inventory");
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
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardContent className="grid gap-6 pt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Engine Oil 10W-40" {...field} />
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
                                            <Input placeholder="e.g., OIL-10W40-5L" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Lubricants, Tires, Parts" {...field} />
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
                                            <Input placeholder="e.g., ABC Auto Parts" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="0" {...field} />
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
                                        <FormLabel>Minimum Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="0" {...field} />
                                        </FormControl>
                                        <FormDescription>Alert when stock falls below</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="unitCost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit Cost ($)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" min="0" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Storage Location</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Warehouse A, Shelf 3" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional notes..."
                                            className="min-h-[80px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
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
                            {isEditing ? "Update Item" : "Add Item"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
