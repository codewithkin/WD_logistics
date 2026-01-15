"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportSingleTripReport } from "../../actions";

interface ExportTripButtonProps {
    tripId: string;
    tripName: string;
}

export function ExportTripButton({ tripId, tripName }: ExportTripButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleExport = async () => {
        setIsLoading(true);
        try {
            const result = await exportSingleTripReport(tripId);
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
                link.download = `trip-report-${tripName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast.success("Trip report exported successfully");
            } else {
                toast.error(result.error || "Failed to export trip report");
            }
        } catch {
            toast.error("Failed to export trip report");
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
