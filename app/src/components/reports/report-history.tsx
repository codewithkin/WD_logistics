"use client";

import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, Calendar, Clock } from "lucide-react";
import { reportTypeLabels, periodLabels, type ReportPeriod } from "@/config/reports";

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

interface ReportHistoryProps {
  reports: Report[];
}

export function ReportHistory({ reports }: ReportHistoryProps) {
  const getReportTypeLabel = (type: string) => {
    return reportTypeLabels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getPeriodLabel = (period: string) => {
    return periodLabels[period as ReportPeriod] || period;
  };

  const getFormatIcon = (reportFormat: string) => {
    return reportFormat.toLowerCase() === "pdf" ? (
      <FileText className="h-4 w-4 text-red-500" />
    ) : (
      <FileSpreadsheet className="h-4 w-4 text-green-500" />
    );
  };

  const getFormatBadgeVariant = (reportFormat: string): "default" | "secondary" => {
    return reportFormat.toLowerCase() === "pdf" ? "default" : "secondary";
  };

  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet</p>
            <p className="text-sm">Generate your first report using the form above</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report History</CardTitle>
        <CardDescription>Previously generated reports ({reports.length})</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                  {getFormatIcon(report.format)}
                </div>
                <div>
                  <p className="font-medium">{getReportTypeLabel(report.type)}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(report.startDate), "MMM d, yyyy")} -{" "}
                      {format(new Date(report.endDate), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge variant={getFormatBadgeVariant(report.format)}>
                  {report.format.toUpperCase()}
                </Badge>
                <Badge variant="outline">{getPeriodLabel(report.period)}</Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(report.createdAt), "MMM d, HH:mm")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
