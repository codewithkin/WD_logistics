"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    subDays,
    subMonths,
    subQuarters,
    subYears,
    startOfMonth,
    endOfMonth,
    startOfQuarter,
    endOfQuarter,
    startOfYear,
    endOfYear,
    startOfWeek,
    endOfWeek,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { toast } from "sonner";
import { Download, FileText, Loader2, FileSpreadsheet } from "lucide-react";
import { reportConfigs, periodLabels } from "@/config/reports";
import { generateReport, type GenerateReportInput } from "@/app/(dashboard)/reports/actions";

const reportFormSchema = z.object({
    reportType: z.string().min(1, { message: "Select a report type" }),
    period: z.string().min(1, { message: "Select a period" }),
    dateRange: z.object({
        from: z.date(),
        to: z.date(),
    }),
    format: z.enum(["pdf", "csv"]),
    customerId: z.string().optional(),
    truckId: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

interface ReportGeneratorProps {
    customers?: { id: string; name: string }[];
    trucks?: { id: string; registrationNo: string; make: string; model: string }[];
    onReportGenerated?: () => void;
}

export function ReportGenerator({
    customers = [],
    trucks = [],
    onReportGenerated,
}: ReportGeneratorProps) {
    const [isPending, startTransition] = useTransition();
    const [generatedReport, setGeneratedReport] = useState<{
        data: string;
        filename: string;
        mimeType: string;
    } | null>(null);

    const now = new Date();
    const defaultDateRange: DateRange = {
        from: startOfMonth(subMonths(now, 1)),
        to: endOfMonth(subMonths(now, 1)),
    };

    const form = useForm<ReportFormValues>({
        resolver: zodResolver(reportFormSchema) as any,
        defaultValues: {
            reportType: "",
            period: "",
            dateRange: defaultDateRange,
            format: "pdf",
        },
    });

    const selectedReportType = form.watch("reportType");
    const selectedPeriod = form.watch("period");
    const reportConfig = selectedReportType ? reportConfigs[selectedReportType] : null;

    // Auto-set date range based on period selection
    const handlePeriodChange = (period: string) => {
        form.setValue("period", period);
        let from: Date | undefined;
        let to: Date | undefined;

        switch (period) {
            case "daily":
                from = subDays(now, 1);
                to = subDays(now, 1);
                break;
            case "weekly":
                from = startOfWeek(now);
                to = endOfWeek(now);
                break;
            case "monthly":
                from = startOfMonth(subMonths(now, 1));
                to = endOfMonth(subMonths(now, 1));
                break;
            case "quarterly":
                from = startOfQuarter(subQuarters(now, 1));
                to = endOfQuarter(subQuarters(now, 1));
                break;
            case "yearly":
                from = startOfYear(subYears(now, 1));
                to = endOfYear(subYears(now, 1));
                break;
            case "custom":
                // Keep existing date range for custom
                return;
        }

        if (from && to) {
            form.setValue("dateRange", { from, to });
        }
    };

    const onSubmit = async (values: ReportFormValues) => {
        setGeneratedReport(null);

        startTransition(async () => {
            try {
                const input: GenerateReportInput = {
                    reportType: values.reportType as GenerateReportInput["reportType"],
                    startDate: values.dateRange.from.toISOString(),
                    endDate: values.dateRange.to.toISOString(),
                    period: values.period,
                    format: values.format,
                    customerId: values.customerId,
                    truckId: values.truckId,
                };

                const result = await generateReport(input);

                if (!result.success) {
                    toast.error(result.error || "Failed to generate report");
                    return;
                }

                if (result.data && result.filename && result.mimeType) {
                    setGeneratedReport({
                        data: result.data,
                        filename: result.filename,
                        mimeType: result.mimeType,
                    });
                    toast.success("Report generated successfully!");
                    onReportGenerated?.();
                }
            } catch (error) {
                toast.error("Failed to generate report");
                console.error(error);
            }
        });
    };

    const downloadReport = () => {
        if (!generatedReport) return;

        // Convert base64 to blob and download
        const byteCharacters = atob(generatedReport.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: generatedReport.mimeType });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = generatedReport.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generate Report</CardTitle>
                <CardDescription>
                    Select report type, period, and format to generate
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="reportType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Report Type</FormLabel>
                                        <Select
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                form.setValue("period", "");
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select report type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.values(reportConfigs).map((config) => (
                                                    <SelectItem key={config.id} value={config.id}>
                                                        {config.name}
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
                                name="period"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Period</FormLabel>
                                        <Select
                                            onValueChange={handlePeriodChange}
                                            value={field.value}
                                            disabled={!reportConfig}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select period" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {reportConfig?.periods.map((period) => (
                                                    <SelectItem key={period} value={period}>
                                                        {periodLabels[period]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {selectedPeriod === "custom" && (
                            <FormField
                                control={form.control}
                                name="dateRange"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date Range</FormLabel>
                                        <FormControl>
                                            <DateRangePicker
                                                date={field.value}
                                                onDateChange={(date) => {
                                                    if (date) {
                                                        field.onChange(date);
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Customer selector for customer statement */}
                        {reportConfig?.requiresCustomer && (
                            <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select customer" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {customers.map((customer) => (
                                                    <SelectItem key={customer.id} value={customer.id}>
                                                        {customer.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Truck selector for truck performance */}
                        {reportConfig?.requiresTruck && (
                            <FormField
                                control={form.control}
                                name="truckId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Truck</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select truck" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {trucks.map((truck) => (
                                                    <SelectItem key={truck.id} value={truck.id}>
                                                        {truck.registrationNo} - {truck.make} {truck.model}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="format"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Format</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select format" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="pdf">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-red-500" />
                                                    PDF Document
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="csv">
                                                <div className="flex items-center gap-2">
                                                    <FileSpreadsheet className="h-4 w-4 text-green-500" />
                                                    CSV Spreadsheet
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedPeriod && selectedPeriod !== "custom" && (
                            <div className="text-sm text-muted-foreground">
                                Date range: {form.getValues("dateRange.from")?.toLocaleDateString()} -{" "}
                                {form.getValues("dateRange.to")?.toLocaleDateString()}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generate Report
                            </Button>

                            {generatedReport && (
                                <Button type="button" variant="outline" onClick={downloadReport}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download {generatedReport.filename.endsWith(".pdf") ? "PDF" : "CSV"}
                                </Button>
                            )}
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
