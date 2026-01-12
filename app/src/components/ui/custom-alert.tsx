"use client";

import { useState, useEffect } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

type AlertType = "error" | "success" | "info" | "warning";

interface CustomAlertProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    message: string;
    type?: AlertType;
}

const alertConfig = {
    error: {
        icon: XCircle,
        iconClass: "h-5 w-5 text-red-500",
        title: "Error",
    },
    success: {
        icon: CheckCircle,
        iconClass: "h-5 w-5 text-green-500",
        title: "Success",
    },
    info: {
        icon: Info,
        iconClass: "h-5 w-5 text-blue-500",
        title: "Information",
    },
    warning: {
        icon: AlertCircle,
        iconClass: "h-5 w-5 text-yellow-500",
        title: "Warning",
    },
};

export function CustomAlert({
    open,
    onOpenChange,
    title,
    message,
    type = "error",
}: CustomAlertProps) {
    const config = alertConfig[type];
    const Icon = config.icon;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Icon className={config.iconClass} />
                        {title || config.title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-base">
                        {message}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction className="bg-primary hover:bg-primary/90">
                        OK
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// Hook for easier usage
let globalAlertCallback: ((message: string, type?: AlertType, title?: string) => void) | null = null;

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [alertState, setAlertState] = useState<{
        open: boolean;
        message: string;
        type: AlertType;
        title?: string;
    }>({
        open: false,
        message: "",
        type: "error",
    });

    useEffect(() => {
        globalAlertCallback = (message: string, type: AlertType = "error", title?: string) => {
            setAlertState({ open: true, message, type, title });
        };

        return () => {
            globalAlertCallback = null;
        };
    }, []);

    return (
        <>
            {children}
            <CustomAlert
                open={alertState.open}
                onOpenChange={(open) => setAlertState((prev) => ({ ...prev, open }))}
                message={alertState.message}
                type={alertState.type}
                title={alertState.title}
            />
        </>
    );
}

export function showAlert(message: string, type: AlertType = "error", title?: string) {
    if (globalAlertCallback) {
        globalAlertCallback(message, type, title);
    } else {
        // Fallback to native alert if provider not mounted
        alert(message);
    }
}
