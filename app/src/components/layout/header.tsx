"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, LogOut, User, Truck, Receipt, AlertTriangle, Users, CheckCircle2, Clock, X } from "lucide-react";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, dismissNotification as dismissNotificationAction } from "@/app/(dashboard)/notifications/actions";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/providers/session-provider";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    link?: string;
    entityType?: string;
    entityId?: string;
}

const typeIcons: Record<string, any> = {
    trip: Truck,
    invoice: Receipt,
    maintenance: AlertTriangle,
    driver: Users,
    customer: Users,
    payment: Receipt,
    expense: Receipt,
    supplier: Users,
    employee: Users,
    general: Bell,
};

const typeColors: Record<string, string> = {
    trip: "text-blue-500",
    invoice: "text-green-500",
    maintenance: "text-orange-500",
    driver: "text-purple-500",
    customer: "text-cyan-500",
    payment: "text-emerald-500",
    expense: "text-red-500",
    supplier: "text-indigo-500",
    employee: "text-violet-500",
    general: "text-gray-500",
};



export function Header() {
    const { user, role } = useSession();
    const router = useRouter();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadNotifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getUserNotifications();
            if (result.success) {
                setNotifications(result.notifications.map((n: any) => ({
                    ...n,
                    createdAt: new Date(n.createdAt)
                })));
            }
        } catch (error) {
            console.error("Failed to load notifications:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleSignOut = async () => {
        await signOut();
        router.push("/sign-in");
    };

    const markAsRead = useCallback(async (id: string) => {
        // Optimistically update UI
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        // Update in database
        await markNotificationAsRead(id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        // Optimistically update UI
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        // Update in database
        await markAllNotificationsAsRead();
    }, []);

    const dismissNotification = useCallback(async (id: string) => {
        // Optimistically update UI
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        // Update in database
        await dismissNotificationAction(id);
    }, []);

    const handleNotificationClick = (notification: NotificationItem) => {
        markAsRead(notification.id);
        if (notification.link) {
            router.push(notification.link);
            setNotificationsOpen(false);
        }
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "??";

    return (
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold text-muted-foreground">
                    WD Logistics Management System
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {/* Notifications */}
                <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
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
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={markAllAsRead}
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
                                        const Icon = typeIcons[notification.type] || Bell;
                                        const colorClass = typeColors[notification.type] || "text-gray-500";
                                        return (
                                            <div
                                                key={notification.id}
                                                className={cn(
                                                    "group relative flex gap-3 p-4 transition-colors hover:bg-muted/50 cursor-pointer",
                                                    !notification.isRead && "bg-primary/5"
                                                )}
                                                onClick={() => handleNotificationClick(notification)}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
                                                        colorClass
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 space-y-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p
                                                            className={cn(
                                                                "text-sm leading-tight truncate",
                                                                !notification.isRead && "font-medium"
                                                            )}
                                                        >
                                                            {notification.title}
                                                        </p>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                dismissNotification(notification.id);
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
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
                                    router.push("/settings");
                                    setNotificationsOpen(false);
                                }}
                            >
                                Notification settings
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.name}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email}
                                </p>
                                <p className="text-xs leading-none text-muted-foreground capitalize">
                                    Role: {role}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push("/profile")}>
                            <User className="mr-2 h-4 w-4" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
