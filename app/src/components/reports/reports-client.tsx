"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportGenerator } from "@/components/reports/report-generator";
import { ReportHistory } from "@/components/reports/report-history";
import { FileText, BarChart3, History } from "lucide-react";

interface Report {
  id: string;
  type: string;
  period: string;
  startDate: Date;
  endDate: Date;
  format: string;
  fileUrl?: string | null;
  createdAt: Date;
}

interface ReportsClientProps {
  customers: { id: string; name: string }[];
  trucks: { id: string; registrationNo: string; make: string; model: string }[];
  initialReports: Report[];
  dashboardContent: React.ReactNode;
}

export function ReportsClient({
  customers,
  trucks,
  initialReports,
  dashboardContent,
}: ReportsClientProps) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleReportGenerated = () => {
    // Trigger a re-fetch of reports
    setRefreshKey((prev) => prev + 1);
    // In a real app, you would refetch the reports here
    // For now, we'll just update the key to show the UI is responsive
  };

  return (
    <Tabs defaultValue="dashboard" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="dashboard" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="generate" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Generate
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="space-y-6">
        {dashboardContent}
      </TabsContent>

      <TabsContent value="generate" className="space-y-6">
        <ReportGenerator
          customers={customers}
          trucks={trucks}
          onReportGenerated={handleReportGenerated}
        />
      </TabsContent>

      <TabsContent value="history" className="space-y-6">
        <ReportHistory reports={reports} key={refreshKey} />
      </TabsContent>
    </Tabs>
  );
}
