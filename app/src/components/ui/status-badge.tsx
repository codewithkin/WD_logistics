"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    Wrench,
    Truck,
    Calendar,
    Play,
    Ban,
    PauseCircle,
    UserX,
    FileText,
    Send,
    CreditCard,
    AlertTriangle,
    CircleDashed,
    Shield,
    ShieldCheck,
    User,
    type LucideIcon,
} from "lucide-react";

// Status configuration with colors and icons
type StatusConfig = {
    label: string;
    bgColor: string;
    textColor: string;
    icon: LucideIcon;
};

// Truck statuses
const truckStatusConfig: Record<string, StatusConfig> = {
    active: {
        label: "Active",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    in_service: {
        label: "In Service",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-400",
        icon: Wrench,
    },
    in_repair: {
        label: "In Repair",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        textColor: "text-orange-700 dark:text-orange-400",
        icon: Wrench,
    },
    inactive: {
        label: "Inactive",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        textColor: "text-gray-600 dark:text-gray-400",
        icon: PauseCircle,
    },
    decommissioned: {
        label: "Decommissioned",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-400",
        icon: XCircle,
    },
};

// Driver statuses
const driverStatusConfig: Record<string, StatusConfig> = {
    active: {
        label: "Active",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    on_leave: {
        label: "On Leave",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-700 dark:text-amber-400",
        icon: Calendar,
    },
    suspended: {
        label: "Suspended",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        textColor: "text-orange-700 dark:text-orange-400",
        icon: Ban,
    },
    terminated: {
        label: "Terminated",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-400",
        icon: UserX,
    },
};

// Employee statuses (same as driver)
const employeeStatusConfig = driverStatusConfig;

// Customer statuses
const customerStatusConfig: Record<string, StatusConfig> = {
    active: {
        label: "Active",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    inactive: {
        label: "Inactive",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        textColor: "text-gray-600 dark:text-gray-400",
        icon: PauseCircle,
    },
    suspended: {
        label: "Suspended",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        textColor: "text-orange-700 dark:text-orange-400",
        icon: Ban,
    },
};

// Trip statuses
const tripStatusConfig: Record<string, StatusConfig> = {
    scheduled: {
        label: "Scheduled",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-400",
        icon: Calendar,
    },
    in_progress: {
        label: "In Progress",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-700 dark:text-amber-400",
        icon: Play,
    },
    completed: {
        label: "Completed",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    cancelled: {
        label: "Cancelled",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-400",
        icon: XCircle,
    },
};

// Invoice statuses
const invoiceStatusConfig: Record<string, StatusConfig> = {
    draft: {
        label: "Draft",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        textColor: "text-gray-600 dark:text-gray-400",
        icon: FileText,
    },
    sent: {
        label: "Sent",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-400",
        icon: Send,
    },
    paid: {
        label: "Paid",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    partial: {
        label: "Partial",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-700 dark:text-amber-400",
        icon: CreditCard,
    },
    overdue: {
        label: "Overdue",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-400",
        icon: AlertTriangle,
    },
    cancelled: {
        label: "Cancelled",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        textColor: "text-gray-600 dark:text-gray-400",
        icon: XCircle,
    },
};

// Edit request statuses
const editRequestStatusConfig: Record<string, StatusConfig> = {
    pending: {
        label: "Pending",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-700 dark:text-amber-400",
        icon: Clock,
    },
    approved: {
        label: "Approved",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
    },
    rejected: {
        label: "Rejected",
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-400",
        icon: XCircle,
    },
};

// Payment method styling
const paymentMethodConfig: Record<string, StatusConfig> = {
    cash: {
        label: "Cash",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        icon: CreditCard,
    },
    bank_transfer: {
        label: "Bank Transfer",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-400",
        icon: CreditCard,
    },
    check: {
        label: "Check",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
        textColor: "text-purple-700 dark:text-purple-400",
        icon: FileText,
    },
    mobile_money: {
        label: "Mobile Money",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        textColor: "text-orange-700 dark:text-orange-400",
        icon: CreditCard,
    },
    other: {
        label: "Other",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        textColor: "text-gray-600 dark:text-gray-400",
        icon: CircleDashed,
    },
};

// Role styling
const roleStatusConfig: Record<string, StatusConfig> = {
    admin: {
        label: "Admin",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
        textColor: "text-purple-700 dark:text-purple-400",
        icon: ShieldCheck,
    },
    supervisor: {
        label: "Supervisor",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-400",
        icon: Shield,
    },
    staff: {
        label: "Staff",
        bgColor: "bg-gray-100 dark:bg-gray-800",
        textColor: "text-gray-600 dark:text-gray-400",
        icon: User,
    },
};

// All config maps
const statusConfigMap = {
    truck: truckStatusConfig,
    driver: driverStatusConfig,
    employee: employeeStatusConfig,
    customer: customerStatusConfig,
    trip: tripStatusConfig,
    invoice: invoiceStatusConfig,
    editRequest: editRequestStatusConfig,
    paymentMethod: paymentMethodConfig,
    role: roleStatusConfig,
} as const;

export type StatusType = keyof typeof statusConfigMap;

interface StatusBadgeProps {
    status: string;
    type: StatusType;
    showIcon?: boolean;
    className?: string;
}

export function StatusBadge({
    status,
    type,
    showIcon = true,
    className,
}: StatusBadgeProps) {
    const config = statusConfigMap[type]?.[status];

    if (!config) {
        // Fallback for unknown statuses
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
                    className
                )}
            >
                {showIcon && <CircleDashed className="h-3.5 w-3.5" />}
                {status}
            </span>
        );
    }

    const Icon = config.icon;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                config.bgColor,
                config.textColor,
                className
            )}
        >
            {showIcon && <Icon className="h-3.5 w-3.5" />}
            {config.label}
        </span>
    );
}

// Export configs for use elsewhere if needed
export {
    truckStatusConfig,
    driverStatusConfig,
    employeeStatusConfig,
    customerStatusConfig,
    tripStatusConfig,
    invoiceStatusConfig,
    editRequestStatusConfig,
    paymentMethodConfig,
    roleStatusConfig,
};
