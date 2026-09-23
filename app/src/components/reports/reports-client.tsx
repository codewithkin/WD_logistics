"use client";

import { cloneElement, useTransition } from "react";
import { toast } from "sonner";
import { generateReport, type GenerateReportInput } from "@/app/(dashboard)/reports/actions";
import { exportDashboardPDF } from "@/app/(dashboard)/reports/actions";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ReportsDashboard } from "./reports-dashboard";
import type { ReactElement, ComponentProps } from "react";

interface Report {
  id: string;
  type: string;
  period: string;
  startDate: Date;
  endDate: Date;
  format: string;
  createdAt: Date;
}

interface ReportsClientProps {
  initialReports: Report[];
  dashboardContent: ReactElement<ComponentProps<typeof ReportsDashboard>, typeof ReportsDashboard>;
}

export function ReportsClient({
  dashboardContent,
  initialReports,
}: ReportsClientProps) {
  const [isPending, startTransition] = useTransition();

  // reportType comes from whichever tab the user is on — it used to be
  // hardcoded to "revenue" regardless.
  const handleGenerateReport = (format: "pdf" | "csv", reportType: string) => {
    const now = new Date();
    const startDate = startOfMonth(subMonths(now, 1));
    const endDate = endOfMonth(subMonths(now, 1));

    startTransition(async () => {
      try {
        const result = await generateReport({
          // Always a reportConfigs key — the menu only ever offers those.
          reportType: reportType as GenerateReportInput["reportType"],
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

  const handleExportDashboard = () => {
    startTransition(async () => {
      try {
        const result = await exportDashboardPDF();

        if (result.success && result.pdf) {
          const byteCharacters = atob(result.pdf);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename || "dashboard-summary.pdf";
          a.click();
          window.URL.revokeObjectURL(url);

          toast.success("Dashboard exported successfully");
        } else {
          toast.error(result.error || "Failed to export dashboard");
        }
      } catch {
        toast.error("An error occurred while exporting dashboard");
      }
    });
  };

  // dashboardContent is built on the server, so its `type` is a client
  // reference, never identical to the ReportsDashboard function imported
  // here. The old `dashboardContent.type === ReportsDashboard` check
  // therefore always failed and silently dropped every prop below — which is
  // why the Generate button never appeared and Report History was always
  // empty. cloneElement doesn't care about type identity.
  return cloneElement(dashboardContent, {
    reports: initialReports,
    onGeneratePDF: (reportType: string) => handleGenerateReport("pdf", reportType),
    onGenerateCSV: (reportType: string) => handleGenerateReport("csv", reportType),
    onExportDashboard: handleExportDashboard,
    isGenerating: isPending,
  });
}
