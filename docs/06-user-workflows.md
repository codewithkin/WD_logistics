# WD Logistics - User Workflows

## Admin Workflows

### 1. Daily Operations Check
1. Open Admin App
2. View Dashboard
3. Check pending orders count
4. Check active deliveries
5. Review any issues/alerts
6. Take action if needed

### 2. Create New Staff/Driver Account
1. Navigate to Users section
2. Tap "Add User"
3. Select role (Staff/Driver/Accountant)
4. Fill in personal details
5. Set initial password
6. If Driver: Assign vehicle
7. Save user
8. User receives login credentials

### 3. Register New Vehicle
1. Navigate to Fleet section
2. Tap "Add Vehicle"
3. Enter vehicle details (registration, make, model)
4. Set capacity information
5. Set status as Active
6. Optionally assign to driver
7. Save vehicle

### 4. Handle Escalated Order Issue
1. Receive notification of issue
2. Navigate to Order Detail
3. Review order status and history
4. Contact driver or customer if needed
5. Reassign driver if necessary
6. Update order notes
7. Monitor resolution

### 5. Review Financial Summary
1. Navigate to Financial Overview
2. Check revenue for the period
3. Review outstanding payments
4. Identify any overdue invoices
5. Take action on major issues

---

## Driver Workflows

### 1. Start of Day
1. Open Driver App
2. View Dashboard
3. See today's assigned deliveries
4. Review first delivery details
5. Confirm availability status

### 2. Complete a Delivery
1. Navigate to Delivery List
2. Select assigned delivery
3. Review pickup location and cargo details
4. Go to pickup location
5. Tap "Mark as Picked Up"
6. Add any pickup notes
7. Proceed to delivery location
8. Tap "Mark as Delivered"
9. Add delivery confirmation notes
10. Delivery complete, move to next

### 3. Report Delivery Issue
1. While on Delivery Detail page
2. Tap "Report Issue"
3. Select issue type (delay, damage, customer unavailable, etc.)
4. Add description of issue
5. Submit report
6. Staff/Admin receives notification
7. Wait for instructions or resolution

### 4. Update Availability
1. Navigate to Profile
2. Update availability status
3. Options: Available, On Break, Off Duty
4. Save changes
5. Staff can see updated availability

---

## Staff Workflows

### 1. Process New Order (from customer request)
1. Navigate to Orders
2. Click "Create Order"
3. Select or create customer
4. Enter pickup details (address, date, time)
5. Enter delivery details
6. Add cargo information
7. Calculate/enter pricing
8. Save order (status: Pending)
9. Assign driver (status: Confirmed)

### 2. Assign Driver to Order
1. Navigate to Order Detail
2. Click "Assign Driver"
3. View available drivers
4. Select appropriate driver based on:
   - Availability
   - Current location
   - Vehicle capacity
5. Confirm assignment
6. Driver receives notification

### 3. Handle Customer Inquiry
1. Receive customer question about order
2. Navigate to Orders
3. Search for customer's order
4. View order details and status
5. Check delivery history
6. Provide update to customer
7. Add internal notes if needed

### 4. Schedule Deliveries
1. Navigate to Schedule
2. View calendar of deliveries
3. Identify unassigned orders
4. Check driver availability
5. Assign drivers to orders
6. Adjust schedule as needed
7. Confirm all orders have drivers

### 5. Register New Customer
1. Navigate to Customers
2. Click "Add Customer"
3. Enter customer details
4. Add billing address
5. Add default shipping address
6. Save customer
7. Customer can now place orders

---

## Accountant Workflows

### 1. Create Invoice for Completed Order
1. Navigate to Orders (read-only view)
2. Find completed orders without invoices
3. Select order
4. Click "Create Invoice"
5. Review order amount
6. Set invoice date and due date
7. Add any notes
8. Save as Draft or Send immediately
9. Customer receives invoice

### 2. Record Customer Payment
1. Navigate to Payments
2. Click "Record Payment"
3. Select customer
4. Select invoice(s) being paid
5. Enter payment amount
6. Enter payment date
7. Select payment method
8. Add reference number
9. Save payment
10. Invoice status updates to Paid

### 3. Follow Up on Overdue Invoice
1. Navigate to Invoices
2. Filter by "Overdue" status
3. Review overdue invoices
4. Note customer and amount
5. Contact customer (outside system)
6. Add follow-up notes to invoice
7. Update status if resolved

### 4. Review Financial Summary
1. Navigate to Dashboard
2. View revenue this month
3. Check outstanding invoices total
4. Review recent payments
5. Identify any issues
6. Export data if needed for reporting

---

## Customer Workflows

### 1. Create Account (New Customer)
1. Navigate to Customer Portal
2. Click "Register"
3. Enter personal/company details
4. Enter email and create password
5. Add billing address
6. Add shipping address
7. Submit registration
8. Account created, can now login

### 2. Place New Shipping Order
1. Login to Customer Portal
2. Click "New Order" or "Ship Now"
3. Enter pickup details:
   - Pickup address (or select saved)
   - Pickup date and time
4. Enter delivery details:
   - Delivery address
   - Preferred delivery date
5. Enter cargo details:
   - Description
   - Weight
   - Dimensions (optional)
   - Quantity
   - Special handling notes
6. Review order summary
7. Confirm order
8. Order submitted (status: Pending)
9. Receive confirmation

### 3. Track Active Shipment
1. Login to Customer Portal
2. Navigate to "My Orders"
3. Find active order
4. Click to view details
5. See current status (e.g., "In Transit")
6. View status history/timeline
7. See expected delivery date
8. Contact support if needed

### 4. View and Pay Invoice
1. Login to Customer Portal
2. Navigate to "My Invoices"
3. Find unpaid invoice
4. Click to view details
5. Review charges
6. Note payment instructions
7. Make payment (outside system for MVP)
8. Payment reflected after accountant records it

### 5. Cancel Pending Order
1. Login to Customer Portal
2. Navigate to "My Orders"
3. Find pending order
4. Click "Cancel Order"
5. Confirm cancellation
6. Order status changes to Cancelled
7. Receive confirmation

---

## Cross-Role Workflow: Order Lifecycle

```
Customer places order
        │
        ▼
   Order Created
   (Status: Pending)
        │
        ▼
Staff reviews and assigns driver
        │
        ▼
   Order Confirmed
   (Status: Confirmed)
        │
        ▼
Driver receives assignment
        │
        ▼
Driver picks up cargo
   (Status: Picked Up)
        │
        ▼
Driver in transit
   (Status: In Transit)
        │
        ▼
Driver delivers cargo
   (Status: Delivered)
        │
        ▼
Accountant creates invoice
        │
        ▼
Customer pays invoice
        │
        ▼
Accountant records payment
        │
        ▼
   Order Complete
   (Invoice: Paid)
```
