"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, FileSpreadsheet, Download, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { generateReport } from "@/app/(dashboard)/reports/actions";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface ReportsClientProps {
  customers: { id: string; name: string }[];
  trucks: { id: string; registrationNo: string; make: string; model: string }[];
  initialReports: { id: string }[];
  dashboardContent: React.ReactNode;
}

export function ReportsClient({
  dashboardContent,
}: ReportsClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleGenerateReport = (format: "pdf" | "csv") => {
    const now = new Date();
    const startDate = startOfMonth(subMonths(now, 1));
    const endDate = endOfMonth(subMonths(now, 1));

    startTransition(async () => {
      try {
        const result = await generateReport({
          reportType: "revenue",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          period: "monthly",
          format,
        });

        if (result.success && result.data) {
          // Trigger download
          const blob = new Blob(
            [Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))],
            { type: result.mimeType }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename || `report.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success("Report generated successfully");
        } else {
          toast.error(result.error || "Failed to generate report");
        }
      } catch (error) {
        toast.error("An error occurred while generating the report");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Generate
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleGenerateReport("pdf")}>
              <FileText className="mr-2 h-4 w-4" />
              Generate PDF Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleGenerateReport("csv")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Generate CSV Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dashboardContent}
    </div>
  );
}
