"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { reportConfigs } from "@/config/reports";

interface GenerateReportLinkProps {
  /** A key of `reportConfigs`; the Generate tab opens pre-filled with it. */
  reportType: string;
  label?: string;
}

/**
 * Sends the user to the Generate tab with a report type already chosen,
 * instead of leaving them to find it again in a blank form. Uses the same
 * `router.push` + search-param pattern as the tab switcher itself, so the
 * back button and a copied URL both behave.
 */
export function GenerateReportLink({ reportType, label }: GenerateReportLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const config = reportConfigs[reportType];
  if (!config) return null;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "generate");
    params.set("type", reportType);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <SlidersHorizontal className="mr-2 h-4 w-4" />
      {label ?? "Generate this report"}
    </Button>
  );
}
