"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExpense, updateExpense, type ExpenseFormData } from "../actions";
import { Loader2, ChevronsUpDown, X, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const expenseSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    amount: z.coerce.number().positive("Amount must be positive"),
    description: z.string().optional(),
    date: z.coerce.date(),
    notes: z.string().optional(),
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
    const [truckSearchOpen, setTruckSearchOpen] = useState(false);
    const [truckSearch, setTruckSearch] = useState("");
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
            notes: expense?.notes || "",
            truckIds: expense?.truckExpenses.map(te => te.truckId) || [],
            tripIds: expense?.tripExpenses.map(te => te.tripId) || [],
        },
    });

    // Filter trucks based on search
    const filteredTrucks = useMemo(() => {
        if (!truckSearch) return trucks;
        const search = truckSearch.toLowerCase();
        return trucks.filter(
            truck =>
                truck.registrationNo.toLowerCase().includes(search) ||
                truck.make.toLowerCase().includes(search) ||
                truck.model.toLowerCase().includes(search)
        );
    }, [trucks, truckSearch]);

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
                notes: values.notes,
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
                </div>

                {/* Truck Association - Searchable Dropdown */}
                {selectedCategory?.isTruck && trucks.length > 0 && (
                    <FormField
                        control={form.control}
                        name="truckIds"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Associated Trucks</FormLabel>
                                <FormDescription>
                                    Select which truck(s) this expense applies to
                                </FormDescription>
                                <Popover open={truckSearchOpen} onOpenChange={setTruckSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={truckSearchOpen}
                                                className={cn(
                                                    "w-full justify-between",
                                                    !field.value?.length && "text-muted-foreground"
                                                )}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Truck className="h-4 w-4" />
                                                    {field.value?.length
                                                        ? `${field.value.length} truck${field.value.length > 1 ? 's' : ''} selected`
                                                        : "Select trucks..."}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder="Search trucks..."
                                                value={truckSearch}
                                                onValueChange={setTruckSearch}
                                            />
                                            <CommandList>
                                                <CommandEmpty>No trucks found.</CommandEmpty>
                                                <CommandGroup>
                                                    {filteredTrucks.map((truck) => {
                                                        const isSelected = field.value?.includes(truck.id);
                                                        return (
                                                            <CommandItem
                                                                key={truck.id}
                                                                value={truck.id}
                                                                onSelect={() => {
                                                                    if (isSelected) {
                                                                        field.onChange(
                                                                            field.value?.filter(id => id !== truck.id)
                                                                        );
                                                                    } else {
                                                                        field.onChange([...(field.value || []), truck.id]);
                                                                    }
                                                                }}
                                                            >
                                                                <div className={cn(
                                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground"
                                                                        : "opacity-50 [&_svg]:invisible"
                                                                )}>
                                                                    <svg
                                                                        className="h-3 w-3"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                        stroke="currentColor"
                                                                        strokeWidth={3}
                                                                    >
                                                                        <path d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{truck.registrationNo}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {truck.make} {truck.model}
                                                                    </span>
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {/* Selected trucks badges */}
                                {field.value && field.value.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {field.value.map((truckId) => {
                                            const truck = trucks.find(t => t.id === truckId);
                                            if (!truck) return null;
                                            return (
                                                <Badge
                                                    key={truckId}
                                                    variant="secondary"
                                                    className="flex items-center gap-1"
                                                >
                                                    {truck.registrationNo}
                                                    <button
                                                        type="button"
                                                        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                        onClick={() => {
                                                            field.onChange(
                                                                field.value?.filter(id => id !== truckId)
                                                            );
                                                        }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                )}
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
