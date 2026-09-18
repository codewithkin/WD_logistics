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
  LucideIcon,
  Tags,
  Handshake,
  PackageOpen,
  Container,
  Wallet,
  CreditCard,
  MessageCircle,
  Wrench,
  Boxes,
} from "lucide-react";
import { Role } from "@/lib/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: "pending"; // Dynamic badge type
  children?: NavItem[];
  // For items that require SHOW_EXPENSES env var for non-admin users
  requiresShowExpenses?: boolean;
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
        // No "workshop": maintenance requests are their only relevant screen.
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
            title: "Trailers",
            href: "/fleet/trailers",
            icon: Container,
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
            roles: ["admin"], // Only admin can see; supervisor access controlled by SHOW_EXPENSES
            requiresShowExpenses: true,
          },
        ],
      },
      {
        title: "Maintenance",
        href: "/maintenance",
        icon: Wrench,
        roles: ["admin", "supervisor", "workshop"],
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: Boxes,
        roles: ["admin", "supervisor"],
      },
    ],
  },
  {
    label: "Business",
    items: [
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
            title: "Customer Payments",
            href: "/finance/payments",
            icon: DollarSign,
            roles: ["admin", "supervisor", "staff"],
          },
          {
            title: "Supplier Payments",
            href: "/finance/supplier-payments",
            icon: CreditCard,
            roles: ["admin", "supervisor", "staff"],
          },
          {
            title: "Expenses",
            href: "/finance/expenses",
            icon: Receipt,
            roles: ["admin", "supervisor"],
          },
          {
            title: "Expense Categories",
            href: "/finance/expense-categories",
            icon: Tags,
            roles: ["admin", "supervisor"],
          },
          {
            title: "Accounts",
            href: "/finance/accounts",
            icon: Wallet,
            roles: ["admin", "supervisor"],
          },
        ],
      },
    ],
  },
  {
    label: "Relations",
    items: [
      {
        title: "Customers",
        href: "/customers",
        icon: Building2,
        roles: ["admin", "supervisor", "staff"],
      },
      {
        title: "Suppliers",
        href: "/suppliers",
        icon: PackageOpen,
        roles: ["admin", "supervisor", "staff"],
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
        title: "WhatsApp",
        href: "/settings/whatsapp",
        icon: MessageCircle,
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
