"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportSingleTrailerReport } from "../../actions";

interface ExportTrailerButtonProps {
    trailerId: string;
    trailerName: string;
}

/** Mirrors ExportTruckButton; trailers have no period-scoped figures to pass. */
export function ExportTrailerButton({ trailerId, trailerName }: ExportTrailerButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleExport = async () => {
        setIsLoading(true);
        try {
            const result = await exportSingleTrailerReport(trailerId);

            if (result.success) {
                const byteCharacters = atob(result.pdf);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download =
                    result.filename ||
                    `trailer-report-${trailerName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast.success("Trailer report exported successfully");
            } else {
                toast.error(result.error || "Failed to export trailer report");
            }
        } catch {
            toast.error("Failed to export trailer report");
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
