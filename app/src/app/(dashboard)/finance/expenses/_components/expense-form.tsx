"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EntityPicker, EntityMultiPicker } from "@/components/ui/entity-picker";
import type { EntityOption } from "@/lib/entity-picker/config";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExpense, updateExpense, type ExpenseFormData } from "../actions";
import { Loader2, Truck, Container, User, MapPin, AlertCircle, Building2 } from "lucide-react";
import { showAlert } from "@/components/ui/custom-alert";
import { toast } from "sonner";

const expenseSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    // The amount <Input type="number"> hands react-hook-form a raw string on
    // every keystroke — plain z.number() rejected it outright ("Expected
    // number, received string"), which is why this field always errored.
    // z.coerce.number() converts before validating, matching the pattern
    // already used correctly in operations/expenses/_components/expense-form.tsx.
    amount: z.coerce.number().positive("Amount must be positive"),
    date: z.date(),
    notes: z.string().optional(),
    isBusinessExpense: z.boolean(),
    supplierId: z.string().optional(),
    truckIds: z.array(z.string()).optional(),
    trailerIds: z.array(z.string()).optional(),
    tripIds: z.array(z.string()).optional(),
    driverIds: z.array(z.string()).optional(),
}).refine(
    (data) => {
        // Business expenses don't need truck/trailer/trip/driver association
        if (data.isBusinessExpense) {
            return true;
        }
        const hasTruck = data.truckIds && data.truckIds.length > 0;
        const hasTrailer = data.trailerIds && data.trailerIds.length > 0;
        const hasTrip = data.tripIds && data.tripIds.length > 0;
        const hasDriver = data.driverIds && data.driverIds.length > 0;
        return hasTruck || hasTrailer || hasTrip || hasDriver;
    },
    {
        message: "You must associate this expense with at least one truck, trailer, trip, or driver",
        path: ["truckIds"], // This will show the error on the associations section
    }
);

interface ExpenseFormProps {
    /**
     * Labels for the records this expense is already linked to, so the pickers
     * show names rather than ids before their first fetch. Everything else the
     * pickers look up themselves.
     */
    initialSelected?: {
        category?: EntityOption;
        supplier?: EntityOption;
        trucks?: EntityOption[];
        trailers?: EntityOption[];
        trips?: EntityOption[];
        drivers?: EntityOption[];
    };
    expense?: {
        id: string;
        categoryId: string;
        amount: number;
        date: Date;
        vendor: string | null;
        reference: string | null;
        notes: string | null;
        receiptUrl: string | null;
        isBusinessExpense: boolean;
        supplierId: string | null;
        truckExpenses: Array<{ truckId: string }>;
        trailerExpenses?: Array<{ trailerId: string }>;
        tripExpenses: Array<{ tripId: string }>;
        driverExpenses: Array<{ driverId: string }>;
    };
    prefilledTripId?: string;
    prefilledTruckId?: string;
    prefilledDriverId?: string;
    prefilledSupplierId?: string;
    prefilledIsBusinessExpense?: boolean;
}

export function ExpenseForm({ initialSelected, expense, prefilledTripId, prefilledTruckId, prefilledDriverId, prefilledSupplierId, prefilledIsBusinessExpense }: ExpenseFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof expenseSchema>>({
        // `as any` because z.coerce.number() on `amount` makes the schema's
        // input type (unknown) differ from its output type (number), which
        // zodResolver's generics reject. Same cast as report-generator.tsx.
        resolver: zodResolver(expenseSchema) as any,
        defaultValues: {
            categoryId: expense?.categoryId || "",
            amount: expense?.amount || 0,
            date: expense?.date || new Date(),
            notes: expense?.notes || "",
            isBusinessExpense: expense?.isBusinessExpense ?? prefilledIsBusinessExpense ?? false,
            supplierId: expense?.supplierId || prefilledSupplierId || "",
            truckIds: expense?.truckExpenses.map(te => te.truckId) || (prefilledTruckId ? [prefilledTruckId] : []),
            trailerIds: expense?.trailerExpenses?.map(te => te.trailerId) || [],
            tripIds: expense?.tripExpenses.map(te => te.tripId) || (prefilledTripId ? [prefilledTripId] : []),
            driverIds: expense?.driverExpenses?.map(de => de.driverId) || (prefilledDriverId ? [prefilledDriverId] : []),
        },
    });

    // Watch for business expense toggle
    const isBusinessExpense = form.watch("isBusinessExpense");

    // Watch for association changes to clear errors
    const truckIds = form.watch('truckIds');
    const tripIds = form.watch('tripIds');
    const driverIds = form.watch('driverIds');

    const hasAssociation = isBusinessExpense || (truckIds && truckIds.length > 0) ||
        (tripIds && tripIds.length > 0) ||
        (driverIds && driverIds.length > 0);

    // Clear associations when switching to business expense
    useEffect(() => {
        if (isBusinessExpense) {
            form.setValue('truckIds', []);
            form.setValue('tripIds', []);
            form.setValue('driverIds', []);
        } else {
            form.setValue('supplierId', '');
        }
    }, [isBusinessExpense, form]);

    const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
        setIsSubmitting(true);
        try {
            const data: ExpenseFormData = {
                categoryId: values.categoryId,
                amount: values.amount,
                date: values.date,
                notes: values.notes,
                isBusinessExpense: values.isBusinessExpense,
                supplierId: values.isBusinessExpense ? values.supplierId : undefined,
                truckIds: values.isBusinessExpense ? [] : values.truckIds,
                trailerIds: values.isBusinessExpense ? [] : values.trailerIds,
                tripIds: values.isBusinessExpense ? [] : values.tripIds,
                driverIds: values.isBusinessExpense ? [] : values.driverIds,
            };

            const result = expense
                ? await updateExpense(expense.id, data)
                : await createExpense(data);

            if (result.success) {
                toast.success(expense ? "Expense updated successfully" : "Expense created successfully");
                router.push("/finance/expenses");
            } else {
                showAlert(result.error || "Failed to save expense");
            }
        } catch (error) {
            console.error("Failed to save expense:", error);
            showAlert(error instanceof Error ? error.message : "Failed to save expense");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category *</FormLabel>
                                <FormControl>
                                    <EntityPicker
                                        kind="expenseCategory"
                                        value={field.value}
                                        onChange={(id) => field.onChange(id ?? "")}
                                        initialSelected={initialSelected?.category}
                                        placeholder="Select category"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Association Selection - Required */}
                <div className="space-y-4">
                    {/* Business Expense Toggle */}
                    <FormField
                        control={form.control}
                        name="isBusinessExpense"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Business Expense
                                    </FormLabel>
                                    <FormDescription>
                                        Toggle this if this is a general business expense (not tied to a specific truck, trip, or driver)
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {/* Supplier Selection - Only show for business expenses */}
                    {isBusinessExpense && (
                        <FormField
                            control={form.control}
                            name="supplierId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Supplier
                                    </FormLabel>
                                    <FormControl>
                                        <EntityPicker
                                            kind="supplier"
                                            value={field.value ?? null}
                                            onChange={(id) => field.onChange(id ?? undefined)}
                                            initialSelected={initialSelected?.supplier}
                                            clearable
                                            clearLabel="No supplier"
                                            placeholder="Select supplier (optional)"
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Optionally associate this expense with a supplier to track amounts owed
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {/* Association Section - Only show for non-business expenses */}
                    {!isBusinessExpense && (
                        <>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium">Associate Expense With *</h3>
                                {!hasAssociation && form.formState.isSubmitted && (
                                    <span className="text-sm text-destructive flex items-center gap-1">
                                        <AlertCircle className="h-4 w-4" />
                                        Select at least one
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground -mt-2">
                                You must associate this expense with at least one truck, trip, or driver
                            </p>
                        </>
                    )}

                    {!isBusinessExpense && (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                            <FormField
                                control={form.control}
                                name="truckIds"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="flex items-center gap-2">
                                            <Truck className="h-4 w-4" />
                                            Truck
                                        </FormLabel>
                                        <FormControl>
                                            <EntityMultiPicker
                                                kind="truck"
                                                value={field.value ?? []}
                                                onChange={field.onChange}
                                                initialSelected={initialSelected?.trucks}
                                                placeholder="Select trucks"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="trailerIds"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="flex items-center gap-2">
                                            <Container className="h-4 w-4" />
                                            Trailer
                                        </FormLabel>
                                        <FormControl>
                                            <EntityMultiPicker
                                                kind="trailer"
                                                value={field.value ?? []}
                                                onChange={field.onChange}
                                                initialSelected={initialSelected?.trailers}
                                                placeholder="Select trailers"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="tripIds"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Trip
                                        </FormLabel>
                                        <FormControl>
                                            <EntityMultiPicker
                                                kind="trip"
                                                value={field.value ?? []}
                                                onChange={field.onChange}
                                                initialSelected={initialSelected?.trips}
                                                placeholder="Select trips"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="driverIds"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Driver
                                        </FormLabel>
                                        <FormControl>
                                            <EntityMultiPicker
                                                kind="driver"
                                                value={field.value ?? []}
                                                onChange={field.onChange}
                                                initialSelected={initialSelected?.drivers}
                                                placeholder="Select drivers"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Additional notes"
                                    className="min-h-[100px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {expense ? "Update Expense" : "Create Expense"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </Form>
    );
}
