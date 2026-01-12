import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient({
  // For Prisma 7.x - use adapter for local, accelerateUrl for cloud
  ...(process.env.ACCELERATE_URL
    ? { accelerateUrl: process.env.ACCELERATE_URL }
    : {}),
  log: ["error", "warn"],
});

// Helper function to generate random date in the past 12 months
function randomDate(monthsAgo: number): Date {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsAgo);
  const end = monthsAgo > 0 ? new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0) : now;
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper to get random item from array
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to get random number in range
function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to get random float
function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

async function main() {
  console.log("🌱 Starting comprehensive seed...");

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { email: "admin@wdlogistics.com" },
    include: { members: true },
  });

  if (existingAdmin && existingAdmin.members.length > 0) {
    console.log("✅ Admin user already exists:", existingAdmin.email);
    console.log("✅ Admin is already a member of an organization");
    return;
  }

  // Check if organization exists
  let organization = await prisma.organization.findFirst({
    where: { slug: "wd-logistics" },
  });

  // Create organization if it doesn't exist
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
    console.log("✅ Organization created:", organization.name);
  } else {
    console.log("✅ Organization already exists:", organization.name);
  }

  // Create admin user if doesn't exist
  if (existingAdmin && existingAdmin.members.length === 0) {
    await prisma.member.create({
      data: {
        organizationId: organization.id,
        userId: existingAdmin.id,
        role: "admin",
      },
    });
    console.log("✅ Added existing admin user to organization");
  } else if (!existingAdmin) {
    const hashedPassword = await hashPassword("Admin@123");
    const adminUser = await prisma.user.create({
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
    console.log("✅ Admin user created:", adminUser.email);
  }

  // Create expense categories
  const existingCategories = await prisma.expenseCategory.count({
    where: { organizationId: organization.id },
  });

  let categories: any[];
  if (existingCategories === 0) {
    const categoryData = [
      { name: "Fuel", isTrip: true, isTruck: true, isDriver: true, color: "#ef4444", description: "Fuel and diesel costs" },
      { name: "Maintenance", isTruck: true, color: "#f97316", description: "Regular maintenance and servicing" },
      { name: "Tires", isTruck: true, color: "#84cc16", description: "Tire purchases and replacements" },
      { name: "Tolls", isTrip: true, isDriver: true, color: "#06b6d4", description: "Highway tolls and road fees" },
      { name: "Parking", isTrip: true, isDriver: true, color: "#8b5cf6", description: "Parking fees" },
      { name: "Driver Allowance", isTrip: true, isDriver: true, color: "#ec4899", description: "Per diem and meal allowances" },
      { name: "Insurance", isTruck: true, color: "#6366f1", description: "Vehicle insurance premiums" },
      { name: "Registration", isTruck: true, color: "#14b8a6", description: "Vehicle registration and licensing" },
      { name: "Repairs", isTruck: true, isDriver: true, color: "#f59e0b", description: "Emergency repairs and fixes" },
      { name: "Oil Change", isTruck: true, color: "#22c55e", description: "Engine oil and filter changes" },
      { name: "Loading/Unloading", isTrip: true, color: "#a855f7", description: "Loading and unloading labor costs" },
      { name: "Other", isTrip: true, isTruck: true, isDriver: true, color: "#71717a", description: "Miscellaneous expenses" },
    ];

    for (const cat of categoryData) {
      await prisma.expenseCategory.create({
        data: {
          organizationId: organization.id,
          ...cat,
        },
      });
    }
    console.log(`✅ Created ${categoryData.length} expense categories`);
    
    categories = await prisma.expenseCategory.findMany({
      where: { organizationId: organization.id },
    });
  } else {
    console.log(`✅ Expense categories already exist (${existingCategories})`);
    categories = await prisma.expenseCategory.findMany({
      where: { organizationId: organization.id },
    });
  }

  // Create Customers
  console.log("📦 Creating customers...");
  const customerNames = [
    "East Africa Breweries", "Bamburi Cement", "Kenya Tea Estates", 
    "Safaricom Distribution", "Bidco Africa", "Coca-Cola CCBA",
    "Tuskys Supermarkets", "Naivas Chain Stores", "Chandaria Industries",
    "Mumias Sugar Company", "Kenya Seed Company", "Farmer's Choice"
  ];

  const customers = [];
  for (const name of customerNames) {
    const customer = await prisma.customer.create({
      data: {
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
      },
    });
    customers.push(customer);
  }
  console.log(`✅ Created ${customers.length} customers`);

  // Create Trucks
  console.log("🚛 Creating trucks...");
  const truckData = [
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

  const trucks = [];
  for (const data of truckData) {
    const truck = await prisma.truck.create({
      data: {
        organizationId: organization.id,
        ...data,
        status: randomItem(["active", "active", "active", "in_service"]),
        currentMileage: randomNumber(50000, 250000),
        fuelType: "Diesel",
        tankCapacity: randomFloat(200, 400, 0),
        notes: randomItem([null, "Regular maintenance schedule", "Recently serviced", "Due for inspection"]),
      },
    });
    trucks.push(truck);
  }
  console.log(`✅ Created ${trucks.length} trucks`);

  // Create Drivers
  console.log("👨‍✈️ Creating drivers...");
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

  const drivers = [];
  for (let i = 0; i < driverNames.length; i++) {
    const { firstName, lastName } = driverNames[i];
    const truck = i < trucks.length ? trucks[i] : null;
    
    const driver = await prisma.driver.create({
      data: {
        organizationId: organization.id,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@wdlogistics.com`,
        phone: `+25472${randomNumber(1000000, 9999999)}`,
        whatsappNumber: `+25472${randomNumber(1000000, 9999999)}`,
        licenseNumber: `DL-${randomNumber(100000, 999999)}`,
        passportNumber: `A${randomNumber(1000000, 9999999)}`,
        status: "active",
        startDate: new Date(2020 + randomNumber(0, 3), randomNumber(0, 11), randomNumber(1, 28)),
        assignedTruckId: truck?.id,
      },
    });
    drivers.push(driver);
  }
  console.log(`✅ Created ${drivers.length} drivers`);

  // Create Employees
  console.log("👥 Creating employees...");
  const employeeData = [
    { firstName: "Mary", lastName: "Wanjiku", position: "Operations Manager", department: "Operations" },
    { firstName: "Grace", lastName: "Akinyi", position: "Finance Officer", department: "Finance" },
    { firstName: "Lucy", lastName: "Njeri", position: "HR Manager", department: "Human Resources" },
    { firstName: "Ann", lastName: "Chebet", position: "Dispatcher", department: "Operations" },
    { firstName: "Jane", lastName: "Wairimu", position: "Accountant", department: "Finance" },
    { firstName: "Rose", lastName: "Adhiambo", position: "Mechanic", department: "Maintenance" },
    { firstName: "Ruth", lastName: "Muthoni", position: "Admin Assistant", department: "Administration" },
    { firstName: "Susan", lastName: "Moraa", position: "Customer Service", department: "Operations" },
  ];

  const employees = [];
  for (const data of employeeData) {
    const employee = await prisma.employee.create({
      data: {
        organizationId: organization.id,
        ...data,
        email: `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@wdlogistics.com`,
        phone: `+25471${randomNumber(1000000, 9999999)}`,
        idNumber: `${randomNumber(10000000, 99999999)}`,
        address: `${randomNumber(1, 500)} ${randomItem(["Kilimani", "Westlands", "Parklands", "South C"])} Estate, Nairobi`,
        emergencyContact: `+25470${randomNumber(1000000, 9999999)}`,
        salary: randomFloat(40000, 150000, 0),
        status: "active",
        startDate: new Date(2019 + randomNumber(0, 4), randomNumber(0, 11), randomNumber(1, 28)),
      },
    });
    employees.push(employee);
  }
  console.log(`✅ Created ${employees.length} employees`);

  // Create Trips and associated expenses for the last 12 months
  console.log("🗺️  Creating trips and expenses for the last 12 months...");
  
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

  let tripCount = 0;
  let expenseCount = 0;

  for (let month = 11; month >= 0; month--) {
    const tripsThisMonth = randomNumber(15, 25);
    
    for (let i = 0; i < tripsThisMonth; i++) {
      const route = randomItem(routes);
      const truck = randomItem(trucks);
      const driver = randomItem(drivers);
      const customer = randomItem(customers);
      const scheduledDate = randomDate(month);
      const isCompleted = month > 0 || randomNumber(1, 100) > 30;
      
      const startDate = isCompleted ? new Date(scheduledDate.getTime() + randomNumber(0, 24) * 3600000) : null;
      const endDate = isCompleted && startDate ? new Date(startDate.getTime() + randomNumber(6, 48) * 3600000) : null;
      
      const actualMileage = isCompleted ? route.distance + randomNumber(-20, 50) : null;
      const revenueAmount = randomFloat(route.revenue[0], route.revenue[1], 0);

      const trip = await prisma.trip.create({
        data: {
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
          startOdometer: truck.currentMileage + randomNumber(0, 5000),
          endOdometer: isCompleted ? truck.currentMileage + randomNumber(0, 5000) + actualMileage! : null,
          revenue: revenueAmount,
          status: isCompleted ? "completed" : (startDate ? "in_progress" : "scheduled"),
          scheduledDate,
          startDate,
          endDate,
          driverNotified: true,
          notifiedAt: new Date(scheduledDate.getTime() - randomNumber(1, 48) * 3600000),
        },
      });
      tripCount++;

      // Create expenses for completed trips
      if (isCompleted && startDate) {
        // Fuel expense (almost always)
        const fuelCategory = categories.find(c => c.name === "Fuel");
        if (fuelCategory) {
          const fuelExpense = await prisma.expense.create({
            data: {
              organizationId: organization.id,
              categoryId: fuelCategory.id,
              amount: randomFloat(actualMileage! * 25, actualMileage! * 35, 0),
              date: new Date(startDate.getTime() + randomNumber(0, 12) * 3600000),
              notes: `Fuel for ${route.origin} to ${route.destination} trip`,
              tripExpenses: { create: { tripId: trip.id } },
              truckExpenses: { create: { truckId: truck.id } },
            },
          });
          expenseCount++;
        }

        // Driver allowance
        const allowanceCategory = categories.find(c => c.name === "Driver Allowance");
        if (allowanceCategory && randomNumber(1, 100) > 20) {
          await prisma.expense.create({
            data: {
              organizationId: organization.id,
              categoryId: allowanceCategory.id,
              amount: randomFloat(2000, 5000, 0),
              date: startDate,
              notes: `Per diem for ${driver.firstName} ${driver.lastName}`,
              tripExpenses: { create: { tripId: trip.id } },
              driverExpenses: { create: { driverId: driver.id } },
            },
          });
          expenseCount++;
        }

        // Tolls (sometimes)
        if (randomNumber(1, 100) > 40) {
          const tollsCategory = categories.find(c => c.name === "Tolls");
          if (tollsCategory) {
            await prisma.expense.create({
              data: {
                organizationId: organization.id,
                categoryId: tollsCategory.id,
                amount: randomFloat(500, 2000, 0),
                date: new Date(startDate.getTime() + randomNumber(2, 10) * 3600000),
                notes: `Highway tolls for ${route.origin}-${route.destination}`,
                tripExpenses: { create: { tripId: trip.id } },
              },
            });
            expenseCount++;
          }
        }

        // Parking (sometimes)
        if (randomNumber(1, 100) > 60) {
          const parkingCategory = categories.find(c => c.name === "Parking");
          if (parkingCategory) {
            await prisma.expense.create({
              data: {
                organizationId: organization.id,
                categoryId: parkingCategory.id,
                amount: randomFloat(200, 800, 0),
                date: new Date(endDate!.getTime() - randomNumber(1, 3) * 3600000),
                notes: `Overnight parking at ${route.destination}`,
                tripExpenses: { create: { tripId: trip.id } },
              },
            });
            expenseCount++;
          }
        }

        // Loading/Unloading (sometimes)
        if (randomNumber(1, 100) > 50) {
          const loadingCategory = categories.find(c => c.name === "Loading/Unloading");
          if (loadingCategory) {
            await prisma.expense.create({
              data: {
                organizationId: organization.id,
                categoryId: loadingCategory.id,
                amount: randomFloat(1500, 4000, 0),
                date: endDate!,
                notes: `Labor costs for unloading at ${route.destination}`,
                tripExpenses: { create: { tripId: trip.id } },
              },
            });
            expenseCount++;
          }
        }
      }
    }

    // Add some truck maintenance expenses each month
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

      const category = categories.find(c => c.name === expenseType.category);
      if (category) {
        await prisma.expense.create({
          data: {
            organizationId: organization.id,
            categoryId: category.id,
            amount: randomFloat(expenseType.amount[0], expenseType.amount[1], 0),
            date: randomDate(month),
            notes: `${expenseType.notes} - ${truck.registrationNo}`,
            truckExpenses: { create: { truckId: truck.id } },
          },
        });
        expenseCount++;
      }
    }
  }

  console.log(`✅ Created ${tripCount} trips`);
  console.log(`✅ Created ${expenseCount} expenses`);

  console.log("\n🎉 Comprehensive seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`   Organizations: 1`);
  console.log(`   Customers: ${customers.length}`);
  console.log(`   Trucks: ${trucks.length}`);
  console.log(`   Drivers: ${drivers.length}`);
  console.log(`   Employees: ${employees.length}`);
  console.log(`   Trips (12 months): ${tripCount}`);
  console.log(`   Expenses (12 months): ${expenseCount}`);
  console.log(`   Expense Categories: ${categories.length}`);
  console.log("\n📝 Admin credentials:");
  console.log("   Email: admin@wdlogistics.com");
  console.log("   Password: Admin@123");
  console.log("\n⚠️  Please change the password after first login!");
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
