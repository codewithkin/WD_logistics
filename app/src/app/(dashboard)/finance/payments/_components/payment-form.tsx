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
import { PaymentMethod, PAYMENT_METHOD_LABELS } from "@/lib/types";
import { createPayment, updatePayment } from "../actions";
import { toast } from "sonner";

const paymentSchema = z.object({
    invoiceId: z.string().min(1, "Invoice is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    paymentDate: z.date({ required_error: "Payment date is required" }),
    method: z.enum(["cash", "check", "bank_transfer", "credit_card", "other"]),
    reference: z.string().optional(),
    notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
    payment?: {
        id: string;
        invoiceId: string;
        amount: number;
        paymentDate: Date;
        method: PaymentMethod;
        reference: string | null;
        notes: string | null;
    };
    invoices: Array<{
        id: string;
        invoiceNumber: string;
        totalAmount: number;
        balance: number;
        customer: { name: string };
    }>;
    defaultInvoiceId?: string;
}

export function PaymentForm({ payment, invoices, defaultInvoiceId }: PaymentFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!payment;

    const form = useForm<PaymentFormData>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            invoiceId: payment?.invoiceId ?? defaultInvoiceId ?? "",
            amount: payment?.amount ?? 0,
            paymentDate: payment?.paymentDate ?? new Date(),
            method: payment?.method ?? "bank_transfer",
            reference: payment?.reference ?? "",
            notes: payment?.notes ?? "",
        },
    });

    const selectedInvoiceId = form.watch("invoiceId");
    const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

    const onSubmit = async (data: PaymentFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updatePayment(payment.id, data)
                : await createPayment(data);

            if (result.success) {
                toast.success(isEditing ? "Payment updated successfully" : "Payment recorded successfully");
                router.push("/finance/payments");
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
                            name="invoiceId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Invoice</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={isEditing}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an invoice" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {invoices.map((invoice) => (
                                                <SelectItem key={invoice.id} value={invoice.id}>
                                                    {invoice.invoiceNumber} - {invoice.customer.name} (Balance: $
                                                    {invoice.balance.toLocaleString()})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedInvoice && (
                            <div className="rounded-md border p-4 bg-muted/50">
                                <div className="grid gap-2 md:grid-cols-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Invoice Total</p>
                                        <p className="font-medium">${selectedInvoice.totalAmount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                                        <p className="font-medium text-amber-600">
                                            ${selectedInvoice.balance.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Customer</p>
                                        <p className="font-medium">{selectedInvoice.customer.name}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount ($)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="paymentDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Payment Date</FormLabel>
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
                                name="method"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Method</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select method" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
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
                                name="reference"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reference / Transaction ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Optional" {...field} />
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
                                        <Textarea
                                            placeholder="Additional notes about this payment..."
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
                            {isEditing ? "Update Payment" : "Record Payment"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
