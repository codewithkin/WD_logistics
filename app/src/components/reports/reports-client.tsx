"use client";

import { createContext, useContext, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { usePeriodRange } from "@/lib/use-period-range";
import { generateReport, type GenerateReportInput } from "@/app/(dashboard)/reports/actions";
import { exportDashboardPDF } from "@/app/(dashboard)/reports/actions";
import type { ReactNode } from "react";

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
  /** The dashboard, rendered by the server and passed straight through. */
  children: ReactNode;
}

/**
 * The generate/export callbacks, handed down rather than cloned in.
 *
 * This used to be `cloneElement(dashboardContent, { onGeneratePDF, ... })`.
 * A JSX element created in a Server Component and passed to a Client
 * Component arrives as a *lazy reference*, not a plain element: reading
 * `.type` gives `undefined`, and cloning it produces an element React cannot
 * render — "Element type is invalid ... got: undefined", which took the whole
 * Reports page down. Children pass through untouched, so the dashboard is
 * rendered as the server made it and reads what it needs from here.
 */
interface ReportActions {
  reports: Report[];
  onGeneratePDF: (reportType: string) => void;
  onGenerateCSV: (reportType: string) => void;
  onExportDashboard: () => void;
  isGenerating: boolean;
}

const ReportActionsContext = createContext<ReportActions | null>(null);

/** Null when rendered outside ReportsClient, so the dashboard can still mount. */
export function useReportActions(): ReportActions | null {
  return useContext(ReportActionsContext);
}

export function ReportsClient({
  children,
  initialReports,
}: ReportsClientProps) {
  const [isPending, startTransition] = useTransition();
  const period = usePeriodRange("1m");

  // reportType comes from whichever tab the user is on — it used to be
  // hardcoded to "revenue" regardless.
  const handleGenerateReport = (format: "pdf" | "csv", reportType: string) => {
    // Quick Generate used to always produce last calendar month, whatever the
    // page's period selector said. It follows the selector now.
    const startDate = period.from;
    const endDate = period.to;

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
        const result = await exportDashboardPDF(period.payload);

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

  const actions = useMemo<ReportActions>(
    () => ({
      reports: initialReports,
      onGeneratePDF: (reportType: string) => handleGenerateReport("pdf", reportType),
      onGenerateCSV: (reportType: string) => handleGenerateReport("csv", reportType),
      onExportDashboard: handleExportDashboard,
      isGenerating: isPending,
    }),
    // The two handlers close over `period` and the transition, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialReports, isPending, period.from, period.to],
  );

  return (
    <ReportActionsContext.Provider value={actions}>
      {children}
    </ReportActionsContext.Provider>
  );
}
