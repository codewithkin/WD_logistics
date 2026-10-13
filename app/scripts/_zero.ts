import { prisma } from "../src/lib/prisma";
const org = await prisma.organization.findFirstOrThrow({ select: { id: true } });
const driver = await prisma.driver.findFirstOrThrow({ where: { organizationId: org.id }, select: { id: true } });
const cat = await prisma.expenseCategory.findFirstOrThrow({ where: { organizationId: org.id, isTruck: true }, select: { id: true } });
const truck = await prisma.truck.create({
  data: { organizationId: org.id, registrationNo: "ZERO-REV", make: "Zero", model: "Rev", year: 2024, status: "active" },
});
const trip = await prisma.trip.create({
  data: {
    organizationId: org.id, truckId: truck.id, driverId: driver.id,
    originCity: "Harare", destinationCity: "Gweru", scheduledDate: new Date(),
    startDate: new Date(), endDate: new Date(), estimatedMileage: 275, actualMileage: 275,
    status: "completed", revenue: 0,
  },
});
const expense = await prisma.expense.create({
  data: {
    organizationId: org.id, categoryId: cat.id, amount: 180, date: new Date(),
    description: "Zero-rev diesel", truckExpenses: { create: { truckId: truck.id } },
  },
});
console.log(JSON.stringify({ truckId: truck.id, tripId: trip.id, expenseId: expense.id }));
await prisma.$disconnect();
