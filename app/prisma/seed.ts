import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";

const prismaConfig: any = {
  log: ["error", "warn"],
};

if (process.env.ACCELERATE_URL) {
  prismaConfig.accelerateUrl = process.env.ACCELERATE_URL;
}

const prisma = new PrismaClient(prismaConfig);

// Helper functions
function randomDate(monthsAgo: number): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = monthsAgo === 0 ? now : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function main() {
  console.log("🌱 Starting comprehensive seed...\n");

  // ============================================================================
  // STEP 1: Clean up existing data
  // ============================================================================
  console.log("🧹 Cleaning up existing data...");
  
  await prisma.$transaction([
    prisma.tripExpense.deleteMany({}),
    prisma.truckExpense.deleteMany({}),
    prisma.driverExpense.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.trip.deleteMany({}),
    prisma.driver.deleteMany({}),
    prisma.truck.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.employee.deleteMany({}),
    prisma.expenseCategory.deleteMany({}),
  ]);
  
  console.log("✅ Cleaned up existing data\n");

  // ============================================================================
  // STEP 2: Get or Create Organization
  // ============================================================================
  let organization = await prisma.organization.findFirst({
    where: { slug: "wd-logistics" },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: "WD Logistics",
        slug: "wd-logistics",
        logo: null,
        metadata: JSON.stringify({
          address: "456 Transport Lane, Nairobi, Kenya",
          phone: "+254712345678",
          email: "contact@wdlogistics.com",
          currency: "KES",
          timezone: "Africa/Nairobi",
        }),
      },
    });
    console.log("✅ Created organization:", organization.name);
  } else {
    console.log("✅ Using existing organization:", organization.name);
  }

  // ============================================================================
  // STEP 3: Get or Create Admin User
  // ============================================================================
  const existingAdmin = await prisma.user.findFirst({
    where: { email: "admin@wdlogistics.com" },
    include: { members: true },
  });

  if (!existingAdmin) {
    const hashedPassword = await hashPassword("Admin@123");
    await prisma.user.create({
      data: {
        name: "System Admin",
        email: "admin@wdlogistics.com",
        emailVerified: true,
        accounts: {
          create: {
            accountId: "admin@wdlogistics.com",
            providerId: "credential",
            password: hashedPassword,
          },
        },
        members: {
          create: {
            organizationId: organization.id,
            role: "admin",
          },
        },
      },
    });
    console.log("✅ Created admin user: admin@wdlogistics.com");
  } else if (existingAdmin.members.length === 0) {
    await prisma.member.create({
      data: {
        organizationId: organization.id,
        userId: existingAdmin.id,
        role: "admin",
      },
    });
    console.log("✅ Added existing admin to organization");
  } else {
    console.log("✅ Admin user already exists");
  }

  // ============================================================================
  // STEP 4: Create Expense Categories (batch)
  // ============================================================================
  console.log("\n📁 Creating expense categories...");
  const categoryData = [
    { id: generateId(), name: "Fuel", isTrip: true, isTruck: true, isDriver: true, color: "#ef4444", description: "Fuel and diesel costs" },
    { id: generateId(), name: "Maintenance", isTrip: false, isTruck: true, isDriver: false, color: "#f97316", description: "Regular maintenance and servicing" },
    { id: generateId(), name: "Tires", isTrip: false, isTruck: true, isDriver: false, color: "#84cc16", description: "Tire purchases and replacements" },
    { id: generateId(), name: "Tolls", isTrip: true, isTruck: false, isDriver: true, color: "#06b6d4", description: "Highway tolls and road fees" },
    { id: generateId(), name: "Parking", isTrip: true, isTruck: false, isDriver: true, color: "#8b5cf6", description: "Parking fees" },
    { id: generateId(), name: "Driver Allowance", isTrip: true, isTruck: false, isDriver: true, color: "#ec4899", description: "Per diem and meal allowances" },
    { id: generateId(), name: "Insurance", isTrip: false, isTruck: true, isDriver: false, color: "#6366f1", description: "Vehicle insurance premiums" },
    { id: generateId(), name: "Registration", isTrip: false, isTruck: true, isDriver: false, color: "#14b8a6", description: "Vehicle registration and licensing" },
    { id: generateId(), name: "Repairs", isTrip: false, isTruck: true, isDriver: true, color: "#f59e0b", description: "Emergency repairs and fixes" },
    { id: generateId(), name: "Oil Change", isTrip: false, isTruck: true, isDriver: false, color: "#22c55e", description: "Engine oil and filter changes" },
    { id: generateId(), name: "Loading/Unloading", isTrip: true, isTruck: false, isDriver: false, color: "#a855f7", description: "Loading and unloading labor costs" },
    { id: generateId(), name: "Other", isTrip: true, isTruck: true, isDriver: true, color: "#71717a", description: "Miscellaneous expenses" },
  ];

  await prisma.expenseCategory.createMany({
    data: categoryData.map(c => ({ ...c, organizationId: organization.id })),
  });
  
  const categories = await prisma.expenseCategory.findMany({ where: { organizationId: organization.id } });
  console.log(`✅ Created ${categories.length} expense categories`);

  // ============================================================================
  // STEP 5: Create Customers (batch)
  // ============================================================================
  console.log("\n📦 Creating customers...");
  const customerNames = [
    "East Africa Breweries", "Bamburi Cement", "Kenya Tea Estates", 
    "Safaricom Distribution", "Bidco Africa", "Coca-Cola CCBA",
    "Tuskys Supermarkets", "Naivas Chain Stores", "Chandaria Industries",
    "Mumias Sugar Company", "Kenya Seed Company", "Farmer's Choice"
  ];

  const customerRecords = customerNames.map(name => ({
    id: generateId(),
    organizationId: organization.id,
    name,
    contactPerson: `${name.split(' ')[0]} Manager`,
    email: `contact@${name.toLowerCase().replace(/\s+/g, '')}.com`,
    phone: `+25470${randomNumber(1000000, 9999999)}`,
    address: `${randomNumber(1, 999)} Industrial Area, Nairobi`,
    paymentTerms: randomItem([15, 30, 45, 60]),
    creditLimit: randomFloat(500000, 2000000, 0),
    balance: 0,
    status: "active",
  }));

  await prisma.customer.createMany({ data: customerRecords });
  const customers = await prisma.customer.findMany({ where: { organizationId: organization.id } });
  console.log(`✅ Created ${customers.length} customers`);

  // ============================================================================
  // STEP 6: Create Trucks (batch)
  // ============================================================================
  console.log("\n🚛 Creating trucks...");
  const truckSpecs = [
    { make: "Mercedes-Benz", model: "Actros", year: 2021, registrationNo: "KBZ 123A" },
    { make: "Scania", model: "R450", year: 2020, registrationNo: "KCA 456B" },
    { make: "Volvo", model: "FH16", year: 2022, registrationNo: "KCD 789C" },
    { make: "MAN", model: "TGX", year: 2019, registrationNo: "KBY 234D" },
    { make: "DAF", model: "XF", year: 2021, registrationNo: "KCE 567E" },
    { make: "Isuzu", model: "FVZ", year: 2020, registrationNo: "KBX 890F" },
    { make: "Mercedes-Benz", model: "Axor", year: 2018, registrationNo: "KCG 123G" },
    { make: "Scania", model: "P410", year: 2022, registrationNo: "KBZ 456H" },
    { make: "Volvo", model: "FM", year: 2019, registrationNo: "KCA 789I" },
    { make: "MAN", model: "TGM", year: 2021, registrationNo: "KCD 012J" },
  ];

  const truckRecords = truckSpecs.map(spec => ({
    id: generateId(),
    organizationId: organization.id,
    ...spec,
    status: randomItem(["active", "active", "active", "in_service"]),
    currentMileage: randomNumber(50000, 250000),
    fuelType: "Diesel",
    tankCapacity: randomFloat(200, 400, 0),
    notes: randomItem([null, "Regular maintenance schedule", "Recently serviced", "Due for inspection"]),
  }));

  await prisma.truck.createMany({ data: truckRecords });
  const trucks = await prisma.truck.findMany({ where: { organizationId: organization.id } });
  console.log(`✅ Created ${trucks.length} trucks`);

  // ============================================================================
  // STEP 7: Create Drivers (batch, then update truck assignments)
  // ============================================================================
  console.log("\n👨‍✈️ Creating drivers...");
  const driverNames = [
    { firstName: "John", lastName: "Kamau" },
    { firstName: "Peter", lastName: "Ochieng" },
    { firstName: "David", lastName: "Mwangi" },
    { firstName: "James", lastName: "Kipchoge" },
    { firstName: "Joseph", lastName: "Otieno" },
    { firstName: "Samuel", lastName: "Wanjiru" },
    { firstName: "Daniel", lastName: "Mutua" },
    { firstName: "Michael", lastName: "Kariuki" },
    { firstName: "Patrick", lastName: "Njoroge" },
    { firstName: "Francis", lastName: "Omondi" },
  ];

  const driverRecords = driverNames.map((d, i) => ({
    id: generateId(),
    organizationId: organization.id,
    firstName: d.firstName,
    lastName: d.lastName,
    email: `${d.firstName.toLowerCase()}.${d.lastName.toLowerCase()}@wdlogistics.com`,
    phone: `+25472${randomNumber(1000000, 9999999)}`,
    licenseNumber: `DL-${randomNumber(100000, 999999)}`,
    passportNumber: `A${randomNumber(1000000, 9999999)}`,
    status: "active",
    startDate: new Date(2020 + randomNumber(0, 3), randomNumber(0, 11), randomNumber(1, 28)),
    assignedTruckId: i < trucks.length ? trucks[i].id : null,
  }));

  await prisma.driver.createMany({ data: driverRecords });
  const drivers = await prisma.driver.findMany({ where: { organizationId: organization.id } });
  console.log(`✅ Created ${drivers.length} drivers (${trucks.length} assigned to trucks)`);

  // ============================================================================
  // STEP 8: Create Employees (batch)
  // ============================================================================
  console.log("\n👥 Creating employees...");
  const employeeSpecs = [
    { firstName: "Mary", lastName: "Wanjiku", position: "Operations Manager", department: "Operations" },
    { firstName: "Grace", lastName: "Akinyi", position: "Finance Officer", department: "Finance" },
    { firstName: "Lucy", lastName: "Njeri", position: "HR Manager", department: "Human Resources" },
    { firstName: "Ann", lastName: "Chebet", position: "Dispatcher", department: "Operations" },
    { firstName: "Jane", lastName: "Wairimu", position: "Accountant", department: "Finance" },
    { firstName: "Rose", lastName: "Adhiambo", position: "Mechanic", department: "Maintenance" },
    { firstName: "Ruth", lastName: "Muthoni", position: "Admin Assistant", department: "Administration" },
    { firstName: "Susan", lastName: "Moraa", position: "Customer Service", department: "Operations" },
  ];

  const employeeRecords = employeeSpecs.map(e => ({
    id: generateId(),
    organizationId: organization.id,
    ...e,
    email: `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@wdlogistics.com`,
    phone: `+25471${randomNumber(1000000, 9999999)}`,
    idNumber: `${randomNumber(10000000, 99999999)}`,
    address: `${randomNumber(1, 500)} ${randomItem(["Kilimani", "Westlands", "Parklands", "South C"])} Estate, Nairobi`,
    emergencyContact: `+25470${randomNumber(1000000, 9999999)}`,
    salary: randomFloat(40000, 150000, 0),
    status: "active",
    startDate: new Date(2019 + randomNumber(0, 4), randomNumber(0, 11), randomNumber(1, 28)),
  }));

  await prisma.employee.createMany({ data: employeeRecords });
  console.log(`✅ Created ${employeeSpecs.length} employees`);

  // ============================================================================
  // STEP 9: Create Trips and Expenses (batch insert)
  // ============================================================================
  console.log("\n🗺️  Creating trips and expenses (batched)...");
  
  const routes = [
    { origin: "Nairobi", destination: "Mombasa", distance: 485, revenue: [80000, 150000] },
    { origin: "Nairobi", destination: "Kisumu", distance: 350, revenue: [60000, 100000] },
    { origin: "Nairobi", destination: "Eldoret", distance: 310, revenue: [55000, 90000] },
    { origin: "Mombasa", destination: "Nairobi", distance: 485, revenue: [80000, 150000] },
    { origin: "Nairobi", destination: "Nakuru", distance: 160, revenue: [35000, 60000] },
    { origin: "Kisumu", destination: "Nairobi", distance: 350, revenue: [60000, 100000] },
    { origin: "Nairobi", destination: "Thika", distance: 42, revenue: [20000, 40000] },
    { origin: "Eldoret", destination: "Nairobi", distance: 310, revenue: [55000, 90000] },
    { origin: "Nakuru", destination: "Mombasa", distance: 540, revenue: [90000, 160000] },
    { origin: "Nairobi", destination: "Malaba", distance: 440, revenue: [70000, 120000] },
  ];

  const loadDescriptions = [
    "General Cargo", "Cement Bags", "Tea Packages", "Beer Crates", 
    "Consumer Goods", "Building Materials", "Agricultural Products",
    "Electronics", "Food Products", "Industrial Equipment"
  ];

  const getCat = (name: string) => categories.find(c => c.name === name)!;

  // Build all trips and expenses in memory first
  const allTrips: any[] = [];
  const allExpenses: any[] = [];
  const allTripExpenses: any[] = [];
  const allTruckExpenses: any[] = [];
  const allDriverExpenses: any[] = [];

  // Drivers with trucks (for trips)
  const driversWithTrucks = drivers.filter(d => d.assignedTruckId !== null);

  for (let month = 11; month >= 0; month--) {
    const tripsThisMonth = randomNumber(15, 25);
    
    for (let i = 0; i < tripsThisMonth; i++) {
      const route = randomItem(routes);
      const driverIdx = randomNumber(0, driversWithTrucks.length - 1);
      const driver = driversWithTrucks[driverIdx];
      const truck = trucks.find(t => t.id === driver.assignedTruckId)!;
      const customer = randomItem(customers);
      const scheduledDate = randomDate(month);
      
      const isCompleted = month > 0 || randomNumber(1, 100) > 30;
      const isInProgress = !isCompleted && month === 0 && randomNumber(1, 100) > 50;
      
      const startDate = isCompleted || isInProgress 
        ? new Date(scheduledDate.getTime() + randomNumber(0, 24) * 3600000) 
        : null;
      const endDate = isCompleted && startDate 
        ? new Date(startDate.getTime() + randomNumber(6, 48) * 3600000) 
        : null;
      
      const actualMileage = isCompleted ? route.distance + randomNumber(-20, 50) : null;
      const startOdometer = truck.currentMileage + randomNumber(0, 1000) * (11 - month);

      const tripId = generateId();
      allTrips.push({
        id: tripId,
        organizationId: organization.id,
        truckId: truck.id,
        driverId: driver.id,
        customerId: customer.id,
        originCity: route.origin,
        destinationCity: route.destination,
        originAddress: `${route.origin} Depot, ${route.origin}`,
        destinationAddress: `${route.destination} Warehouse, ${route.destination}`,
        loadDescription: randomItem(loadDescriptions),
        loadWeight: randomFloat(5000, 25000, 0),
        loadUnits: randomNumber(50, 500),
        estimatedMileage: route.distance,
        actualMileage,
        startOdometer,
        endOdometer: isCompleted && actualMileage ? startOdometer + actualMileage : null,
        revenue: randomFloat(route.revenue[0], route.revenue[1], 0),
        status: isCompleted ? "completed" : (isInProgress ? "in_progress" : "scheduled"),
        scheduledDate,
        startDate,
        endDate,
        driverNotified: true,
        notifiedAt: new Date(scheduledDate.getTime() - randomNumber(1, 48) * 3600000),
      });

      // Create expenses for completed trips
      if (isCompleted && startDate && actualMileage) {
        // Fuel expense
        const fuelExpenseId = generateId();
        allExpenses.push({
          id: fuelExpenseId,
          organizationId: organization.id,
          categoryId: getCat("Fuel").id,
          amount: randomFloat(actualMileage * 25, actualMileage * 35, 0),
          date: new Date(startDate.getTime() + randomNumber(0, 6) * 3600000),
          notes: `Fuel for ${route.origin} → ${route.destination}`,
        });
        allTripExpenses.push({ id: generateId(), tripId, expenseId: fuelExpenseId });
        allTruckExpenses.push({ id: generateId(), truckId: truck.id, expenseId: fuelExpenseId });
        allDriverExpenses.push({ id: generateId(), driverId: driver.id, expenseId: fuelExpenseId });

        // Driver allowance - 80%
        if (randomNumber(1, 100) <= 80) {
          const allowanceId = generateId();
          allExpenses.push({
            id: allowanceId,
            organizationId: organization.id,
            categoryId: getCat("Driver Allowance").id,
            amount: randomFloat(2000, 5000, 0),
            date: startDate,
            notes: `Per diem for ${driver.firstName} ${driver.lastName}`,
          });
          allTripExpenses.push({ id: generateId(), tripId, expenseId: allowanceId });
          allDriverExpenses.push({ id: generateId(), driverId: driver.id, expenseId: allowanceId });
        }

        // Tolls - 60%
        if (randomNumber(1, 100) <= 60) {
          const tollId = generateId();
          allExpenses.push({
            id: tollId,
            organizationId: organization.id,
            categoryId: getCat("Tolls").id,
            amount: randomFloat(500, 2000, 0),
            date: new Date(startDate.getTime() + randomNumber(2, 10) * 3600000),
            notes: `Highway tolls: ${route.origin} → ${route.destination}`,
          });
          allTripExpenses.push({ id: generateId(), tripId, expenseId: tollId });
        }

        // Parking - 40%
        if (randomNumber(1, 100) <= 40 && endDate) {
          const parkingId = generateId();
          allExpenses.push({
            id: parkingId,
            organizationId: organization.id,
            categoryId: getCat("Parking").id,
            amount: randomFloat(200, 800, 0),
            date: new Date(endDate.getTime() - randomNumber(1, 3) * 3600000),
            notes: `Overnight parking at ${route.destination}`,
          });
          allTripExpenses.push({ id: generateId(), tripId, expenseId: parkingId });
        }

        // Loading/Unloading - 50%
        if (randomNumber(1, 100) <= 50 && endDate) {
          const loadingId = generateId();
          allExpenses.push({
            id: loadingId,
            organizationId: organization.id,
            categoryId: getCat("Loading/Unloading").id,
            amount: randomFloat(1500, 4000, 0),
            date: endDate,
            notes: `Labor costs at ${route.destination}`,
          });
          allTripExpenses.push({ id: generateId(), tripId, expenseId: loadingId });
        }
      }
    }

    // Truck maintenance expenses each month (not linked to trips)
    const maintenanceCount = randomNumber(3, 6);
    for (let i = 0; i < maintenanceCount; i++) {
      const truck = randomItem(trucks);
      const expenseType = randomItem([
        { category: "Maintenance", amount: [15000, 45000], notes: "Regular service and checkup" },
        { category: "Oil Change", amount: [3000, 8000], notes: "Engine oil and filter replacement" },
        { category: "Tires", amount: [25000, 80000], notes: "Tire replacement" },
        { category: "Repairs", amount: [10000, 60000], notes: "Brake system repair" },
        { category: "Insurance", amount: [50000, 150000], notes: "Monthly insurance premium" },
      ]);

      const expenseId = generateId();
      allExpenses.push({
        id: expenseId,
        organizationId: organization.id,
        categoryId: getCat(expenseType.category).id,
        amount: randomFloat(expenseType.amount[0], expenseType.amount[1], 0),
        date: randomDate(month),
        notes: `${expenseType.notes} - ${truck.registrationNo}`,
      });
      allTruckExpenses.push({ id: generateId(), truckId: truck.id, expenseId });
    }
  }

  // Batch insert all data
  console.log(`   Inserting ${allTrips.length} trips...`);
  await prisma.trip.createMany({ data: allTrips });
  
  console.log(`   Inserting ${allExpenses.length} expenses...`);
  await prisma.expense.createMany({ data: allExpenses });
  
  console.log(`   Linking expenses to trips (${allTripExpenses.length})...`);
  await prisma.tripExpense.createMany({ data: allTripExpenses });
  
  console.log(`   Linking expenses to trucks (${allTruckExpenses.length})...`);
  await prisma.truckExpense.createMany({ data: allTruckExpenses });
  
  console.log(`   Linking expenses to drivers (${allDriverExpenses.length})...`);
  await prisma.driverExpense.createMany({ data: allDriverExpenses });

  console.log(`✅ Created ${allTrips.length} trips`);
  console.log(`✅ Created ${allExpenses.length} expenses`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n" + "=".repeat(60));
  console.log("🎉 SEED COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log("\n📊 Data Summary:");
  console.log(`   • Organization: 1 (WD Logistics)`);
  console.log(`   • Customers:    ${customers.length}`);
  console.log(`   • Trucks:       ${trucks.length}`);
  console.log(`   • Drivers:      ${drivers.length} (${trucks.length} assigned to trucks)`);
  console.log(`   • Employees:    ${employeeSpecs.length}`);
  console.log(`   • Categories:   ${categories.length}`);
  console.log(`   • Trips:        ${allTrips.length}`);
  console.log(`   • Expenses:     ${allExpenses.length}`);
  console.log("\n🔗 Relationships:");
  console.log(`   • TripExpenses:   ${allTripExpenses.length}`);
  console.log(`   • TruckExpenses:  ${allTruckExpenses.length}`);
  console.log(`   • DriverExpenses: ${allDriverExpenses.length}`);
  console.log("\n📝 Admin Credentials:");
  console.log("   Email:    admin@wdlogistics.com");
  console.log("   Password: Admin@123");
  console.log("\n⚠️  Please change the password after first login!");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
