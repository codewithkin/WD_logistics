import {
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  Route,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  UserCog,
  ClipboardEdit,
  DollarSign,
  Bot,
  LucideIcon,
} from "lucide-react";
import { Role } from "@/lib/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: "pending"; // Dynamic badge type
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigationSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "supervisor", "staff"],
      },
    ],
  },
  {
    label: "Fleet Management",
    items: [
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
    ],
  },
  {
    label: "Business",
    items: [
      {
        title: "Customers",
        href: "/customers",
        icon: Building2,
        roles: ["admin", "supervisor", "staff"],
      },
      {
        title: "Finance",
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
    ],
  },
  {
    label: "Team",
    items: [
      {
        title: "Employees",
        href: "/employees",
        icon: UserCog,
        roles: ["admin", "supervisor", "staff"],
      },
      {
        title: "Edit Requests",
        href: "/edit-requests",
        icon: ClipboardEdit,
        roles: ["admin", "supervisor", "staff"],
        badge: "pending",
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        title: "AI Assistant",
        href: "/ai",
        icon: Bot,
        roles: ["admin"],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users",
        href: "/users",
        icon: Users,
        roles: ["admin"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["admin"],
      },
    ],
  },
];

// Flat list for backward compatibility
export const navigationConfig: NavItem[] = navigationSections.flatMap(
  (section) => section.items
);
