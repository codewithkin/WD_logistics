"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Bell,
    Truck,
    Receipt,
    AlertTriangle,
    Users,
    CheckCircle2,
    Clock,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
    id: string;
    type: "trip" | "invoice" | "maintenance" | "driver" | "general";
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    link?: string;
}

interface NotificationsPopoverProps {
    notifications: NotificationItem[];
    onMarkAsRead?: (id: string) => Promise<void>;
    onMarkAllAsRead?: () => Promise<void>;
    onDismiss?: (id: string) => Promise<void>;
}

const typeIcons = {
    trip: Truck,
    invoice: Receipt,
    maintenance: AlertTriangle,
    driver: Users,
    general: Bell,
};

const typeColors = {
    trip: "text-blue-500",
    invoice: "text-green-500",
    maintenance: "text-orange-500",
    driver: "text-purple-500",
    general: "text-gray-500",
};

export function NotificationsPopover({
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onDismiss,
}: NotificationsPopoverProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const handleNotificationClick = async (notification: NotificationItem) => {
        if (!notification.isRead && onMarkAsRead) {
            await onMarkAsRead(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                        >
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h4 className="font-semibold">Notifications</h4>
                    {unreadCount > 0 && onMarkAllAsRead && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onMarkAllAsRead}
                            className="text-xs h-auto py-1"
                        >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Mark all read
                        </Button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">
                            No notifications yet
                        </p>
                        <p className="text-xs text-muted-foreground/75 mt-1">
                            We&apos;ll notify you when something happens
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="h-80">
                        <div className="divide-y">
                            {notifications.map((notification) => {
                                const Icon = typeIcons[notification.type];
                                return (
                                    <div
                                        key={notification.id}
                                        className={cn(
                                            "relative flex gap-3 p-4 transition-colors hover:bg-muted/50 cursor-pointer",
                                            !notification.isRead && "bg-primary/5"
                                        )}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div
                                            className={cn(
                                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
                                                typeColors[notification.type]
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <p
                                                    className={cn(
                                                        "text-sm leading-tight",
                                                        !notification.isRead && "font-medium"
                                                    )}
                                                >
                                                    {notification.title}
                                                </p>
                                                {onDismiss && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 shrink-0 opacity-0 hover:opacity-100 group-hover:opacity-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDismiss(notification.id);
                                                        }}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-muted-foreground/75 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(notification.createdAt), {
                                                    addSuffix: true,
                                                })}
                                            </p>
                                        </div>
                                        {!notification.isRead && (
                                            <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <div className="border-t p-2">
                    <Button
                        variant="ghost"
                        className="w-full text-sm"
                        onClick={() => {
                            router.push("/notifications");
                            setOpen(false);
                        }}
                    >
                        View all notifications
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
