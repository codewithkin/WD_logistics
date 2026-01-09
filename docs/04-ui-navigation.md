# WD Logistics - UI/UX & Navigation

## Overview

This document outlines the user interface design, navigation structure, and role-based component visibility using Next.js App Router and shadcn/ui components.

## Design System

### Brand Colors

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",  // Primary
          600: "#2563EB",
          700: "#1D4ED8",  // Dark
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        // Semantic colors
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
    },
  },
};
```

### Typography

- **Headings**: Inter (Bold)
- **Body**: Inter (Regular)
- **Monospace**: JetBrains Mono (for data/numbers)

## Application Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        TOP HEADER                            │   │
│  │  [Logo]  WD Logistics                    [User] [Notif] [?] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌──────────┬──────────────────────────────────────────────────┐   │
│  │          │                                                   │   │
│  │          │                                                   │   │
│  │  SIDEBAR │               MAIN CONTENT AREA                  │   │
│  │          │                                                   │   │
│  │  - Link  │   ┌─────────────────────────────────────────┐    │   │
│  │  - Link  │   │          PAGE HEADER                     │    │   │
│  │  - Link  │   │  Title            [Actions]              │    │   │
│  │  - Link  │   └─────────────────────────────────────────┘    │   │
│  │          │                                                   │   │
│  │          │   ┌─────────────────────────────────────────┐    │   │
│  │          │   │                                          │    │   │
│  │          │   │          PAGE CONTENT                    │    │   │
│  │          │   │                                          │    │   │
│  │          │   │                                          │    │   │
│  │          │   └─────────────────────────────────────────┘    │   │
│  │          │                                                   │   │
│  └──────────┴──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Sidebar Navigation

### Navigation Structure by Role

```typescript
// config/navigation.ts
import {
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  Route,
  Receipt,
  FileText,
  Package,
  BarChart3,
  Settings,
  UserCog,
  ClipboardEdit,
  DollarSign,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType;
  roles: ("admin" | "supervisor" | "staff")[];
  badge?: string;
  children?: NavItem[];
}

export const navigationConfig: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "supervisor", "staff"],
  },
  {
    title: "Fleet",
    href: "/fleet",
    icon: Truck,
    roles: ["admin", "supervisor", "staff"],
    children: [
      {
        title: "Trucks",
        href: "/fleet/trucks",
        icon: Truck,
        roles: ["admin", "supervisor", "staff"],
      },
      {
        title: "Drivers",
        href: "/fleet/drivers",
        icon: Users,
        roles: ["admin", "supervisor", "staff"],
      },
    ],
  },
  {
    title: "Operations",
    href: "/operations",
    icon: Route,
    roles: ["admin", "supervisor", "staff"],
    children: [
      {
        title: "Trips",
        href: "/operations/trips",
        icon: Route,
        roles: ["admin", "supervisor", "staff"],
      },
      {
        title: "Expenses",
        href: "/operations/expenses",
        icon: Receipt,
        roles: ["admin", "supervisor", "staff"],
      },
    ],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Building2,
    roles: ["admin", "supervisor", "staff"],
  },
  {
    title: "Invoices & Payments",
    href: "/finance",
    icon: DollarSign,
    roles: ["admin", "supervisor", "staff"],
    children: [
      {
        title: "Invoices",
        href: "/finance/invoices",
        icon: FileText,
        roles: ["admin", "supervisor", "staff"],
      },
      {
        title: "Payments",
        href: "/finance/payments",
        icon: DollarSign,
        roles: ["admin", "supervisor", "staff"],
      },
    ],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["admin", "supervisor", "staff"],
  },
  {
    title: "Employees",
    href: "/employees",
    icon: UserCog,
    roles: ["admin", "supervisor", "staff"], // Staff can view, only Admin can edit
  },
  {
    title: "Edit Requests",
    href: "/edit-requests",
    icon: ClipboardEdit,
    roles: ["admin", "supervisor", "staff"],
    badge: "pending", // Dynamic badge showing pending count for Admin
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["admin"], // ADMIN ONLY
  },
  {
    title: "User Management",
    href: "/users",
    icon: Users,
    roles: ["admin"], // ADMIN ONLY
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin"], // ADMIN ONLY
  },
];
```

### Sidebar Component

```tsx
// components/layout/sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationConfig, NavItem } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  pendingEditRequests?: number;
}

export function Sidebar({ pendingEditRequests = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Filter navigation based on role
  const filteredNav = navigationConfig.filter((item) =>
    item.roles.includes(role as any)
  );

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => pathname.startsWith(href);

  const renderNavItem = (item: NavItem) => {
    // Filter children by role
    const filteredChildren = item.children?.filter((child) =>
      child.roles.includes(role as any)
    );

    const hasChildren = filteredChildren && filteredChildren.length > 0;
    const isOpen = openMenus.includes(item.title);
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.title)}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-between px-3 py-2 h-10",
                isActive(item.href) && "bg-accent"
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.title}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 space-y-1">
            {filteredChildren.map((child) => (
              <Link key={child.href} href={child.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start px-3 py-2 h-9",
                    isActive(child.href) && "bg-accent font-medium"
                  )}
                >
                  <child.icon className="h-4 w-4 mr-3" />
                  {child.title}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link key={item.href} href={item.href}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start px-3 py-2 h-10",
            isActive(item.href) && "bg-accent font-medium"
          )}
        >
          <Icon className="h-4 w-4 mr-3" />
          {item.title}
          {item.badge === "pending" && pendingEditRequests > 0 && role === "admin" && (
            <Badge variant="destructive" className="ml-auto">
              {pendingEditRequests}
            </Badge>
          )}
        </Button>
      </Link>
    );
  };

  return (
    <aside className="w-64 border-r bg-card h-screen sticky top-0 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">WD</span>
          </div>
          <span className="font-bold text-lg">WD Logistics</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNav.map(renderNavItem)}
      </nav>

      {/* User Role Badge */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Role:</span>
          <Badge variant="outline" className="capitalize">
            {role}
          </Badge>
        </div>
      </div>
    </aside>
  );
}
```

## Page Layouts

### App Router Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── fleet/
│   │   ├── trucks/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   └── drivers/
│   │       ├── page.tsx
│   │       ├── new/
│   │       │   └── page.tsx
│   │       └── [id]/
│   │           ├── page.tsx
│   │           └── edit/
│   │               └── page.tsx
│   ├── operations/
│   │   ├── trips/
│   │   │   └── ...
│   │   └── expenses/
│   │       └── ...
│   ├── customers/
│   │   └── ...
│   ├── finance/
│   │   ├── invoices/
│   │   │   └── ...
│   │   └── payments/
│   │       └── ...
│   ├── inventory/
│   │   └── ...
│   ├── employees/
│   │   └── ...
│   ├── edit-requests/
│   │   └── ...
│   ├── reports/           # Admin only
│   │   └── ...
│   ├── users/             # Admin only
│   │   └── ...
│   ├── settings/          # Admin only
│   │   └── ...
│   └── layout.tsx
└── layout.tsx
```

### Dashboard Layout

```tsx
// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session) {
    redirect("/login");
  }

  // Get pending edit requests count for Admin
  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
  });

  let pendingEditRequests = 0;
  if (member?.role === "ADMIN") {
    pendingEditRequests = await prisma.editRequest.count({
      where: { status: "PENDING" },
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar pendingEditRequests={pendingEditRequests} />
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### Protected Page Component

```tsx
// components/auth/protected-page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Role = "admin" | "supervisor" | "staff";

interface ProtectedPageProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export async function ProtectedPage({
  children,
  allowedRoles,
}: ProtectedPageProps) {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session) {
    redirect("/login");
  }

  if (allowedRoles) {
    const member = await prisma.member.findFirst({
      where: { userId: session.user.id },
    });

    const role = member?.role.toLowerCase() as Role;

    if (!allowedRoles.includes(role)) {
      redirect("/dashboard");
    }
  }

  return <>{children}</>;
}
```

## Role-Based Page Examples

### Reports Page (Admin Only)

```tsx
// app/(dashboard)/reports/page.tsx
import { ProtectedPage } from "@/components/auth/protected-page";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";

export default function ReportsPage() {
  return (
    <ProtectedPage allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reports</h1>
        </div>
        <ReportsDashboard />
      </div>
    </ProtectedPage>
  );
}
```

### Trucks Page (All Roles, Different Actions)

```tsx
// app/(dashboard)/fleet/trucks/page.tsx
import { ProtectedPage } from "@/components/auth/protected-page";
import { TrucksTable } from "@/components/trucks/trucks-table";
import { AddTruckButton } from "@/components/trucks/add-truck-button";
import { RequireRole } from "@/components/auth/require-role";

export default async function TrucksPage() {
  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Trucks</h1>
          {/* Only Admin and Supervisor can add trucks */}
          <RequireRole roles={["admin", "supervisor"]}>
            <AddTruckButton />
          </RequireRole>
        </div>
        <TrucksTable />
      </div>
    </ProtectedPage>
  );
}
```

### Truck Detail Page with Edit Request

```tsx
// app/(dashboard)/fleet/trucks/[id]/page.tsx
"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { EditRequestModal } from "@/components/edit-requests/edit-request-modal";
import { useState } from "react";

export default function TruckDetailPage({ params }: { params: { id: string } }) {
  const { role, canEdit, canRequestEdit } = usePermissions();
  const [showEditRequest, setShowEditRequest] = useState(false);

  return (
    <div className="space-y-6">
      {/* Truck details... */}
      
      <div className="flex gap-2">
        {canEdit("truck") ? (
          <Button asChild>
            <Link href={`/fleet/trucks/${params.id}/edit`}>
              Edit Truck
            </Link>
          </Button>
        ) : canRequestEdit() ? (
          <>
            <Button variant="outline" onClick={() => setShowEditRequest(true)}>
              Request Edit
            </Button>
            <EditRequestModal
              open={showEditRequest}
              onOpenChange={setShowEditRequest}
              entityType="truck"
              entityId={params.id}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
```

## UI Components

### Page Header Component

```tsx
// components/layout/page-header.tsx
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

### Data Table with Role-Based Actions

```tsx
// components/trucks/trucks-table.tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Eye, Edit, Trash2, ClipboardEdit } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import Link from "next/link";

interface Truck {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  status: string;
}

interface TrucksTableProps {
  trucks: Truck[];
}

export function TrucksTable({ trucks }: TrucksTableProps) {
  const { isAdmin, isSupervisor, isStaff, canEdit, canRequestEdit } = usePermissions();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      IN_SERVICE: "secondary",
      IN_REPAIR: "destructive",
      INACTIVE: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Registration</TableHead>
            <TableHead>Make</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trucks.map((truck) => (
            <TableRow key={truck.id}>
              <TableCell className="font-medium">{truck.registrationNo}</TableCell>
              <TableCell>{truck.make}</TableCell>
              <TableCell>{truck.model}</TableCell>
              <TableCell>{getStatusBadge(truck.status)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/fleet/trucks/${truck.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    
                    {/* Admin/Supervisor can edit directly */}
                    {canEdit("truck") && (
                      <DropdownMenuItem asChild>
                        <Link href={`/fleet/trucks/${truck.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                    )}
                    
                    {/* Staff can only request edit */}
                    {canRequestEdit() && (
                      <DropdownMenuItem>
                        <ClipboardEdit className="mr-2 h-4 w-4" />
                        Request Edit
                      </DropdownMenuItem>
                    )}
                    
                    {/* Only Admin/Supervisor can delete */}
                    {(isAdmin || isSupervisor) && (
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### Edit Request Modal

```tsx
// components/edit-requests/edit-request-modal.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface EditRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  currentData: Record<string, any>;
  FormComponent: React.ComponentType<{
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
  }>;
}

export function EditRequestModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  currentData,
  FormComponent,
}: EditRequestModalProps) {
  const [proposedData, setProposedData] = useState(currentData);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the edit request");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          proposedData,
          reason,
        }),
      });

      if (response.ok) {
        toast.success("Edit request submitted successfully");
        onOpenChange(false);
      } else {
        toast.error("Failed to submit edit request");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Edit</DialogTitle>
          <DialogDescription>
            Your edit will be reviewed by an administrator before being applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormComponent data={proposedData} onChange={setProposedData} />

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Edit *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this edit is needed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Dashboard Widgets

```tsx
// components/dashboard/stats-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Route, DollarSign, AlertTriangle } from "lucide-react";

interface StatsCardsProps {
  stats: {
    activeTrucks: number;
    tripsThisMonth: number;
    revenueThisMonth: number;
    pendingRequests: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Trucks</CardTitle>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeTrucks}</div>
          <p className="text-xs text-muted-foreground">Currently on the road</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trips This Month</CardTitle>
          <Route className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.tripsThisMonth}</div>
          <p className="text-xs text-muted-foreground">Completed trips</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats.revenueThisMonth.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">This month</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingRequests}</div>
          <p className="text-xs text-muted-foreground">Awaiting approval</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Mobile Responsiveness

```tsx
// components/layout/mobile-sidebar.tsx
"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileSidebar({ pendingEditRequests }: { pendingEditRequests: number }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <Sidebar pendingEditRequests={pendingEditRequests} />
      </SheetContent>
    </Sheet>
  );
}
```
