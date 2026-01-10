"use client";

import { createContext, useContext, ReactNode } from "react";
import { Role } from "@/lib/types";
import { getPermissions, RolePermissions } from "@/lib/permissions";

interface SessionUser {
    id: string;
    name: string;
    email: string;
    image?: string | null;
}

interface SessionContextType {
    user: SessionUser | null;
    role: Role;
    organizationId: string | null;
    permissions: RolePermissions;
    isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
    children: ReactNode;
    user: SessionUser | null;
    role: Role;
    organizationId: string | null;
    isLoading?: boolean;
}

export function SessionProvider({
    children,
    user,
    role,
    organizationId,
    isLoading = false,
}: SessionProviderProps) {
    const permissions = getPermissions(role);

    return (
        <SessionContext.Provider
            value={{
                user,
                role,
                organizationId,
                permissions,
                isLoading,
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error("useSession must be used within a SessionProvider");
    }
    return context;
}

export function useRole() {
    const { role } = useSession();
    return role;
}

export function usePermissions() {
    const { permissions } = useSession();
    return permissions;
}

export function useUser() {
    const { user } = useSession();
    return user;
}
