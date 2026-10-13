"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ApprovalNotice,
    isPendingApproval,
} from "@/components/ui/approval-notice";
import { useSession } from "@/components/providers/session-provider";
import { Input } from "@/components/ui/input";
import { EntityPicker, EntityMultiPicker } from "@/components/ui/entity-picker";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntityOption } from "@/lib/entity-picker/config";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { createExpense, updateExpense } from "../actions";
import { toast } from "sonner";
import {
    EXPENSE_UNITS,
    EXPENSE_UNIT_VALUES,
    type ExpenseUnit,
} from "@/lib/expense-units";

const expenseSchema = z.object({
    description: z.string().optional(),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    // Blank stays blank: an empty number input arrives as "", and coercing
    // that to 0 would record "0 litres" on every expense without a quantity.
    quantity: z
        .union([z.literal(""), z.coerce.number().positive("Quantity must be positive")])
        .optional(),
    unit: z.enum(EXPENSE_UNIT_VALUES).optional(),
    date: z.date({ message: "Date is required" }),
    categoryId: z.string().min(1, "Category is required"),
    truckIds: z.array(z.string()).optional(),
    trailerIds: z.array(z.string()).optional(),
    tripIds: z.array(z.string()).optional(),
    driverIds: z.array(z.string()).optional(),
    isBusinessExpense: z.boolean().optional(),
    vendor: z.string().optional(),
    reference: z.string().optional(),
    receiptUrl: z.string().optional(),
    notes: z.string().optional(),
    accountId: z.string().optional(),
}).refine(
    (data) =>
        data.isBusinessExpense === true ||
        (data.truckIds?.length ?? 0) > 0 ||
        (data.trailerIds?.length ?? 0) > 0 ||
        (data.tripIds?.length ?? 0) > 0 ||
        (data.driverIds?.length ?? 0) > 0,
    {
        // The same rule the finance form has always had. Without it this form
        // produced expenses that reached no truck, no trailer and no driver:
        // counted in the company total and missing from every attribution.
        message: "Link this expense to a truck, trailer, trip or driver — or mark it as an overhead",
        path: ["truckIds"],
    }
);

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
    expense?: {
        id: string;
        description: string | null;
        amount: number;
        quantity?: number | null;
        unit?: string | null;
        date: Date;
        categoryId: string;
        accountId?: string | null;
        isBusinessExpense?: boolean;
        truckExpenses?: Array<{ truckId: string }>;
        trailerExpenses?: Array<{ trailerId: string }>;
        driverExpenses?: Array<{ driverId: string }>;
        vendor: string | null;
        reference: string | null;
        receiptUrl: string | null;
        notes: string | null;
        tripExpenses?: Array<{ tripId: string }>;
    };
    /** Labels for what the expense already points at; the pickers do the rest. */
    initialSelected?: {
        category?: EntityOption;
        trip?: EntityOption;
        trucks?: EntityOption[];
        trailers?: EntityOption[];
        trips?: EntityOption[];
        drivers?: EntityOption[];
    };
    defaultTripId?: string;
    /** Cash, Bank, Petty Cash. Names only — no balance reaches the browser. */
    accounts?: Array<{ id: string; name: string }>;
}

/** The Select's value for "not out of one of the accounts". */
const NO_ACCOUNT = "__none__";

export function ExpenseForm({ expense, initialSelected, defaultTripId, accounts = [] }: ExpenseFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    // Non-admins are editing a request, not the record — see
    // lib/edit-requests/gate.ts. The banner below says so, and the
    // reason travels with the change for the admin who reviews it.
    const { role } = useSession();
    const needsApproval = role !== "admin";
    const [approvalReason, setApprovalReason] = useState("");
    const [reasonError, setReasonError] = useState<string | undefined>();
    const isEditing = !!expense;
    // Once the user has named an account themselves, changing the category
    // stops moving it under them.
    const [accountTouched, setAccountTouched] = useState(Boolean(expense?.accountId));

    const form = useForm<ExpenseFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(expenseSchema) as any,
        defaultValues: {
            description: expense?.description ?? "",
            amount: expense?.amount ?? 0,
            quantity: expense?.quantity ?? "",
            unit: (expense?.unit as ExpenseUnit | undefined) ?? undefined,
            date: expense?.date ?? new Date(),
            categoryId: expense?.categoryId ?? "",
            truckIds: expense?.truckExpenses?.map((row) => row.truckId) ?? [],
            trailerIds: expense?.trailerExpenses?.map((row) => row.trailerId) ?? [],
            // Every linked trip, not just the first: an expense shared across
            // three trips used to come back from an edit attached to one.
            tripIds:
                expense?.tripExpenses?.map((row) => row.tripId) ??
                (defaultTripId ? [defaultTripId] : []),
            driverIds: expense?.driverExpenses?.map((row) => row.driverId) ?? [],
            isBusinessExpense: expense?.isBusinessExpense ?? false,
            vendor: expense?.vendor ?? "",
            reference: expense?.reference ?? "",
            receiptUrl: expense?.receiptUrl ?? "",
            notes: expense?.notes ?? "",
            accountId: expense?.accountId ?? "",
        },
    });

    const isBusinessExpense = form.watch("isBusinessExpense");

    const onSubmit = async (data: ExpenseFormData) => {
        setIsLoading(true);
        try {
            if (isEditing && needsApproval && approvalReason.trim().length < 5) {
                setReasonError("Give a short reason so the admin knows why.");
                setIsLoading(false);
                return;
            }
            // "" is what an empty number input gives back, and it means the
            // quantity was not recorded — not that it was zero.
            const payload = {
                ...data,
                quantity: data.quantity === "" || data.quantity === undefined ? null : data.quantity,
                unit: data.unit ?? null,
                // null, not "", so clearing it reaches the database and the
                // debit follows the category's default again.
                accountId: data.accountId || null,
            };
            const result = isEditing
                ? await updateExpense(expense.id, payload, approvalReason)
                : await createExpense(payload);

            if (isPendingApproval(result)) {

                toast.success(result.message);

                // Back to the list, not to the request queue: Edit Requests is
                // admin only (ACCESS_CONTROL.md), so a supervisor filing a
                // request was being sent straight to a no-access page instead
                // of a confirmation.
                router.push("/operations/expenses");

                return;

            }

            if (result.success) {
                toast.success(isEditing ? "Expense updated successfully" : "Expense created successfully");
                router.push("/operations/expenses");
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
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Fuel, Tolls, Repairs..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount ($)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {/* What the money bought. Optional, but on a fuel
                                expense it is what a supervisor is shown on the
                                truck instead of the amount — and what turns km
                                per litre into a measurement. */}
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="e.g. 420"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Litres, tyres, hours — leave blank if it does not apply.
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
                                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select unit" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {EXPENSE_UNITS.map((unit) => (
                                                    <SelectItem key={unit.value} value={unit.value}>
                                                        {unit.label}
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
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? format(field.value, "PPP") : "Pick a date"}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <EntityPicker
                                                kind="expenseCategory"
                                                value={field.value}
                                                onChange={(id) => field.onChange(id ?? "")}
                                                onSelect={(option) => {
                                                    // Offer the account this
                                                    // category normally draws
                                                    // on, unless the user has
                                                    // already said otherwise.
                                                    if (accountTouched) return;
                                                    const fromCategory = option?.data?.defaultAccountId;
                                                    form.setValue(
                                                        "accountId",
                                                        typeof fromCategory === "string" ? fromCategory : ""
                                                    );
                                                }}
                                                initialSelected={initialSelected?.category}
                                                defaultFilters={{ appliesTo: "trip" }}
                                                placeholder="Select a category"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Which account the money came out of. The
                                category's default used to be the only route to
                                an account, so "this one came out of petty
                                cash" could not be recorded at all. */}
                            <FormField
                                control={form.control}
                                name="accountId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Paid from</FormLabel>
                                        <Select
                                            value={field.value || NO_ACCOUNT}
                                            onValueChange={(value) => {
                                                setAccountTouched(true);
                                                field.onChange(value === NO_ACCOUNT ? "" : value);
                                            }}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Not from an account" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value={NO_ACCOUNT}>
                                                    Not from an account
                                                </SelectItem>
                                                {accounts.map((account) => (
                                                    <SelectItem key={account.id} value={account.id}>
                                                        {account.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            {field.value
                                                ? "This account goes down by the amount above."
                                                : "No account balance changes."}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* What carries this cost.
                            This form could only ever name a trip, so an
                            expense recorded here reached no truck, no trailer
                            and no driver — missing from the truck's costs, the
                            fuel and maintenance figures, driver performance
                            and every report built on them, while still
                            counting in the company total. */}
                        <FormField
                            control={form.control}
                            name="isBusinessExpense"
                            render={({ field }) => (
                                <FormItem className="flex items-start gap-3 rounded-md border p-3">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value ?? false}
                                            onCheckedChange={(checked: boolean | "indeterminate") => {
                                                const on = checked === true;
                                                field.onChange(on);
                                                if (on) {
                                                    form.setValue("truckIds", []);
                                                    form.setValue("trailerIds", []);
                                                    form.setValue("tripIds", []);
                                                    form.setValue("driverIds", []);
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>A business overhead</FormLabel>
                                        <FormDescription>
                                            Office rent, bank charges, anything no truck or trip
                                            should carry. Leave it off and say below what this
                                            expense belongs to.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {!isBusinessExpense && (
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="truckIds"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Trucks</FormLabel>
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
                                            <FormLabel>Trailers</FormLabel>
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
                                            <FormLabel>Trips</FormLabel>
                                            <FormControl>
                                                <EntityMultiPicker
                                                    kind="trip"
                                                    value={field.value ?? []}
                                                    onChange={field.onChange}
                                                    initialSelected={
                                                        initialSelected?.trips ??
                                                        (initialSelected?.trip
                                                            ? [initialSelected.trip]
                                                            : undefined)
                                                    }
                                                    placeholder="Select trips"
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                A cost shared across several trips is split between
                                                them, not counted on each.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="driverIds"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Drivers</FormLabel>
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

                    {isEditing && needsApproval && (
                        <ApprovalNotice
                            value={approvalReason}
                            onChange={(value) => {
                                setApprovalReason(value);
                                setReasonError(undefined);
                            }}
                            noun="expense"
                            error={reasonError}
                        />
                    )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="vendor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vendor (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Shell, AutoZone..." {...field} />
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
                                        <FormLabel>Reference # (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Invoice number, receipt #..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="receiptUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Receipt URL (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://..." {...field} />
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
                                            placeholder="Additional notes about this expense..."
                                            className="min-h-25"
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
                            {isEditing ? "Update Expense" : "Create Expense"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
