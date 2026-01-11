"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExpense, updateExpense, type ExpenseFormData } from "../actions";
import { Loader2 } from "lucide-react";

const expenseSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    amount: z.coerce.number().positive("Amount must be positive"),
    description: z.string().optional(),
    date: z.coerce.date(),
    vendor: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    receiptUrl: z.string().url().optional().or(z.literal("")),
    truckIds: z.array(z.string()).optional(),
    tripIds: z.array(z.string()).optional(),
});

interface ExpenseCategory {
    id: string;
    name: string;
    isTruck: boolean;
    isTrip: boolean;
}

interface Truck {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
}

interface Trip {
    id: string;
    originCity: string;
    destinationCity: string;
    scheduledDate: Date;
    truck: {
        registrationNo: string;
    };
    driver: {
        firstName: string;
        lastName: string;
    };
}

interface ExpenseFormProps {
    categories: ExpenseCategory[];
    trucks: Truck[];
    trips: Trip[];
    expense?: {
        id: string;
        categoryId: string;
        amount: number;
        description: string | null;
        date: Date;
        vendor: string | null;
        reference: string | null;
        notes: string | null;
        receiptUrl: string | null;
        truckExpenses: Array<{ truckId: string }>;
        tripExpenses: Array<{ tripId: string }>;
    };
}

export function ExpenseForm({ categories, trucks, trips, expense }: ExpenseFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(
        expense ? categories.find(c => c.id === expense.categoryId) || null : null
    );

    const form = useForm<z.infer<typeof expenseSchema>>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            categoryId: expense?.categoryId || "",
            amount: expense?.amount || 0,
            description: expense?.description || "",
            date: expense?.date || new Date(),
            vendor: expense?.vendor || "",
            reference: expense?.reference || "",
            notes: expense?.notes || "",
            receiptUrl: expense?.receiptUrl || "",
            truckIds: expense?.truckExpenses.map(te => te.truckId) || [],
            tripIds: expense?.tripExpenses.map(te => te.tripId) || [],
        },
    });

    // Watch category changes
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'categoryId') {
                const category = categories.find(c => c.id === value.categoryId);
                setSelectedCategory(category || null);
                
                // Clear selections if category doesn't support them
                if (category && !category.isTruck) {
                    form.setValue('truckIds', []);
                }
                if (category && !category.isTrip) {
                    form.setValue('tripIds', []);
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form, categories]);

    const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
        setIsSubmitting(true);
        try {
            const data: ExpenseFormData = {
                categoryId: values.categoryId,
                amount: values.amount,
                description: values.description,
                date: values.date,
                vendor: values.vendor,
                reference: values.reference,
                notes: values.notes,
                receiptUrl: values.receiptUrl || undefined,
                truckIds: values.truckIds,
                tripIds: values.tripIds,
            };

            if (expense) {
                await updateExpense(expense.id, data);
            } else {
                await createExpense(data);
            }
        } catch (error) {
            console.error("Failed to save expense:", error);
            alert("Failed to save expense");
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        {...field}
                                        value={
                                            field.value instanceof Date
                                                ? field.value.toISOString().split("T")[0]
                                                : field.value
                                        }
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="vendor"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Vendor</FormLabel>
                                <FormControl>
                                    <Input placeholder="Vendor name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reference</FormLabel>
                                <FormControl>
                                    <Input placeholder="Invoice/receipt number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="receiptUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Receipt URL</FormLabel>
                                <FormControl>
                                    <Input
                                        type="url"
                                        placeholder="https://example.com/receipt.pdf"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Truck Association */}
                {selectedCategory?.isTruck && trucks.length > 0 && (
                    <FormField
                        control={form.control}
                        name="truckIds"
                        render={() => (
                            <FormItem>
                                <div className="mb-4">
                                    <FormLabel>Associated Trucks</FormLabel>
                                    <FormDescription>
                                        Select which truck(s) this expense applies to
                                    </FormDescription>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {trucks.map((truck) => (
                                        <FormField
                                            key={truck.id}
                                            control={form.control}
                                            name="truckIds"
                                            render={({ field }) => {
                                                return (
                                                    <FormItem
                                                        key={truck.id}
                                                        className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(truck.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...(field.value || []), truck.id])
                                                                        : field.onChange(
                                                                            field.value?.filter(
                                                                                (value) => value !== truck.id
                                                                            )
                                                                        );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <div className="space-y-1 leading-none">
                                                            <FormLabel className="font-medium">
                                                                {truck.registrationNo}
                                                            </FormLabel>
                                                            <p className="text-xs text-muted-foreground">
                                                                {truck.make} {truck.model}
                                                            </p>
                                                        </div>
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* Trip Association */}
                {selectedCategory?.isTrip && trips.length > 0 && (
                    <FormField
                        control={form.control}
                        name="tripIds"
                        render={() => (
                            <FormItem>
                                <div className="mb-4">
                                    <FormLabel>Associated Trips</FormLabel>
                                    <FormDescription>
                                        Select which trip(s) this expense applies to
                                    </FormDescription>
                                </div>
                                <div className="grid gap-3">
                                    {trips.map((trip) => (
                                        <FormField
                                            key={trip.id}
                                            control={form.control}
                                            name="tripIds"
                                            render={({ field }) => {
                                                return (
                                                    <FormItem
                                                        key={trip.id}
                                                        className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(trip.id)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...(field.value || []), trip.id])
                                                                        : field.onChange(
                                                                            field.value?.filter(
                                                                                (value) => value !== trip.id
                                                                            )
                                                                        );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <div className="space-y-1 leading-none flex-1">
                                                            <FormLabel className="font-medium">
                                                                {trip.originCity} → {trip.destinationCity}
                                                            </FormLabel>
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(trip.scheduledDate).toLocaleDateString()} • 
                                                                {trip.truck.registrationNo} • 
                                                                {trip.driver.firstName} {trip.driver.lastName}
                                                            </p>
                                                        </div>
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Input placeholder="Brief description" {...field} />
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
