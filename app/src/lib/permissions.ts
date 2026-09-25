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

    // Data Management. Creating stays direct; changing and removing an
    // existing record goes to an admin as a request — see lib/edit-requests.
    canCreate: true,
    canEdit: false,
    canDelete: false,

    // Edit Requests: supervisors raise them and watch their own, but an
    // approval by the person who would otherwise have edited directly is not
    // an approval at all.
    canApproveEditRequests: false,
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

/**
 * Who may see what things *cost* — expenses, maintenance spend, cost per km.
 *
 * Distinct from `canViewFinancialData`, which governs what the business
 * *earns*: revenue, profit and margin. A supervisor records spending, so they
 * need cost figures to do the job; what the company makes is the owner's
 * business. That one sentence is the whole access model for money — see
 * ACCESS_CONTROL.md.
 *
 * Before this existed, detail pages gated costs behind the admin-only
 * financial check, so supervisors saw no figures at all and had to guess
 * whether a truck was expensive.
 */
export function canViewCostData(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Who may write to an existing record without asking.
 *
 * Only the admin. Everyone else's edit becomes an EditRequest carrying a real
 * before/after diff, which the admin accepts or refuses. This predicate is
 * the one place that decides it — see lib/edit-requests/gate.ts for the gate
 * every update action calls.
 */
export function canEditDirectly(role: Role): boolean {
  return role === "admin";
}

/**
 * The one exception to "every change by a non-admin becomes a request".
 *
 * Moving a trip along — scheduled, in progress, completed — is the thing
 * operations does all day, from a yard, often on a phone. Sending each of
 * those through an admin would either stop the work or train everyone to
 * approve without reading, which is worse than not asking.
 *
 * It applies to the status and nothing else. Any other field on the trip,
 * changed on its own or alongside the status, is a request like everything
 * else. Workshop and readonly are not here because they have no business
 * with trips at all.
 */
export function canChangeTripStatusDirectly(role: Role): boolean {
  return role === "admin" || role === "supervisor" || role === "staff";
}

/**
 * Expense categories are the chart of accounts for the whole business — every
 * expense, every per-truck cost breakdown and every report groups by them — so
 * creating, renaming and deleting them is admin-only. Everyone else reads.
 */
export function canManageExpenseCategories(role: Role): boolean {
  return role === "admin";
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

// Money OUT of an account: spending. Every entry is logged against the
// person who recorded it, which is what makes it safe to open to supervisors
// — they are the ones doing the spending.
export function canRecordMoneyOut(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

// Money IN, and the opening balance: admin only. Per ACCESS_CONTROL.md,
// "a supervisor can see what is in each account and take money out of it,
// because they spend. Only an admin puts money in." The server enforces
// this in finance/accounts/actions.ts; these exist so the UI stops offering
// a supervisor a button that is going to refuse them.
export function canRecordMoneyIn(role: Role): boolean {
  return role === "admin";
}

/** Either direction — for deciding whether the section appears at all. */
export function canRecordAccountMovements(role: Role): boolean {
  return canRecordMoneyIn(role) || canRecordMoneyOut(role);
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
