// Role types
export type Role = "admin" | "supervisor" | "staff";

// Status types
export type TruckStatus = "active" | "in_service" | "in_repair" | "inactive" | "decommissioned";
export type DriverStatus = "active" | "on_leave" | "suspended" | "terminated";
export type EmployeeStatus = "active" | "on_leave" | "suspended" | "terminated";
export type CustomerStatus = "active" | "inactive" | "suspended";
export type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";
export type PaymentMethod = "cash" | "bank_transfer" | "check" | "mobile_money" | "other";
export type EditRequestStatus = "pending" | "approved" | "rejected";
export type NotificationType = "trip_assignment" | "invoice_reminder" | "payment_received" | "general";
export type NotificationStatus = "pending" | "sent" | "failed";
export type ReportType = "profit_per_unit" | "revenue" | "expenses" | "overall" | "tires" | "customer_statement" | "trip_summary" | "truck_performance";
export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type ReportFormat = "pdf" | "csv";

// Label mappings
export const TRUCK_STATUS_LABELS: Record<TruckStatus, string> = {
  active: "Active",
  in_service: "In Service",
  in_repair: "In Repair",
  inactive: "Inactive",
  decommissioned: "Decommissioned",
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  active: "Active",
  on_leave: "On Leave",
  suspended: "Suspended",
  terminated: "Terminated",
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Active",
  on_leave: "On Leave",
  suspended: "Suspended",
  terminated: "Terminated",
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  check: "Check",
  mobile_money: "Mobile Money",
  other: "Other",
};

export const EDIT_REQUEST_STATUS_LABELS: Record<EditRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  staff: "Staff",
};

// Status color mappings for badges
export const TRUCK_STATUS_COLORS: Record<TruckStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  in_service: "secondary",
  in_repair: "destructive",
  inactive: "outline",
  decommissioned: "destructive",
};

export const DRIVER_STATUS_COLORS: Record<DriverStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "secondary",
  suspended: "destructive",
  terminated: "destructive",
};

export const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  on_leave: "secondary",
  suspended: "destructive",
  terminated: "destructive",
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "outline",
  suspended: "destructive",
};

export const TRIP_STATUS_COLORS: Record<TripStatus, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  partial: "secondary",
  overdue: "destructive",
  cancelled: "destructive",
};

export const EDIT_REQUEST_STATUS_COLORS: Record<EditRequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};
