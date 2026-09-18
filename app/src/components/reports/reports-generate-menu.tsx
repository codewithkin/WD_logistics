"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import { reportConfigs } from "@/config/reports";
import { reportTypesForTab, needsSelection, TAB_LABELS } from "@/config/report-tabs";

interface ReportsGenerateMenuProps {
  /** The tab currently on screen — this is what makes the menu relevant. */
  activeTab: string;
  onGeneratePDF?: (reportType: string) => void;
  onGenerateCSV?: (reportType: string) => void;
  onExportDashboard?: () => void;
  isGenerating?: boolean;
}

/**
 * The Reports page's "Generate" button.
 *
 * It used to sit outside the tabs and always produce the Revenue report,
 * whatever you were looking at — so from the Fleet tab it silently handed you
 * something unrelated to anything on screen. It now offers the reports that
 * belong to the active tab, and sends truck/customer-scoped reports (which
 * need a record picked first) over to the Generate tab pre-filled.
 */
export function ReportsGenerateMenu({
  activeTab,
  onGeneratePDF,
  onGenerateCSV,
  onExportDashboard,
  isGenerating = false,
}: ReportsGenerateMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabReportTypes = reportTypesForTab(activeTab);

  const goToGenerateTab = (reportType?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "generate");
    if (reportType) {
      params.set("type", reportType);
    } else {
      params.delete("type");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (!onGeneratePDF && !onGenerateCSV) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Generate
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {onExportDashboard && (
          <>
            <DropdownMenuItem onClick={onExportDashboard}>
              <FileText className="mr-2 h-4 w-4" />
              Export Dashboard Summary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {tabReportTypes.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Reports for {TAB_LABELS[activeTab] ?? activeTab}
            </DropdownMenuLabel>
            {tabReportTypes.map((type) => {
              const config = reportConfigs[type];
              if (!config) return null;

              if (needsSelection(type)) {
                return (
                  <DropdownMenuItem key={type} onClick={() => goToGenerateTab(type)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    {config.name}…
                  </DropdownMenuItem>
                );
              }

              return (
                <DropdownMenuSub key={type}>
                  <DropdownMenuSubTrigger>
                    <FileText className="mr-2 h-4 w-4" />
                    {config.name}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {onGeneratePDF && config.formats.includes("pdf") && (
                      <DropdownMenuItem onClick={() => onGeneratePDF(type)}>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                      </DropdownMenuItem>
                    )}
                    {onGenerateCSV && config.formats.includes("csv") && (
                      <DropdownMenuItem onClick={() => onGenerateCSV(type)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        CSV
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={() => goToGenerateTab()}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Choose another report…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
