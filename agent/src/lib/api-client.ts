/**
 * API Client for making authenticated requests to the web app
 */

const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "";

interface ApiRequestOptions {
  organizationId: string;
  action: string;
  params?: Record<string, unknown>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function makeRequest<T>(endpoint: string, options: ApiRequestOptions): Promise<T> {
  const { organizationId, action, params = {} } = options;

  const response = await fetch(`${WEB_APP_URL}/api/agent/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": AGENT_API_KEY,
      "x-organization-id": organizationId,
    },
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as ApiResponse<T>;
  
  if (!result.success) {
    throw new Error(result.error || "Unknown error");
  }

  return result.data as T;
}

// ==================== TRUCKS ====================

export interface TruckListItem {
  id: string;
  registrationNo: string;
  model: string;
  status: string;
  capacity: number;
  driverName: string | null;
}

export interface TruckDetails {
  id: string;
  registrationNo: string;
  model: string;
  make: string | null;
  year: number | null;
  capacity: number;
  status: string;
  driver: { id: string; name: string } | null;
  recentTrips: Array<{
    id: string;
    route: string;
    status: string;
    revenue: number;
    date: string;
  }>;
  recentExpenses: Array<{
    id: string;
    amount: number;
    category: string;
    date: string;
  }>;
}

export interface TruckPerformance {
  truckId: string;
  registrationNo: string;
  totalTrips: number;
  completedTrips: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  averageRevenuePerTrip: number;
}

export interface TruckSummary {
  total: number;
  byStatus: Record<string, number>;
}

export const trucksApi = {
  list: (organizationId: string, params?: { status?: string }) =>
    makeRequest<{ trucks: TruckListItem[]; total: number }>("trucks", {
      organizationId,
      action: "list",
      params,
    }),

  details: (organizationId: string, truckId: string) =>
    makeRequest<TruckDetails>("trucks", {
      organizationId,
      action: "details",
      params: { truckId },
    }),

  performance: (organizationId: string, truckId: string, startDate?: string, endDate?: string) =>
    makeRequest<TruckPerformance>("trucks", {
      organizationId,
      action: "performance",
      params: { truckId, startDate, endDate },
    }),

  summary: (organizationId: string) =>
    makeRequest<TruckSummary>("trucks", {
      organizationId,
      action: "summary",
    }),
};

// ==================== DRIVERS ====================

export interface DriverListItem {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  licenseNumber: string;
  assignedTruck: string | null;
}

export interface DriverDetails {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: string;
  licenseNumber: string;
  whatsappNumber: string | null;
  passportNumber: string | null;
  startDate: string;
  assignedTruck: { id: string; registrationNo: string } | null;
  tripStats: {
    total: number;
    completed: number;
    inProgress: number;
  };
  recentTrips: Array<{
    id: string;
    route: string;
    status: string;
    date: string;
  }>;
}

export interface DriverAvailability {
  date: string;
  available: Array<{ id: string; name: string }>;
  busy: Array<{ id: string; name: string; reason: string }>;
  onLeave: Array<{ id: string; name: string }>;
}

export interface ExpiringContract {
  id: string;
  name: string;
  endDate: string;
  daysUntilExpiry: number;
}

export interface DriverSummary {
  total: number;
  byStatus: Record<string, number>;
}

export const driversApi = {
  list: (organizationId: string, params?: { status?: string }) =>
    makeRequest<{ drivers: DriverListItem[]; total: number }>("drivers", {
      organizationId,
      action: "list",
      params,
    }),

  details: (organizationId: string, driverId: string) =>
    makeRequest<DriverDetails>("drivers", {
      organizationId,
      action: "details",
      params: { driverId },
    }),

  availability: (organizationId: string, date?: string) =>
    makeRequest<DriverAvailability>("drivers", {
      organizationId,
      action: "availability",
      params: { date },
    }),

  expiringLicenses: (organizationId: string, daysAhead?: number) =>
    makeRequest<{ expiringContracts: ExpiringContract[] }>("drivers", {
      organizationId,
      action: "expiring-licenses",
      params: { daysAhead },
    }),

  summary: (organizationId: string) =>
    makeRequest<DriverSummary>("drivers", {
      organizationId,
      action: "summary",
    }),
};

// ==================== TRIPS ====================

export interface TripListItem {
  id: string;
  originCity: string;
  destinationCity: string;
  status: string;
  scheduledDate: string;
  revenue: number;
  truck: { id: string; registrationNo: string };
  driver: { id: string; name: string };
  customer: { id: string; name: string };
}

export interface TripDetails {
  id: string;
  originCity: string;
  originAddress: string | null;
  destinationCity: string;
  destinationAddress: string | null;
  status: string;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  distance: number | null;
  revenue: number;
  notes: string | null;
  truck: { id: string; registrationNo: string };
  driver: { id: string; name: string };
  customer: { id: string; name: string };
  expenses: Array<{
    id: string;
    amount: number;
    category: string;
    date: string;
  }>;
  totalExpenses: number;
  profit: number;
}

export interface TripStats {
  total: number;
  byStatus: Record<string, number>;
  totalRevenue: number;
  totalDistance: number;
}

export const tripsApi = {
  list: (organizationId: string, params?: { status?: string; startDate?: string; endDate?: string; driverId?: string; truckId?: string; customerId?: string }) =>
    makeRequest<{ trips: TripListItem[]; total: number }>("trips", {
      organizationId,
      action: "list",
      params,
    }),

  details: (organizationId: string, tripId: string) =>
    makeRequest<TripDetails>("trips", {
      organizationId,
      action: "details",
      params: { tripId },
    }),

  stats: (organizationId: string, startDate?: string, endDate?: string) =>
    makeRequest<TripStats>("trips", {
      organizationId,
      action: "stats",
      params: { startDate, endDate },
    }),

  today: (organizationId: string) =>
    makeRequest<{ trips: TripListItem[] }>("trips", {
      organizationId,
      action: "today",
    }),

  upcoming: (organizationId: string, daysAhead?: number) =>
    makeRequest<{ trips: TripListItem[] }>("trips", {
      organizationId,
      action: "upcoming",
      params: { daysAhead },
    }),
};

// ==================== INVOICES ====================

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  balance: number;
  status: string;
  issueDate: string;
  dueDate: string;
}

export interface InvoiceDetails {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; email: string | null };
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    date: string;
  }>;
}

export interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  balance: number;
  dueDate: string;
  daysOverdue: number;
}

export interface CustomerBalance {
  customer: { id: string; name: string };
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdueAmount: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    balance: number;
    status: string;
    dueDate: string;
    isOverdue: boolean;
  }>;
}

export interface InvoiceSummary {
  total: number;
  byStatus: Record<string, number>;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
}

export const invoicesApi = {
  list: (organizationId: string, params?: { status?: string; customerId?: string; startDate?: string; endDate?: string }) =>
    makeRequest<{ invoices: InvoiceListItem[]; total: number }>("invoices", {
      organizationId,
      action: "list",
      params,
    }),

  details: (organizationId: string, invoiceId: string) =>
    makeRequest<InvoiceDetails>("invoices", {
      organizationId,
      action: "details",
      params: { invoiceId },
    }),

  overdue: (organizationId: string) =>
    makeRequest<{ invoices: OverdueInvoice[] }>("invoices", {
      organizationId,
      action: "overdue",
    }),

  customerBalance: (organizationId: string, customerId: string) =>
    makeRequest<CustomerBalance>("invoices", {
      organizationId,
      action: "customer-balance",
      params: { customerId },
    }),

  summary: (organizationId: string) =>
    makeRequest<InvoiceSummary>("invoices", {
      organizationId,
      action: "summary",
    }),
};

// ==================== DASHBOARD ====================

export interface DashboardSummary {
  fleet: { total: number; active: number; inRepair: number };
  drivers: { total: number; active: number; onLeave: number };
  trips: { total: number; completed: number; inProgress: number; scheduled: number; totalRevenue: number };
  invoices: { totalAmount: number; totalPaid: number; totalOutstanding: number; overdueCount: number };
  expenses: { thisMonth: number };
  period: { start: string; end: string };
}

export interface DashboardAlerts {
  alerts: {
    overdueInvoices: Array<{ id: string; invoiceNumber: string; customerName: string; balance: number; daysOverdue: number }>;
    expiringLicenses: Array<{ id: string; name: string; licenseExpiry: string; daysUntilExpiry: number | null }>;
    trucksInRepair: Array<{ id: string; registrationNo: string }>;
    todaysTripsCount: number;
  };
  summary: {
    overdueInvoicesCount: number;
    expiringLicensesCount: number;
    trucksInRepairCount: number;
    todaysTripsCount: number;
  };
}

export interface RecentActivity {
  recentTrips: Array<{
    id: string;
    type: "trip";
    description: string;
    truck: string;
    driver: string;
    status: string;
    date: string;
  }>;
  recentPayments: Array<{
    id: string;
    type: "payment";
    invoiceNumber: string;
    customerName: string;
    amount: number;
    method: string;
    date: string;
  }>;
  recentExpenses: Array<{
    id: string;
    type: "expense";
    category: string;
    amount: number;
    description: string | null;
    date: string;
  }>;
}

export const dashboardApi = {
  summary: (organizationId: string) =>
    makeRequest<DashboardSummary>("dashboard", {
      organizationId,
      action: "summary",
    }),

  alerts: (organizationId: string) =>
    makeRequest<DashboardAlerts>("dashboard", {
      organizationId,
      action: "alerts",
    }),

  recentActivity: (organizationId: string, limit?: number) =>
    makeRequest<RecentActivity>("dashboard", {
      organizationId,
      action: "recent-activity",
      params: { limit },
    }),
};

// ==================== CUSTOMERS ====================

export interface CustomerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  tripCount: number;
  invoiceCount: number;
  createdAt: string;
}

export interface CustomerDetails {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    createdAt: string;
  };
  stats: {
    totalTrips: number;
    totalInvoiced: number;
    outstandingBalance: number;
  };
  recentTrips: Array<{
    id: string;
    route: string;
    status: string;
    revenue: number;
    date: string;
  }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    balance: number;
    status: string;
    dueDate: string;
  }>;
}

export interface CustomerSummary {
  summary: { total: number; active: number; inactive: number };
  topCustomers: Array<{
    id: string;
    name: string;
    tripCount: number;
    totalRevenue: number;
  }>;
}

export const customersApi = {
  list: (organizationId: string, params?: { status?: string; search?: string }) =>
    makeRequest<{ customers: CustomerListItem[]; total: number }>("customers", {
      organizationId,
      action: "list",
      params,
    }),

  details: (organizationId: string, customerId: string) =>
    makeRequest<CustomerDetails>("customers", {
      organizationId,
      action: "details",
      params: { customerId },
    }),

  balance: (organizationId: string, customerId: string) =>
    makeRequest<CustomerBalance>("customers", {
      organizationId,
      action: "balance",
      params: { customerId },
    }),

  summary: (organizationId: string) =>
    makeRequest<CustomerSummary>("customers", {
      organizationId,
      action: "summary",
    }),
};

// Export all APIs
export const api = {
  trucks: trucksApi,
  drivers: driversApi,
  trips: tripsApi,
  invoices: invoicesApi,
  dashboard: dashboardApi,
  customers: customersApi,
};

export default api;
