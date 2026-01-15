"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportSingleTruckReport } from "../../actions";

interface ExportTruckButtonProps {
    truckId: string;
    truckName: string;
}

export function ExportTruckButton({ truckId, truckName }: ExportTruckButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const searchParams = useSearchParams();

    const handleExport = async () => {
        setIsLoading(true);
        try {
            // Pass current period params to the export
            const period = searchParams.get("period") || "3m";
            const from = searchParams.get("from");
            const to = searchParams.get("to");

            const result = await exportSingleTruckReport(truckId, { period, from: from || undefined, to: to || undefined });
            if (result.success && result.pdfBase64) {
                // Convert base64 to blob and download
                const byteCharacters = atob(result.pdfBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/pdf" });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `truck-report-${truckName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast.success("Truck report exported successfully");
            } else {
                toast.error(result.error || "Failed to export truck report");
            }
        } catch {
            toast.error("Failed to export truck report");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button variant="outline" onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
                <Download className="h-4 w-4 mr-2" />
            )}
            Export Report
        </Button>
    );
}
