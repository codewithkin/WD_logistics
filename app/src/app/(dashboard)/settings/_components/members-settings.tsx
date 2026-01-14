"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MoreHorizontal, Plus, UserPlus, X, Clock, Mail } from "lucide-react";
import {
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvitation,
} from "../actions";
import { toast } from "sonner";
import { format } from "date-fns";

const inviteSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    role: z.enum(["admin", "supervisor", "staff"]),
});

type InviteData = z.infer<typeof inviteSchema>;

interface Member {
    id: string;
    role: string;
    createdAt: Date;
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
}

interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
}

interface MembersSettingsProps {
    members: Member[];
    invitations: Invitation[];
    currentUserId: string;
}

const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    supervisor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    staff: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

export function MembersSettings({
    members,
    invitations,
    currentUserId,
}: MembersSettingsProps) {
    const router = useRouter();
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [updatingMember, setUpdatingMember] = useState<string | null>(null);

    const form = useForm<InviteData>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            email: "",
            role: "staff",
        },
    });

    const onInvite = async (data: InviteData) => {
        setIsLoading(true);
        try {
            const result = await inviteMember(data);
            if (result.success) {
                toast.success("Invitation sent successfully");
                form.reset();
                setIsInviteOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to send invitation");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (memberId: string, role: string) => {
        setUpdatingMember(memberId);
        try {
            const result = await updateMemberRole(memberId, role);
            if (result.success) {
                toast.success("Role updated successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update role");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setUpdatingMember(null);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        setUpdatingMember(memberId);
        try {
            const result = await removeMember(memberId);
            if (result.success) {
                toast.success("Member removed successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to remove member");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setUpdatingMember(null);
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        try {
            const result = await cancelInvitation(invitationId);
            if (result.success) {
                toast.success("Invitation canceled");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to cancel invitation");
            }
        } catch {
            toast.error("An error occurred");
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
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>
                            Manage your organisation&apos;s team members and their roles.
                        </CardDescription>
                    </div>
                    <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Invite Member
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Invite Team Member</DialogTitle>
                                <DialogDescription>
                                    Send an invitation to join your organisation.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onInvite)}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="member@example.com"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="role"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Role</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a role" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="supervisor">
                                                            Supervisor
                                                        </SelectItem>
                                                        <SelectItem value="staff">Staff</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsInviteOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={isLoading}>
                                            {isLoading && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Send Invitation
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.user.image || undefined} />
                                                <AvatarFallback className="text-xs">
                                                    {getInitials(member.user.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">
                                                    {member.user.name}
                                                    {member.user.id === currentUserId && (
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                            (you)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {member.user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className={roleColors[member.role] || ""}
                                        >
                                            {member.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(member.createdAt), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell>
                                        {member.user.id !== currentUserId && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={updatingMember === member.id}
                                                    >
                                                        {updatingMember === member.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            handleRoleChange(member.id, "admin")
                                                        }
                                                        disabled={member.role === "admin"}
                                                    >
                                                        Make Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            handleRoleChange(member.id, "supervisor")
                                                        }
                                                        disabled={member.role === "supervisor"}
                                                    >
                                                        Make Supervisor
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            handleRoleChange(member.id, "staff")
                                                        }
                                                        disabled={member.role === "staff"}
                                                    >
                                                        Make Staff
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        className="text-destructive"
                                                    >
                                                        Remove Member
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {invitations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Pending Invitations
                        </CardTitle>
                        <CardDescription>
                            Invitations that have been sent but not yet accepted.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {invitations.map((invitation) => (
                                <div
                                    key={invitation.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <div className="font-medium">{invitation.email}</div>
                                            <div className="text-sm text-muted-foreground">
                                                Expires{" "}
                                                {format(new Date(invitation.expiresAt), "MMM d, yyyy")}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className={roleColors[invitation.role] || ""}
                                        >
                                            {invitation.role}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleCancelInvitation(invitation.id)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
