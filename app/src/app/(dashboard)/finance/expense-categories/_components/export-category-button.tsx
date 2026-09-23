"use client";

/**
 * Exports what is on screen: the same period and the same entity filters, read
 * from the URL rather than rebuilt here, so the file and the table agree.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePeriodRange } from "@/lib/use-period-range";
import { exportCategoryExpensesPDF } from "../actions";

export function ExportCategoryButton({ categoryId }: { categoryId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const period = usePeriodRange("3m");

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const result = await exportCategoryExpensesPDF({
        categoryId,
        period: period.payload,
        filters: {
          truckId: searchParams.get("truckId") ?? undefined,
          trailerId: searchParams.get("trailerId") ?? undefined,
          tripId: searchParams.get("tripId") ?? undefined,
          driverId: searchParams.get("driverId") ?? undefined,
          supplierId: searchParams.get("supplierId") ?? undefined,
          paid: searchParams.get("paid") ?? undefined,
        },
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Expenses exported");
    } catch {
      toast.error("Could not export these expenses.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export
    </Button>
  );
}
