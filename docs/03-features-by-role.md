# WD Logistics - Features by Role

## Admin Features (Mobile App)

### Dashboard
- Overview of today's operations
- Count of active deliveries
- Count of pending orders
- Quick stats (deliveries completed today, drivers on duty)

### User Management
- View list of all users (staff, drivers, accountants, customers)
- Create new user accounts
- Edit user details
- Deactivate/reactivate user accounts
- Reset user passwords

### Order Management
- View all orders (filterable by status, date, customer)
- Create new orders
- Edit order details
- Cancel orders
- Assign/reassign drivers to orders

### Fleet Management
- View all vehicles/trucks
- Add new vehicles
- Edit vehicle details
- Mark vehicles as active/inactive
- View vehicle assignments

### Driver Overview
- View all drivers
- See driver availability status
- View driver's current assignments
- Access driver contact information

### Financial Overview
- View total revenue summary
- View outstanding payments
- Quick access to recent invoices

---

## Driver Features (Mobile App)

### Dashboard
- Today's assigned deliveries
- Delivery count (completed vs pending)
- Next delivery details

### My Deliveries
- List of all assigned deliveries
- Filter by status (pending, in-progress, completed)
- View delivery details:
  - Pickup location and time
  - Delivery location
  - Cargo details
  - Customer contact info
  - Special instructions

### Delivery Actions
- Mark as "Picked Up"
- Mark as "In Transit"
- Mark as "Delivered"
- Report issue/delay
- Add delivery notes

### My Profile
- View personal information
- Update contact details
- View assigned vehicle

---

## Staff Features (Web App)

### Dashboard
- Overview of today's operations
- Pending orders count
- Active deliveries count
- Recent activity feed

### Order Management
- View all orders
- Create new orders
- Edit order details
- Search and filter orders
- View order history

### Scheduling
- View delivery schedule (calendar view)
- Assign drivers to orders
- Reschedule deliveries
- View driver availability

### Driver Management
- View list of all drivers
- See driver status (available, on delivery, off duty)
- View driver's current assignments
- Contact driver details

### Customer Management
- View customer list
- Add new customers
- Edit customer details
- View customer order history

### Freight/Cargo Management
- Add cargo details to orders
- View cargo specifications
- Update cargo status

---

## Accountant Features (Web App)

### Dashboard
- Financial summary overview
- Outstanding invoices count
- Payments received today
- Revenue this month

### Invoice Management
- View all invoices
- Create new invoices (linked to completed orders)
- Edit invoice details
- Mark invoices as sent
- View invoice status (draft, sent, paid, overdue)

### Payment Management
- Record payments received
- View payment history
- Match payments to invoices
- View outstanding balances by customer

### Customer Billing
- View customer billing information
- See customer payment history
- View outstanding balance per customer

### Financial Summary
- View revenue by period (daily, weekly, monthly)
- List of unpaid invoices
- List of recent payments

---

## Customer Features (Web App)

### Dashboard
- Active shipments overview
- Recent orders
- Outstanding invoices

### Place Order
- Create new shipping request
- Enter pickup details
- Enter delivery details
- Specify cargo information
- View estimated pricing

### My Orders
- View all orders
- Filter by status
- View order details
- Cancel pending orders
- Track active shipments

### Order Tracking
- View current status of shipment
- See pickup/delivery timestamps
- View driver information (name only)

### My Invoices
- View all invoices
- See invoice details
- View payment status
- Download/print invoice

### My Profile
- View account information
- Update contact details
- Update billing address

---

## Feature Priority Matrix (MVP)

| Feature | Priority | Admin | Staff | Driver | Accountant | Customer |
|---------|----------|-------|-------|--------|------------|----------|
| Login/Authentication | High | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | High | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Orders | High | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Orders | High | ✅ | ✅ | ❌ | ❌ | ✅ |
| Update Delivery Status | High | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign Drivers | High | ✅ | ✅ | ❌ | ❌ | ❌ |
| User Management | High | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Invoices | High | ✅ | ❌ | ❌ | ✅ | ❌ |
| Record Payments | High | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Invoices | Medium | ✅ | ❌ | ❌ | ✅ | ✅ |
| Vehicle Management | Medium | ✅ | ❌ | ❌ | ❌ | ❌ |
| Customer Management | Medium | ✅ | ✅ | ❌ | ❌ | ❌ |
| Profile Management | Low | ✅ | ✅ | ✅ | ✅ | ✅ |
