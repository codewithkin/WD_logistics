import { Role } from "@/lib/types";

// Permission definitions for each role
export const ROLE_PERMISSIONS = {
  admin: {
    // User Management
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    
    // Data Management
    canCreate: true,
    canEdit: true,
    canDelete: true,
    
    // Edit Requests
    canApproveEditRequests: true,
    canViewAllEditRequests: true,
    
    // Reports
    canViewReports: true,
    canGenerateReports: true,
    
    // Settings
    canAccessSettings: true,
    
    // Financial Data
    canViewFinancials: true,
    canViewRevenue: true,
    canViewExpenses: true,
    canViewPerformanceMetrics: true,
  },
  supervisor: {
    // User Management
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    
    // Data Management
    canCreate: true,
    canEdit: true,
    canDelete: false,
    
    // Edit Requests
    canApproveEditRequests: true,
    canViewAllEditRequests: true,
    
    // Reports
    canViewReports: true,
    canGenerateReports: false,
    
    // Settings
    canAccessSettings: false,
    
    // Financial Data - Supervisors have restricted access
    canViewFinancials: false,
    canViewRevenue: false,
    canViewExpenses: false, // Can be overridden by SHOW_EXPENSES env
    canViewPerformanceMetrics: false,
  },
  staff: {
    // User Management
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    
    // Data Management
    canCreate: true,
    canEdit: false, // Staff edits require approval
    canDelete: false,
    
    // Edit Requests
    canApproveEditRequests: false,
    canViewAllEditRequests: false, // Can only view own requests
    
    // Reports
    canViewReports: false,
    canGenerateReports: false,
    
    // Settings
    canAccessSettings: false,
    
    // Financial Data - Staff have no access
    canViewFinancials: false,
    canViewRevenue: false,
    canViewExpenses: false,
    canViewPerformanceMetrics: false,
  },
  // Workshop: narrowest role. General app access is fail-closed by design —
  // their only granted surface is the dedicated maintenance-requests feature,
  // gated separately via its own requireRole() calls, not this map.
  workshop: {
    // User Management
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,

    // Data Management
    canCreate: false,
    canEdit: false,
    canDelete: false,

    // Edit Requests
    canApproveEditRequests: false,
    canViewAllEditRequests: false,

    // Reports
    canViewReports: false,
    canGenerateReports: false,

    // Settings
    canAccessSettings: false,

    // Financial Data
    canViewFinancials: false,
    canViewRevenue: false,
    canViewExpenses: false,
    canViewPerformanceMetrics: false,
  },
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[Role];

export function getPermissions(role: Role): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Check if user can view expenses page
 * Supervisors have full access to expenses for data input
 */
export function canViewExpensesPage(role: Role): boolean {
  if (role === "admin") return true;
  if (role === "supervisor") return true; // Supervisors can view and add expenses
  return false;
}

/**
 * Check if user can create/add expenses
 */
export function canCreateExpenses(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Check if user can generate expense reports
 * Only admins can generate reports
 */
export function canGenerateExpenseReports(role: Role): boolean {
  return role === "admin";
}

/**
 * Check if user can view financial data (revenue, expenses, performance metrics)
 */
export function canViewFinancialData(role: Role): boolean {
  return role === "admin";
}

// Check if user can edit directly or needs to submit edit request
export function canEditDirectly(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

// Check if user can delete directly
export function canDeleteDirectly(role: Role): boolean {
  return role === "admin";
}

/**
 * Check if user can view the three account balances (Cash/Bank/Petty Cash)
 * on the expenses page. An explicit carve-out from canViewFinancialData:
 * supervisors need this to record expenses sensibly even though they can't
 * see revenue or the rest of the financial reports.
 */
export function canViewAccountBalances(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

// Only admins can transfer funds between accounts (e.g. petty cash <-> cash)
export function canTransferFunds(role: Role): boolean {
  return role === "admin";
}

// Recording money handed in or taken out. Every entry is logged against the
// person who recorded it, which is what makes it safe to open to supervisors.
export function canRecordAccountMovements(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Inventory/warehouse: admin and supervisor can both see stock (quantities,
 * items, categories), but only admin sees the dollar value breakdown
 * (unit cost × quantity, per-category totals) — an explicit split matching
 * the same admin-only financial visibility pattern used elsewhere.
 */
export function canViewInventory(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

export function canViewInventoryValue(role: Role): boolean {
  return role === "admin";
}

export function canManageInventory(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}
