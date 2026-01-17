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
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[Role];

export function getPermissions(role: Role): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Check if supervisor can view expenses (controlled by SHOW_EXPENSES env variable)
 */
export function canViewExpensesPage(role: Role): boolean {
  if (role === "admin") return true;
  if (role === "supervisor") {
    return process.env.SHOW_EXPENSES === "true";
  }
  return false;
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
