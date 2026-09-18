"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportTruckExpensesPDF } from "../../actions";

interface ExportTruckExpensesButtonProps {
    /** Omit to export every truck's expenses in one report. */
    truckId?: string;
    label?: string;
    size?: "sm" | "default";
}

export function ExportTruckExpensesButton({
    truckId,
    label = "Export",
    size = "sm",
}: ExportTruckExpensesButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleExport = async () => {
        setIsLoading(true);
        try {
            const result = await exportTruckExpensesPDF(truckId);

            if (!result.success) {
                toast.error(result.error || "Failed to export expenses");
                return;
            }

            const byteCharacters = atob(result.pdf);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const url = URL.createObjectURL(
                new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" })
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = result.filename || "truck-expenses.pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success("Expenses exported successfully");
        } catch {
            toast.error("Failed to export expenses");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button variant="outline" size={size} onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : truckId ? (
                <Download className="mr-2 h-4 w-4" />
            ) : (
                <FileText className="mr-2 h-4 w-4" />
            )}
            {label}
        </Button>
    );
}
