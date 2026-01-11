import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Truck,
  Users,
  DollarSign,
  Package,
  Route,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  total: number;
  dueDate: Date;
  customer: { name: string };
  payments: { amount: number }[];
}

interface CustomerRevenue {
  id: string;
  name: string;
  invoices: { total: number }[];
  revenue: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
}

interface ReportsDashboardProps {
  data: {
    totalTrucks: number;
    activeTrucks: number;
    totalDrivers: number;
    activeDrivers: number;
    thisMonthTrips: number;
    lastMonthTrips: number;
    completedTrips: number;
    inProgressTrips: number;
    thisMonthInvoiceTotal: number;
    lastMonthInvoiceTotal: number;
    thisMonthPaymentTotal: number;
    lastMonthPaymentTotal: number;
    thisMonthExpenseTotal: number;
    lastMonthExpenseTotal: number;
    outstandingInvoices: OutstandingInvoice[];
    topCustomersByRevenue: CustomerRevenue[];
    expensesWithCategories: ExpenseCategory[];
  };
}

export function ReportsDashboard({ data }: ReportsDashboardProps) {
  const {
    totalTrucks,
    activeTrucks,
    totalDrivers,
    activeDrivers,
    thisMonthTrips,
    lastMonthTrips,
    completedTrips,
    inProgressTrips,
    thisMonthInvoiceTotal,
    lastMonthInvoiceTotal,
    thisMonthPaymentTotal,
    lastMonthPaymentTotal,
    thisMonthExpenseTotal,
    lastMonthExpenseTotal,
    outstandingInvoices,
    topCustomersByRevenue,
    expensesWithCategories,
  } = data;

  const now = new Date();

  // Helper for change percentage
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const invoiceChange = calcChange(thisMonthInvoiceTotal, lastMonthInvoiceTotal);
  const paymentChange = calcChange(thisMonthPaymentTotal, lastMonthPaymentTotal);
  const expenseChange = calcChange(thisMonthExpenseTotal, lastMonthExpenseTotal);
  const tripChange = calcChange(thisMonthTrips, lastMonthTrips);

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="financial">Financial</TabsTrigger>
        <TabsTrigger value="fleet">Fleet</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${thisMonthInvoiceTotal.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {invoiceChange >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={invoiceChange >= 0 ? "text-green-500" : "text-red-500"}>
                  {invoiceChange >= 0 ? "+" : ""}
                  {invoiceChange}%
                </span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collections</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${thisMonthPaymentTotal.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {paymentChange >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={paymentChange >= 0 ? "text-green-500" : "text-red-500"}>
                  {paymentChange >= 0 ? "+" : ""}
                  {paymentChange}%
                </span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${thisMonthExpenseTotal.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {expenseChange <= 0 ? (
                  <TrendingDown className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingUp className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={expenseChange <= 0 ? "text-green-500" : "text-red-500"}>
                  {expenseChange >= 0 ? "+" : ""}
                  {expenseChange}%
                </span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trips</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{thisMonthTrips}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {tripChange >= 0 ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                )}
                <span className={tripChange >= 0 ? "text-green-500" : "text-red-500"}>
                  {tripChange >= 0 ? "+" : ""}
                  {tripChange}%
                </span>
                <span className="ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomersByRevenue.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No revenue this month
                </p>
              ) : (
                <div className="space-y-4">
                  {topCustomersByRevenue.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.invoices.length} invoice(s)
                        </p>
                      </div>
                      <p className="font-bold">${customer.revenue.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {expensesWithCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No expenses this month
                </p>
              ) : (
                <div className="space-y-4">
                  {expensesWithCategories.map((expense, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <p className="font-medium">{expense.category}</p>
                      <p className="font-bold">${expense.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="financial" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${thisMonthPaymentTotal - thisMonthExpenseTotal >= 0
                  ? "text-green-600"
                  : "text-red-600"
                  }`}
              >
                ${(thisMonthPaymentTotal - thisMonthExpenseTotal).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                $
                {outstandingInvoices
                  .reduce((sum, inv) => {
                    const paid = inv.payments.reduce((p, pay) => p + pay.amount, 0);
                    return sum + (inv.total - paid);
                  }, 0)
                  .toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {outstandingInvoices.length} invoice(s) pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {thisMonthInvoiceTotal > 0
                  ? Math.round((thisMonthPaymentTotal / thisMonthInvoiceTotal) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                of invoiced collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${thisMonthExpenseTotal.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {outstandingInvoices.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No outstanding invoices
              </p>
            ) : (
              <div className="space-y-3">
                {outstandingInvoices.map((invoice) => {
                  const paid = invoice.payments.reduce((p, pay) => p + pay.amount, 0);
                  const balance = invoice.total - paid;
                  const isOverdue = invoice.dueDate < now;

                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.customer.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${balance.toLocaleString()}</p>
                        <p
                          className={`text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"
                            }`}
                        >
                          {isOverdue ? "Overdue: " : "Due: "}
                          {format(invoice.dueDate, "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="fleet" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTrucks}</div>
              <p className="text-xs text-muted-foreground">
                {activeTrucks} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDrivers}</div>
              <p className="text-xs text-muted-foreground">
                {activeDrivers} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Trips</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTrips}</div>
              <p className="text-xs text-muted-foreground">all time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressTrips}</div>
              <p className="text-xs text-muted-foreground">in progress</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Truck Utilization</span>
                    <span>
                      {totalTrucks > 0
                        ? Math.round(((totalTrucks - activeTrucks) / totalTrucks) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${totalTrucks > 0
                          ? ((totalTrucks - activeTrucks) / totalTrucks) * 100
                          : 0
                          }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalTrucks - activeTrucks} trucks in use
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Driver Utilization</span>
                    <span>
                      {totalDrivers > 0
                        ? Math.round(
                          ((totalDrivers - activeDrivers) / totalDrivers) * 100
                        )
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${totalDrivers > 0
                          ? ((totalDrivers - activeDrivers) / totalDrivers) * 100
                          : 0
                          }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalDrivers - activeDrivers} drivers on trip
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trip Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-bold">{thisMonthTrips} trips</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Last Month</span>
                  <span className="font-bold">{lastMonthTrips} trips</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Change</span>
                  <span
                    className={`font-bold ${tripChange >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                  >
                    {tripChange >= 0 ? "+" : ""}
                    {tripChange}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
