# WD Logistics - Application Pages

## Admin Mobile App Pages

### Authentication
| Page | Description |
|------|-------------|
| Login | Email and password login |
| Forgot Password | Request password reset |

### Main Navigation (Bottom Tabs)
| Tab | Page | Description |
|-----|------|-------------|
| Home | Dashboard | Overview stats and quick actions |
| Orders | Order List | View and manage all orders |
| Users | User List | Manage all users |
| Fleet | Vehicle List | Manage trucks/vehicles |
| More | Settings/Profile | Additional options |

### Order Flow
| Page | Description |
|------|-------------|
| Order List | All orders with filters |
| Order Detail | Full order information |
| Create Order | New order form |
| Edit Order | Modify order details |
| Assign Driver | Select driver for order |

### User Management Flow
| Page | Description |
|------|-------------|
| User List | All users with role filter |
| User Detail | View user profile |
| Create User | Add new user form |
| Edit User | Modify user details |

### Fleet Management Flow
| Page | Description |
|------|-------------|
| Vehicle List | All vehicles |
| Vehicle Detail | View vehicle info |
| Add Vehicle | Register new vehicle |
| Edit Vehicle | Update vehicle details |

### Additional Pages
| Page | Description |
|------|-------------|
| Driver List | View all drivers |
| Driver Detail | Driver info and assignments |
| Financial Summary | Quick financial overview |
| Profile | Admin's own profile |
| Settings | App settings |

**Total Admin App Pages: ~18**

---

## Driver Mobile App Pages

### Authentication
| Page | Description |
|------|-------------|
| Login | Email and password login |
| Forgot Password | Request password reset |

### Main Navigation (Bottom Tabs)
| Tab | Page | Description |
|-----|------|-------------|
| Home | Dashboard | Today's deliveries overview |
| Deliveries | Delivery List | All assigned deliveries |
| Profile | My Profile | Personal information |

### Delivery Flow
| Page | Description |
|------|-------------|
| Delivery List | Assigned deliveries with status filter |
| Delivery Detail | Full delivery information |
| Update Status | Change delivery status |
| Report Issue | Report problem with delivery |

### Profile Pages
| Page | Description |
|------|-------------|
| My Profile | View personal info |
| Edit Profile | Update contact details |
| My Vehicle | View assigned vehicle |

**Total Driver App Pages: ~10**

---

## Staff Web App Pages

### Authentication
| Page | Description |
|------|-------------|
| Login | Email and password login |
| Forgot Password | Request password reset |

### Main Navigation (Sidebar)
| Menu Item | Page | Description |
|-----------|------|-------------|
| Dashboard | Dashboard | Operations overview |
| Orders | Order Management | Handle all orders |
| Schedule | Scheduling | Calendar and assignments |
| Drivers | Driver Management | View drivers |
| Customers | Customer Management | Manage customers |
| Profile | My Profile | Personal settings |

### Order Flow
| Page | Description |
|------|-------------|
| Order List | All orders with search/filter |
| Order Detail | Full order information |
| Create Order | New order form |
| Edit Order | Modify order details |

### Scheduling Pages
| Page | Description |
|------|-------------|
| Schedule Calendar | Calendar view of deliveries |
| Assign Driver | Select driver for order |

### Driver Pages
| Page | Description |
|------|-------------|
| Driver List | All drivers |
| Driver Detail | Driver info and current assignments |

### Customer Pages
| Page | Description |
|------|-------------|
| Customer List | All customers |
| Customer Detail | Customer info and order history |
| Add Customer | Register new customer |
| Edit Customer | Update customer details |

### Profile Pages
| Page | Description |
|------|-------------|
| My Profile | View personal info |
| Edit Profile | Update personal details |

**Total Staff Web Pages: ~16**

---

## Accountant Web App Pages

### Authentication
| Page | Description |
|------|-------------|
| Login | Email and password login |
| Forgot Password | Request password reset |

### Main Navigation (Sidebar)
| Menu Item | Page | Description |
|-----------|------|-------------|
| Dashboard | Dashboard | Financial overview |
| Invoices | Invoice Management | Handle invoices |
| Payments | Payment Management | Record payments |
| Customers | Customer Billing | View customer balances |
| Profile | My Profile | Personal settings |

### Invoice Flow
| Page | Description |
|------|-------------|
| Invoice List | All invoices with filters |
| Invoice Detail | Full invoice information |
| Create Invoice | New invoice form |
| Edit Invoice | Modify invoice |

### Payment Pages
| Page | Description |
|------|-------------|
| Payment List | All recorded payments |
| Record Payment | Add new payment |
| Payment Detail | View payment info |

### Customer Billing Pages
| Page | Description |
|------|-------------|
| Customer List | Customers with balances |
| Customer Billing Detail | Customer payment history |

### Order Reference
| Page | Description |
|------|-------------|
| Order List (Read-only) | View orders for invoicing reference |
| Order Detail (Read-only) | Order details |

### Profile Pages
| Page | Description |
|------|-------------|
| My Profile | View personal info |
| Edit Profile | Update personal details |

**Total Accountant Web Pages: ~14**

---

## Customer Web App Pages

### Authentication
| Page | Description |
|------|-------------|
| Login | Email and password login |
| Register | Create new account |
| Forgot Password | Request password reset |

### Main Navigation (Header/Sidebar)
| Menu Item | Page | Description |
|-----------|------|-------------|
| Dashboard | Dashboard | Quick overview |
| New Order | Place Order | Create shipment request |
| My Orders | Order List | View all orders |
| Track | Order Tracking | Track shipment |
| Invoices | My Invoices | View billing |
| Profile | My Profile | Account settings |

### Order Flow
| Page | Description |
|------|-------------|
| Place Order | Multi-step order form |
| Order Confirmation | Order placed confirmation |
| Order List | All customer's orders |
| Order Detail | Full order information |
| Track Order | Shipment tracking view |
| Cancel Order | Confirm order cancellation |

### Invoice Pages
| Page | Description |
|------|-------------|
| Invoice List | All invoices |
| Invoice Detail | Invoice information |

### Profile Pages
| Page | Description |
|------|-------------|
| My Profile | View account info |
| Edit Profile | Update personal details |
| Change Password | Update password |

**Total Customer Web Pages: ~14**

---

## Page Count Summary

| Application | Platform | Total Pages |
|-------------|----------|-------------|
| Admin App | Mobile | ~18 |
| Driver App | Mobile | ~10 |
| Staff Dashboard | Web | ~16 |
| Accountant Dashboard | Web | ~14 |
| Customer Portal | Web | ~14 |
| **Total** | | **~72** |

---

## Shared/Common Components

### Mobile Apps (Admin & Driver)
- Loading screens
- Error states
- Empty states
- Pull-to-refresh
- Bottom navigation
- Status badges
- Cards for list items

### Web Apps (Staff, Accountant, Customer)
- Sidebar navigation
- Header with user menu
- Data tables with pagination
- Search bars
- Filter dropdowns
- Modal dialogs
- Form components
- Status badges
- Breadcrumbs
