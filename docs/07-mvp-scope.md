# WD Logistics - MVP Scope & Priorities

## MVP Definition

The MVP (Minimum Viable Product) is a bare-bones prototype to showcase the core functionality of the WD Logistics system. It should demonstrate the key workflows and role-based access without advanced features.

---

## What's IN the MVP

### Authentication & Authorization
- [x] Login for all roles
- [x] Role-based access control
- [x] Password reset (basic)
- [x] Session management

### Admin App (Mobile)
- [x] Dashboard with overview stats
- [x] User management (CRUD for all roles)
- [x] Order list and details view
- [x] Create/edit orders
- [x] Assign drivers to orders
- [x] Vehicle/fleet list and management
- [x] Basic financial overview

### Driver App (Mobile)
- [x] Dashboard with today's deliveries
- [x] View assigned deliveries
- [x] Update delivery status (Picked Up, In Transit, Delivered)
- [x] View cargo and route details
- [x] Basic profile view

### Staff Dashboard (Web)
- [x] Dashboard with operations overview
- [x] Order management (create, view, edit)
- [x] Assign drivers to orders
- [x] View driver list and availability
- [x] Customer management (CRUD)
- [x] Basic scheduling view

### Accountant Dashboard (Web)
- [x] Dashboard with financial summary
- [x] Invoice management (create, view, edit)
- [x] Record payments
- [x] View customer billing info
- [x] View orders (read-only)

### Customer Portal (Web)
- [x] Registration and login
- [x] Dashboard with order overview
- [x] Place new order
- [x] View order list and details
- [x] Basic order tracking
- [x] View invoices
- [x] Profile management

---

## What's OUT of MVP (Future Features)

### Advanced Features - Deferred
- [ ] Real-time GPS tracking
- [ ] Push notifications
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Advanced route optimization
- [ ] Proof of delivery (photos, signatures)
- [ ] Document upload/management
- [ ] Customer ratings and reviews
- [ ] Driver performance metrics
- [ ] Automated pricing/quoting
- [ ] Integration with payment gateways
- [ ] Integration with mapping services
- [ ] Integration with accounting software
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Offline mode for mobile apps
- [ ] Bulk order import
- [ ] Advanced reporting and analytics
- [ ] Export to Excel/PDF
- [ ] Audit logs
- [ ] Two-factor authentication
- [ ] API for third-party integrations

---

## Priority Levels

### P0 - Must Have (Core MVP)
These features are essential for the prototype to function.

| Feature | App | Role |
|---------|-----|------|
| Login/Logout | All | All |
| View Dashboard | All | All |
| Create Order | Web/Mobile | Staff, Admin, Customer |
| View Orders | All | All (filtered by role) |
| Assign Driver | Web/Mobile | Staff, Admin |
| Update Delivery Status | Mobile | Driver |
| Create User | Mobile | Admin |
| Create Invoice | Web | Accountant |
| Record Payment | Web | Accountant |

### P1 - Should Have (Important)
Important but system works without them.

| Feature | App | Role |
|---------|-----|------|
| Edit Order | Web/Mobile | Staff, Admin |
| Cancel Order | Web | Customer, Staff, Admin |
| View Order History | All | All |
| Edit Profile | All | All |
| Vehicle Management | Mobile | Admin |
| Customer Management | Web | Staff |
| Search/Filter | All | All |

### P2 - Nice to Have (Enhancement)
Improves experience but not required for demo.

| Feature | App | Role |
|---------|-----|------|
| Forgot Password | All | All |
| Delivery Notes | Mobile | Driver |
| Financial Summary View | Mobile | Admin |
| Schedule Calendar View | Web | Staff |
| Print Invoice | Web | Accountant, Customer |

---

## MVP Screens Per App

### Admin Mobile App (10 core screens)
1. Login
2. Dashboard
3. Order List
4. Order Detail
5. Create/Edit Order
6. User List
7. Create/Edit User
8. Vehicle List
9. Create/Edit Vehicle
10. Profile

### Driver Mobile App (6 core screens)
1. Login
2. Dashboard
3. Delivery List
4. Delivery Detail
5. Update Status
6. Profile

### Staff Web App (10 core screens)
1. Login
2. Dashboard
3. Order List
4. Order Detail
5. Create/Edit Order
6. Driver List
7. Customer List
8. Create/Edit Customer
9. Schedule View
10. Profile

### Accountant Web App (8 core screens)
1. Login
2. Dashboard
3. Invoice List
4. Invoice Detail
5. Create Invoice
6. Payment List
7. Record Payment
8. Profile

### Customer Web App (9 core screens)
1. Login
2. Register
3. Dashboard
4. Place Order
5. Order List
6. Order Detail/Tracking
7. Invoice List
8. Invoice Detail
9. Profile

---

## MVP Timeline Estimate

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Setup | 1 week | Project setup, authentication, database |
| Phase 2: Core Backend | 2 weeks | API endpoints for all entities |
| Phase 3: Admin App | 2 weeks | Admin mobile app |
| Phase 4: Driver App | 1 week | Driver mobile app |
| Phase 5: Web Apps | 3 weeks | Staff, Accountant, Customer portals |
| Phase 6: Integration | 1 week | Testing, bug fixes, polish |
| **Total** | **10 weeks** | Complete MVP |

---

## Success Criteria for MVP

The MVP is complete when:

1. **Admin can:**
   - Login and view dashboard
   - Create and manage users of all roles
   - View and manage all orders
   - Manage fleet/vehicles

2. **Driver can:**
   - Login and see assigned deliveries
   - Update delivery status from pickup to delivery
   - View cargo and destination details

3. **Staff can:**
   - Login and view operations dashboard
   - Create and manage orders
   - Assign drivers to orders
   - Manage customers

4. **Accountant can:**
   - Login and view financial dashboard
   - Create invoices for orders
   - Record payments received

5. **Customer can:**
   - Register and login
   - Place new shipping orders
   - Track their orders
   - View their invoices

6. **System demonstrates:**
   - Role-based access (each role sees only permitted data)
   - Complete order lifecycle (create → assign → deliver → invoice → pay)
   - Basic data validation
   - Responsive web design
   - Functional mobile apps
