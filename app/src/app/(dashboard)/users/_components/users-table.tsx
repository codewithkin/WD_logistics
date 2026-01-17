"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Search, Trash2, Shield, KeyRound, Copy, Check } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { format } from "date-fns";
import { ROLE_LABELS } from "@/lib/types";
import { updateMemberRole, removeMember, resetUserPassword } from "../actions";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Member {
    id: string;
    role: string;
    createdAt: Date;
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
        createdAt: Date;
    };
}

interface UsersTableProps {
    members: Member[];
    currentUserId: string;
}


export function UsersTable({ members, currentUserId }: UsersTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [removeId, setRemoveId] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [changeRoleId, setChangeRoleId] = useState<string | null>(null);
    const [newRole, setNewRole] = useState<string>("");
    const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [newPasswordData, setNewPasswordData] = useState<{
        password: string;
        email: string;
        name: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const filteredMembers = members.filter((member) => {
        const matchesSearch =
            member.user.name.toLowerCase().includes(search.toLowerCase()) ||
            member.user.email.toLowerCase().includes(search.toLowerCase());

        const matchesFilter = roleFilter === "all" || member.role === roleFilter;

        return matchesSearch && matchesFilter;
    });

    const pagination = usePagination({ defaultPageSize: 10, totalItems: filteredMembers.length });
    const paginatedMembers = filteredMembers.slice(pagination.startIndex, pagination.endIndex);

    const handleRemove = async () => {
        if (!removeId) return;
        setIsRemoving(true);
        try {
            const result = await removeMember(removeId);
            if (result.success) {
                toast.success("User removed from organization");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to remove user");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsRemoving(false);
            setRemoveId(null);
        }
    };

    const handleRoleChange = async () => {
        if (!changeRoleId || !newRole) return;
        try {
            const result = await updateMemberRole(changeRoleId, newRole as "admin" | "supervisor" | "staff");
            if (result.success) {
                toast.success("Role updated successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update role");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setChangeRoleId(null);
            setNewRole("");
        }
    };

    const handleResetPassword = async () => {
        if (!resetPasswordId) return;
        setIsResettingPassword(true);
        try {
            const result = await resetUserPassword(resetPasswordId);
            if (result.success && result.newPassword) {
                setNewPasswordData({
                    password: result.newPassword,
                    email: result.userEmail || "",
                    name: result.userName || "",
                });
                toast.success("Password reset successfully. Email sent to user.");
            } else {
                toast.error(result.error || "Failed to reset password");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsResettingPassword(false);
            setResetPasswordId(null);
        }
    };

    const handleCopyPassword = async () => {
        if (newPasswordData?.password) {
            await navigator.clipboard.writeText(newPasswordData.password);
            setCopied(true);
            toast.success("Password copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <>
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMembers.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="text-center h-24 text-muted-foreground"
                                        >
                                            No users found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedMembers.map((member) => {
                                        const isCurrentUser = member.user.id === currentUserId;

                                        return (
                                            <TableRow key={member.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={member.user.image || undefined} />
                                                            <AvatarFallback>
                                                                {getInitials(member.user.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">
                                                                {member.user.name}
                                                                {isCurrentUser && (
                                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                                        (you)
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {member.user.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={member.role} type="role" />
                                                </TableCell>
                                                <TableCell>
                                                    {format(member.createdAt, "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell>
                                                    {!isCurrentUser && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                                                    <DropdownMenuItem
                                                                        key={value}
                                                                        disabled={member.role === value}
                                                                        onClick={() => {
                                                                            setChangeRoleId(member.id);
                                                                            setNewRole(value);
                                                                        }}
                                                                    >
                                                                        <Shield className="mr-2 h-4 w-4" />
                                                                        {label}
                                                                        {member.role === value && " (current)"}
                                                                    </DropdownMenuItem>
                                                                ))}
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => setResetPasswordId(member.id)}
                                                                >
                                                                    <KeyRound className="mr-2 h-4 w-4" />
                                                                    Reset Password
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setRemoveId(member.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Remove from Organization
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-4">
                        <PaginationControls {...pagination} totalItems={filteredMembers.length} />
                    </div>
                </CardContent>
            </Card>

            {/* Remove User Dialog */}
            <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove User</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this user from the organization? They
                            will lose access to all data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemove}
                            disabled={isRemoving}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isRemoving ? "Removing..." : "Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Change Role Confirmation Dialog */}
            <AlertDialog
                open={!!changeRoleId}
                onOpenChange={() => {
                    setChangeRoleId(null);
                    setNewRole("");
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change Role</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change this user&apos;s role to{" "}
                            <strong>{ROLE_LABELS[newRole as keyof typeof ROLE_LABELS]}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRoleChange}>
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reset Password Confirmation Dialog */}
            <AlertDialog
                open={!!resetPasswordId}
                onOpenChange={() => setResetPasswordId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Password</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to reset this user&apos;s password? A new password
                            will be generated and sent to their email.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isResettingPassword}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleResetPassword}
                            disabled={isResettingPassword}
                        >
                            {isResettingPassword ? "Resetting..." : "Reset Password"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* New Password Display Dialog */}
            <Dialog
                open={!!newPasswordData}
                onOpenChange={() => {
                    setNewPasswordData(null);
                    setCopied(false);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Password Reset Successful</DialogTitle>
                        <DialogDescription>
                            A new password has been generated for {newPasswordData?.name}. An email
                            has been sent to the user, but you can also share the password manually
                            if needed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium">{newPasswordData?.email}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">New Password</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                                    {newPasswordData?.password}
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyPassword}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 p-3 rounded-md">
                            <strong>Important:</strong> Save this password now. For security reasons,
                            it won&apos;t be shown again.
                        </p>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={() => {
                            setNewPasswordData(null);
                            setCopied(false);
                        }}>
                            Done
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
