"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateReport } from "@/app/(dashboard)/reports/actions";
import { exportDashboardPDF } from "@/app/(dashboard)/reports/actions";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ReportsDashboard } from "./reports-dashboard";

interface ReportsClientProps {
  customers: { id: string; name: string }[];
  trucks: { id: string; registrationNo: string; make: string; model: string }[];
  initialReports: { id: string }[];
  dashboardContent: any;
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

  // If dashboardContent is a React component (ReportsDashboard), clone it with additional props
  const EnhancedDashboard = dashboardContent.type === ReportsDashboard
    ? () => {
      const Dashboard = dashboardContent.type as any;
      return (
        <Dashboard
          {...dashboardContent.props}
          onGeneratePDF={() => handleGenerateReport("pdf")}
          onGenerateCSV={() => handleGenerateReport("csv")}
          onExportDashboard={handleExportDashboard}
          isGenerating={isPending}
        />
      );
    }
    : () => dashboardContent;

  return <EnhancedDashboard />;
}
