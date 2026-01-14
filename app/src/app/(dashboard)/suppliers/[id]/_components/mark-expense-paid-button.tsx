"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { markExpenseAsPaid } from "../../actions";
import { toast } from "sonner";

interface MarkExpensePaidButtonProps {
    expenseId: string;
}

export function MarkExpensePaidButton({ expenseId }: MarkExpensePaidButtonProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        try {
            const result = await markExpenseAsPaid(expenseId);
            if (result.success) {
                toast.success("Expense marked as paid");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to mark expense as paid");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={isLoading}
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Pay
                </>
            )}
        </Button>
    );
}
