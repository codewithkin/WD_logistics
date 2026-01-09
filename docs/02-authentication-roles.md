# WD Logistics - Authentication & Roles

## Overview

This document outlines the authentication system using better-auth with the Organizations plugin, implementing role-based access control (RBAC) for WD Logistics.

## better-auth Configuration

### Installation

```bash
npm install better-auth @better-auth/prisma
```

### Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma";
import { organization } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  plugins: [
    organization({
      // Custom roles for WD Logistics
      roles: {
        admin: {
          // Full system access
          permissions: [
            // User Management
            "user:create",
            "user:read",
            "user:update",
            "user:delete",
            
            // Truck Management
            "truck:create",
            "truck:read",
            "truck:update",
            "truck:delete",
            
            // Driver Management
            "driver:create",
            "driver:read",
            "driver:update",
            "driver:delete",
            
            // Employee Management
            "employee:create",
            "employee:read",
            "employee:update",
            "employee:delete",
            
            // Customer Management
            "customer:create",
            "customer:read",
            "customer:update",
            "customer:delete",
            
            // Trip Management
            "trip:create",
            "trip:read",
            "trip:update",
            "trip:delete",
            
            // Expense Management
            "expense:create",
            "expense:read",
            "expense:update",
            "expense:delete",
            
            // Invoice Management
            "invoice:create",
            "invoice:read",
            "invoice:update",
            "invoice:delete",
            
            // Payment Management
            "payment:create",
            "payment:read",
            "payment:update",
            "payment:delete",
            
            // Inventory Management
            "inventory:create",
            "inventory:read",
            "inventory:update",
            "inventory:delete",
            
            // Report Access
            "report:generate",
            "report:read",
            "report:download",
            
            // Edit Request Management
            "editRequest:approve",
            "editRequest:reject",
            "editRequest:read",
            
            // Organization Settings
            "organization:update",
            "organization:settings",
          ],
        },
        
        supervisor: {
          // Everything except reports and editing other users
          permissions: [
            // Truck Management
            "truck:create",
            "truck:read",
            "truck:update",
            "truck:delete",
            
            // Driver Management
            "driver:create",
            "driver:read",
            "driver:update",
            "driver:delete",
            
            // Customer Management
            "customer:create",
            "customer:read",
            "customer:update",
            "customer:delete",
            
            // Trip Management
            "trip:create",
            "trip:read",
            "trip:update",
            "trip:delete",
            
            // Expense Management
            "expense:create",
            "expense:read",
            "expense:update",
            "expense:delete",
            
            // Invoice Management
            "invoice:create",
            "invoice:read",
            "invoice:update",
            "invoice:delete",
            
            // Payment Management
            "payment:create",
            "payment:read",
            "payment:update",
            "payment:delete",
            
            // Inventory Management
            "inventory:create",
            "inventory:read",
            "inventory:update",
            "inventory:delete",
            
            // Employee - Read only (cannot edit)
            "employee:read",
            
            // Edit Request - Can view only
            "editRequest:read",
            
            // NO report permissions
            // NO user management permissions
            // NO organization settings
          ],
        },
        
        staff: {
          // Limited access, edits require approval
          permissions: [
            // Read-only access to most resources
            "truck:read",
            "driver:read",
            "customer:read",
            "trip:read",
            "expense:read",
            "invoice:read",
            "payment:read",
            "inventory:read",
            "employee:read",
            
            // Can create new entries
            "trip:create",
            "expense:create",
            "payment:create",
            
            // Special permission for requesting edits
            "editRequest:create",
            "editRequest:read",
            
            // NO update/delete permissions - requires edit request
            // NO report permissions
            // NO user management
          ],
        },
      },
      
      // Default role for new members
      defaultRole: "staff",
    }),
  ],
});

export type Auth = typeof auth;
```

### Auth Client (Frontend)

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    organizationClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useOrganization,
  getSession,
} = authClient;
```

## Role Permissions Matrix

| Feature | Admin | Supervisor | Staff |
|---------|-------|------------|-------|
| **User Management** |
| Create users | ✅ | ❌ | ❌ |
| View users | ✅ | ❌ | ❌ |
| Edit users | ✅ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ |
| **Truck Management** |
| Create trucks | ✅ | ✅ | ❌ |
| View trucks | ✅ | ✅ | ✅ |
| Edit trucks | ✅ | ✅ | 🔶 Request |
| Delete trucks | ✅ | ✅ | ❌ |
| **Driver Management** |
| Create drivers | ✅ | ✅ | ❌ |
| View drivers | ✅ | ✅ | ✅ |
| Edit drivers | ✅ | ✅ | 🔶 Request |
| Delete drivers | ✅ | ✅ | ❌ |
| **Employee Management** |
| Create employees | ✅ | ❌ | ❌ |
| View employees | ✅ | ✅ | ✅ |
| Edit employees | ✅ | ❌ | ❌ |
| Delete employees | ✅ | ❌ | ❌ |
| **Customer Management** |
| Create customers | ✅ | ✅ | ❌ |
| View customers | ✅ | ✅ | ✅ |
| Edit customers | ✅ | ✅ | 🔶 Request |
| Delete customers | ✅ | ✅ | ❌ |
| **Trip Management** |
| Create trips | ✅ | ✅ | ✅ |
| View trips | ✅ | ✅ | ✅ |
| Edit trips | ✅ | ✅ | 🔶 Request |
| Delete trips | ✅ | ✅ | ❌ |
| **Expense Management** |
| Create expenses | ✅ | ✅ | ✅ |
| View expenses | ✅ | ✅ | ✅ |
| Edit expenses | ✅ | ✅ | 🔶 Request |
| Delete expenses | ✅ | ✅ | ❌ |
| **Invoice Management** |
| Create invoices | ✅ | ✅ | ❌ |
| View invoices | ✅ | ✅ | ✅ |
| Edit invoices | ✅ | ✅ | ❌ |
| Delete invoices | ✅ | ✅ | ❌ |
| **Payment Management** |
| Record payments | ✅ | ✅ | ✅ |
| View payments | ✅ | ✅ | ✅ |
| Edit payments | ✅ | ✅ | 🔶 Request |
| Delete payments | ✅ | ✅ | ❌ |
| **Inventory Management** |
| Add items | ✅ | ✅ | ❌ |
| View items | ✅ | ✅ | ✅ |
| Allocate parts | ✅ | ✅ | ✅ |
| Edit items | ✅ | ✅ | 🔶 Request |
| Delete items | ✅ | ✅ | ❌ |
| **Reports** |
| Generate reports | ✅ | ❌ | ❌ |
| View reports | ✅ | ❌ | ❌ |
| Download reports | ✅ | ❌ | ❌ |
| **Edit Requests** |
| Create requests | ❌ | ❌ | ✅ |
| View requests | ✅ | ✅ | ✅ (own) |
| Approve/Reject | ✅ | ❌ | ❌ |
| **Organization Settings** |
| Update settings | ✅ | ❌ | ❌ |

🔶 = Requires edit request with reason, admin approval needed

## Edit Request Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   STAFF EDIT WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Staff wants to edit a record                            │
│          │                                                  │
│          ▼                                                  │
│  2. System shows "Request Edit" modal                       │
│     - Shows current data                                    │
│     - Form for proposed changes                             │
│     - Required: Reason for edit                             │
│          │                                                  │
│          ▼                                                  │
│  3. EditRequest created with status: PENDING                │
│          │                                                  │
│          ▼                                                  │
│  4. Admin receives notification                             │
│     - Dashboard shows pending requests                      │
│     - Can view original vs proposed                         │
│          │                                                  │
│          ├──────────────────┬───────────────────┐           │
│          ▼                  ▼                   ▼           │
│     [APPROVED]         [REJECTED]          [PENDING]        │
│          │                  │                   │           │
│          ▼                  ▼                   │           │
│  5a. Apply changes     5b. Notify staff         │           │
│      to record             with reason          │           │
│          │                  │                   │           │
│          ▼                  ▼                   ▼           │
│  6. Notify staff       Staff can            Awaiting       │
│     of approval        resubmit              review        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Middleware

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/register", "/forgot-password"];

// Role-based route access
const roleRoutes: Record<string, string[]> = {
  admin: [
    "/dashboard",
    "/users",
    "/trucks",
    "/drivers",
    "/employees",
    "/customers",
    "/trips",
    "/expenses",
    "/invoices",
    "/payments",
    "/inventory",
    "/reports",
    "/edit-requests",
    "/settings",
  ],
  supervisor: [
    "/dashboard",
    "/trucks",
    "/drivers",
    "/employees",
    "/customers",
    "/trips",
    "/expenses",
    "/invoices",
    "/payments",
    "/inventory",
    "/edit-requests",
  ],
  staff: [
    "/dashboard",
    "/trucks",
    "/drivers",
    "/customers",
    "/trips",
    "/expenses",
    "/invoices",
    "/payments",
    "/inventory",
    "/edit-requests",
  ],
};

// Admin-only routes
const adminOnlyRoutes = ["/users", "/reports", "/settings", "/employees/new", "/employees/edit"];

// Report routes (admin only)
const reportRoutes = ["/reports"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Get user's role in organization
  const member = session.user.members?.[0]; // Active organization member
  const role = member?.role || "staff";

  // Check admin-only routes
  if (adminOnlyRoutes.some((route) => pathname.startsWith(route))) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Check report routes
  if (reportRoutes.some((route) => pathname.startsWith(route))) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Check if user has access to route
  const allowedRoutes = roleRoutes[role] || [];
  const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route));

  if (!hasAccess) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## Permission Hooks

```typescript
// hooks/use-permissions.ts
import { useSession, useOrganization } from "@/lib/auth-client";

type Permission = 
  | "user:create" | "user:read" | "user:update" | "user:delete"
  | "truck:create" | "truck:read" | "truck:update" | "truck:delete"
  | "driver:create" | "driver:read" | "driver:update" | "driver:delete"
  | "employee:create" | "employee:read" | "employee:update" | "employee:delete"
  | "customer:create" | "customer:read" | "customer:update" | "customer:delete"
  | "trip:create" | "trip:read" | "trip:update" | "trip:delete"
  | "expense:create" | "expense:read" | "expense:update" | "expense:delete"
  | "invoice:create" | "invoice:read" | "invoice:update" | "invoice:delete"
  | "payment:create" | "payment:read" | "payment:update" | "payment:delete"
  | "inventory:create" | "inventory:read" | "inventory:update" | "inventory:delete"
  | "report:generate" | "report:read" | "report:download"
  | "editRequest:create" | "editRequest:approve" | "editRequest:reject" | "editRequest:read"
  | "organization:update" | "organization:settings";

export function usePermissions() {
  const { data: session } = useSession();
  const { data: organization } = useOrganization();
  
  const member = organization?.members?.find(
    (m) => m.userId === session?.user?.id
  );
  
  const role = member?.role || "staff";
  
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isStaff = role === "staff";
  
  const hasPermission = (permission: Permission): boolean => {
    // Permission mapping based on role
    const rolePermissions: Record<string, Permission[]> = {
      admin: [
        "user:create", "user:read", "user:update", "user:delete",
        "truck:create", "truck:read", "truck:update", "truck:delete",
        "driver:create", "driver:read", "driver:update", "driver:delete",
        "employee:create", "employee:read", "employee:update", "employee:delete",
        "customer:create", "customer:read", "customer:update", "customer:delete",
        "trip:create", "trip:read", "trip:update", "trip:delete",
        "expense:create", "expense:read", "expense:update", "expense:delete",
        "invoice:create", "invoice:read", "invoice:update", "invoice:delete",
        "payment:create", "payment:read", "payment:update", "payment:delete",
        "inventory:create", "inventory:read", "inventory:update", "inventory:delete",
        "report:generate", "report:read", "report:download",
        "editRequest:approve", "editRequest:reject", "editRequest:read",
        "organization:update", "organization:settings",
      ],
      supervisor: [
        "truck:create", "truck:read", "truck:update", "truck:delete",
        "driver:create", "driver:read", "driver:update", "driver:delete",
        "employee:read",
        "customer:create", "customer:read", "customer:update", "customer:delete",
        "trip:create", "trip:read", "trip:update", "trip:delete",
        "expense:create", "expense:read", "expense:update", "expense:delete",
        "invoice:create", "invoice:read", "invoice:update", "invoice:delete",
        "payment:create", "payment:read", "payment:update", "payment:delete",
        "inventory:create", "inventory:read", "inventory:update", "inventory:delete",
        "editRequest:read",
      ],
      staff: [
        "truck:read",
        "driver:read",
        "employee:read",
        "customer:read",
        "trip:create", "trip:read",
        "expense:create", "expense:read",
        "payment:create", "payment:read",
        "invoice:read",
        "inventory:read",
        "editRequest:create", "editRequest:read",
      ],
    };
    
    return rolePermissions[role]?.includes(permission) || false;
  };
  
  const canEdit = (entity: string): boolean => {
    if (isAdmin || isSupervisor) {
      return hasPermission(`${entity}:update` as Permission);
    }
    // Staff can only request edits
    return false;
  };
  
  const canRequestEdit = (): boolean => {
    return isStaff;
  };
  
  return {
    role,
    isAdmin,
    isSupervisor,
    isStaff,
    hasPermission,
    canEdit,
    canRequestEdit,
  };
}
```

## Protected Components

```typescript
// components/auth/require-permission.tsx
"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { ReactNode } from "react";

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission as any)) {
    return fallback;
  }
  
  return <>{children}</>;
}

// Usage example:
// <RequirePermission permission="report:generate">
//   <Button>Generate Report</Button>
// </RequirePermission>
```

```typescript
// components/auth/require-role.tsx
"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { ReactNode } from "react";

interface RequireRoleProps {
  roles: ("admin" | "supervisor" | "staff")[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({
  roles,
  children,
  fallback = null,
}: RequireRoleProps) {
  const { role } = usePermissions();
  
  if (!roles.includes(role as any)) {
    return fallback;
  }
  
  return <>{children}</>;
}

// Usage example:
// <RequireRole roles={["admin"]}>
//   <Link href="/users">User Management</Link>
// </RequireRole>
```

## Organization Setup

When setting up WD Logistics:

```typescript
// Initial organization setup script
import { prisma } from "@/lib/prisma";

async function setupOrganization() {
  // Create the WD Logistics organization
  const org = await prisma.organization.create({
    data: {
      name: "WD Logistics",
      slug: "wd-logistics",
      metadata: {
        logo: "/images/wd-logo.png",
        primaryColor: "#1E40AF",
        address: "Harare, Zimbabwe",
        phone: "+263 XX XXX XXXX",
        email: "info@wdlogistics.co.zw",
      },
    },
  });

  // Create default expense categories
  const categories = [
    { name: "Fuel", isTrip: true, isTruck: true, color: "#EF4444" },
    { name: "Toll Fees", isTrip: true, isTruck: false, color: "#F59E0B" },
    { name: "Border Fees", isTrip: true, isTruck: false, color: "#10B981" },
    { name: "Accommodation", isTrip: true, isTruck: false, color: "#3B82F6" },
    { name: "Tires", isTrip: false, isTruck: true, color: "#6366F1" },
    { name: "Service", isTrip: false, isTruck: true, color: "#8B5CF6" },
    { name: "Repairs", isTrip: false, isTruck: true, color: "#EC4899" },
    { name: "Insurance", isTrip: false, isTruck: true, color: "#14B8A6" },
    { name: "License & Permits", isTrip: false, isTruck: true, color: "#F97316" },
    { name: "Parts & Accessories", isTrip: false, isTruck: true, color: "#84CC16" },
  ];

  for (const cat of categories) {
    await prisma.expenseCategory.create({
      data: {
        organizationId: org.id,
        ...cat,
      },
    });
  }

  console.log("Organization setup complete:", org.id);
  return org;
}
```
