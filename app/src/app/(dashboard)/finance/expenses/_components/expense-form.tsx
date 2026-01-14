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
import { Loader2, ChevronsUpDown, X, Truck, User, MapPin, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { showAlert } from "@/components/ui/custom-alert";

const expenseSchema = z.object({
    categoryId: z.string().min(1, "Category is required"),
    amount: z.number().positive("Amount must be positive"),
    date: z.date(),
    notes: z.string().optional(),
    truckIds: z.array(z.string()).optional(),
    tripIds: z.array(z.string()).optional(),
    driverIds: z.array(z.string()).optional(),
}).refine(
    (data) => {
        const hasTruck = data.truckIds && data.truckIds.length > 0;
        const hasTrip = data.tripIds && data.tripIds.length > 0;
        const hasDriver = data.driverIds && data.driverIds.length > 0;
        return hasTruck || hasTrip || hasDriver;
    },
    {
        message: "You must associate this expense with at least one truck, trip, or driver",
        path: ["truckIds"], // This will show the error on the associations section
    }
);

interface ExpenseCategory {
    id: string;
    name: string;
    isTruck: boolean;
    isTrip: boolean;
    isDriver: boolean;
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

interface Driver {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    licenseNumber: string;
}

interface ExpenseFormProps {
    categories: ExpenseCategory[];
    trucks: Truck[];
    trips: Trip[];
    drivers: Driver[];
    expense?: {
        id: string;
        categoryId: string;
        amount: number;
        date: Date;
        vendor: string | null;
        reference: string | null;
        notes: string | null;
        receiptUrl: string | null;
        truckExpenses: Array<{ truckId: string }>;
        tripExpenses: Array<{ tripId: string }>;
        driverExpenses: Array<{ driverId: string }>;
    };
    prefilledTripId?: string;
    prefilledTruckId?: string;
    prefilledDriverId?: string;
}

export function ExpenseForm({ categories, trucks, trips, drivers, expense, prefilledTripId, prefilledTruckId, prefilledDriverId }: ExpenseFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [truckSearchOpen, setTruckSearchOpen] = useState(false);
    const [truckSearch, setTruckSearch] = useState("");
    const [tripSearchOpen, setTripSearchOpen] = useState(false);
    const [tripSearch, setTripSearch] = useState("");
    const [driverSearchOpen, setDriverSearchOpen] = useState(false);
    const [driverSearch, setDriverSearch] = useState("");

    const form = useForm<z.infer<typeof expenseSchema>>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            categoryId: expense?.categoryId || "",
            amount: expense?.amount || 0,
            date: expense?.date || new Date(),
            notes: expense?.notes || "",
            truckIds: expense?.truckExpenses.map(te => te.truckId) || (prefilledTruckId ? [prefilledTruckId] : []),
            tripIds: expense?.tripExpenses.map(te => te.tripId) || (prefilledTripId ? [prefilledTripId] : []),
            driverIds: expense?.driverExpenses?.map(de => de.driverId) || (prefilledDriverId ? [prefilledDriverId] : []),
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

    // Filter drivers based on search
    const filteredDrivers = useMemo(() => {
        if (!driverSearch) return drivers;
        const search = driverSearch.toLowerCase();
        return drivers.filter(
            driver =>
                driver.firstName.toLowerCase().includes(search) ||
                driver.lastName.toLowerCase().includes(search) ||
                driver.licenseNumber.toLowerCase().includes(search) ||
                driver.phone?.toLowerCase().includes(search)
        );
    }, [drivers, driverSearch]);

    // Filter trips based on search
    const filteredTrips = useMemo(() => {
        if (!tripSearch) return trips;
        const search = tripSearch.toLowerCase();
        return trips.filter(
            trip =>
                trip.originCity.toLowerCase().includes(search) ||
                trip.destinationCity.toLowerCase().includes(search) ||
                trip.truck.registrationNo.toLowerCase().includes(search) ||
                trip.driver.firstName.toLowerCase().includes(search) ||
                trip.driver.lastName.toLowerCase().includes(search)
        );
    }, [trips, tripSearch]);

    // Watch for association changes to clear errors
    const truckIds = form.watch('truckIds');
    const tripIds = form.watch('tripIds');
    const driverIds = form.watch('driverIds');

    const hasAssociation = (truckIds && truckIds.length > 0) ||
        (tripIds && tripIds.length > 0) ||
        (driverIds && driverIds.length > 0);

    const onSubmit = async (values: z.infer<typeof expenseSchema>) => {
        setIsSubmitting(true);
        try {
            const data: ExpenseFormData = {
                categoryId: values.categoryId,
                amount: values.amount,
                date: values.date,
                notes: values.notes,
                truckIds: values.truckIds,
                tripIds: values.tripIds,
                driverIds: values.driverIds,
            };

            if (expense) {
                await updateExpense(expense.id, data);
            } else {
                await createExpense(data);
            }
        } catch (error) {
            // Check if this is a redirect error (which is expected and not an error)
            if (error instanceof Error) {
                // Next.js redirect() throws RedirectError with name property
                if (error.name === "RedirectError" || (error as any).digest?.startsWith("NEXT_REDIRECT")) {
                    return;
                }
            }
            console.error("Failed to save expense:", error);
            showAlert("Failed to save expense");
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
                </div>

                {/* Association Selection - Required */}
                <div className="space-y-4">
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

                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Truck Association */}
                        <FormField
                            control={form.control}
                            name="truckIds"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-2">
                                        <Truck className="h-4 w-4" />
                                        Truck
                                    </FormLabel>
                                    <Popover open={truckSearchOpen} onOpenChange={setTruckSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={truckSearchOpen}
                                                    className={cn(
                                                        "w-full justify-between",
                                                        field.value?.length && "border-primary",
                                                        !field.value?.length && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value?.length
                                                        ? `${field.value.length} selected`
                                                        : "Select trucks..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                                                                            field.onChange(field.value?.filter(id => id !== truck.id));
                                                                        } else {
                                                                            field.onChange([...(field.value || []), truck.id]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className={cn(
                                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                                    )}>
                                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                            <path d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">{truck.registrationNo}</span>
                                                                        <span className="text-xs text-muted-foreground">{truck.make} {truck.model}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {field.value && field.value.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {field.value.map((truckId) => {
                                                const truck = trucks.find(t => t.id === truckId);
                                                if (!truck) return null;
                                                return (
                                                    <Badge key={truckId} variant="secondary" className="text-xs">
                                                        {truck.registrationNo}
                                                        <button type="button" className="ml-1" onClick={() => field.onChange(field.value?.filter(id => id !== truckId))}>
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                </FormItem>
                            )}
                        />

                        {/* Trip Association */}
                        <FormField
                            control={form.control}
                            name="tripIds"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Trip
                                    </FormLabel>
                                    <Popover open={tripSearchOpen} onOpenChange={setTripSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={tripSearchOpen}
                                                    className={cn(
                                                        "w-full justify-between",
                                                        field.value?.length && "border-primary",
                                                        !field.value?.length && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value?.length
                                                        ? `${field.value.length} selected`
                                                        : "Select trips..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                            <Command shouldFilter={false}>
                                                <CommandInput
                                                    placeholder="Search trips..."
                                                    value={tripSearch}
                                                    onValueChange={setTripSearch}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No trips found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredTrips.map((trip) => {
                                                            const isSelected = field.value?.includes(trip.id);
                                                            return (
                                                                <CommandItem
                                                                    key={trip.id}
                                                                    value={trip.id}
                                                                    onSelect={() => {
                                                                        if (isSelected) {
                                                                            field.onChange(field.value?.filter(id => id !== trip.id));
                                                                        } else {
                                                                            field.onChange([...(field.value || []), trip.id]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className={cn(
                                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                                    )}>
                                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                            <path d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">{trip.originCity} → {trip.destinationCity}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {new Date(trip.scheduledDate).toLocaleDateString()} • {trip.truck.registrationNo}
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
                                    {field.value && field.value.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {field.value.map((tripId) => {
                                                const trip = trips.find(t => t.id === tripId);
                                                if (!trip) return null;
                                                return (
                                                    <Badge key={tripId} variant="secondary" className="text-xs">
                                                        {trip.originCity}→{trip.destinationCity}
                                                        <button type="button" className="ml-1" onClick={() => field.onChange(field.value?.filter(id => id !== tripId))}>
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                </FormItem>
                            )}
                        />

                        {/* Driver Association */}
                        <FormField
                            control={form.control}
                            name="driverIds"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        Driver
                                    </FormLabel>
                                    <Popover open={driverSearchOpen} onOpenChange={setDriverSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={driverSearchOpen}
                                                    className={cn(
                                                        "w-full justify-between",
                                                        field.value?.length && "border-primary",
                                                        !field.value?.length && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value?.length
                                                        ? `${field.value.length} selected`
                                                        : "Select drivers..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                            <Command shouldFilter={false}>
                                                <CommandInput
                                                    placeholder="Search drivers..."
                                                    value={driverSearch}
                                                    onValueChange={setDriverSearch}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No drivers found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredDrivers.map((driver) => {
                                                            const isSelected = field.value?.includes(driver.id);
                                                            return (
                                                                <CommandItem
                                                                    key={driver.id}
                                                                    value={driver.id}
                                                                    onSelect={() => {
                                                                        if (isSelected) {
                                                                            field.onChange(field.value?.filter(id => id !== driver.id));
                                                                        } else {
                                                                            field.onChange([...(field.value || []), driver.id]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className={cn(
                                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                                                    )}>
                                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                            <path d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">{driver.firstName} {driver.lastName}</span>
                                                                        <span className="text-xs text-muted-foreground">License: {driver.licenseNumber}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {field.value && field.value.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {field.value.map((driverId) => {
                                                const driver = drivers.find(d => d.id === driverId);
                                                if (!driver) return null;
                                                return (
                                                    <Badge key={driverId} variant="secondary" className="text-xs">
                                                        {driver.firstName} {driver.lastName}
                                                        <button type="button" className="ml-1" onClick={() => field.onChange(field.value?.filter(id => id !== driverId))}>
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}
                                </FormItem>
                            )}
                        />
                    </div>
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
