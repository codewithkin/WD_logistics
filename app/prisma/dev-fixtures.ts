/**
 * Local-only test fixtures: one user per role, a couple of trailers, and a
 * spread of maintenance jobs. Throwaway — not part of the repo.
 */
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/prisma";

const PASSWORD = "Test@12345";

async function ensureUser(name: string, email: string, role: string, organizationId: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { name, email, emailVerified: true },
    });
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await hashPassword(PASSWORD),
      },
    });
  }
  const member = await prisma.member.findFirst({ where: { organizationId, userId: user.id } });
  if (!member) {
    await prisma.member.create({ data: { organizationId, userId: user.id, role } });
  } else if (member.role !== role) {
    await prisma.member.update({ where: { id: member.id }, data: { role } });
  }
  return user;
}

const org = await prisma.organization.findFirst();
if (!org) throw new Error("No organization — run db:seed first");

const supervisor = await ensureUser("Tapiwa Supervisor", "supervisor@wd.test", "supervisor", org.id);
const staff = await ensureUser("Rudo Staff", "staff@wd.test", "staff", org.id);
const workshopA = await ensureUser("Farai Workshop", "workshop@wd.test", "workshop", org.id);
const workshopB = await ensureUser("Blessing Workshop", "workshop2@wd.test", "workshop", org.id);
const admin = await prisma.member.findFirst({ where: { organizationId: org.id, role: "admin" } });

const trucks = await prisma.truck.findMany({ where: { organizationId: org.id }, take: 4 });

// Trailers
const trailerSpecs = [
  { registrationNo: "TRL 4471", make: "Afrit", model: "Flatbed", year: 2019, type: "flatbed" },
  { registrationNo: "TRL 8823", make: "SA Truck Bodies", model: "Tautliner", year: 2021, type: "curtainsider" },
];
const trailers = [];
for (const spec of trailerSpecs) {
  const existing = await prisma.trailer.findFirst({
    where: { organizationId: org.id, registrationNo: spec.registrationNo },
  });
  trailers.push(
    existing ??
      (await prisma.trailer.create({ data: { ...spec, organizationId: org.id, status: "active" } })),
  );
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(9, 0, 0, 0);
  return d;
};

await prisma.maintenanceRequest.deleteMany({ where: { organizationId: org.id } });

const jobs = [
  // Farai: 2 today, 1 overdue, 1 upcoming
  { truckId: trucks[0]?.id, notes: "Front brake pads worn down — grinding noise on the Harare run.", date: day(0), assignedToId: workshopA.id, status: "assigned" },
  { truckId: trucks[1]?.id, notes: "Air leak on the trailer coupling. Loses pressure overnight.", date: day(0), assignedToId: workshopA.id, status: "in_progress" },
  { truckId: trucks[2]?.id, notes: "Headlight alignment out after the pothole on Christmas Pass.", date: day(-3), assignedToId: workshopA.id, status: "assigned" },
  { trailerId: trailers[0].id, notes: "Trailer landing leg bent, needs straightening or replacement.", date: day(2), assignedToId: workshopA.id, status: "assigned" },
  // Blessing
  { trailerId: trailers[1].id, notes: "Curtain torn along the nearside rail.", date: day(-1), assignedToId: workshopB.id, status: "assigned" },
  // Unassigned + a closed one for the office view
  { truckId: trucks[0]?.id, notes: "Aircon not cooling in the cab.", date: day(-6), status: "open" },
  {
    truckId: trucks[0]?.id,
    notes: "Gearbox oil leak reported by driver.",
    date: day(-20),
    assignedToId: workshopB.id,
    status: "fixed",
    fixedById: workshopB.id,
    fixedAt: day(-17),
    fixedNotes: "Replaced the output shaft seal and topped up the gearbox oil. Ran it 40km, no drips.",
  },
];

for (const job of jobs) {
  if (!job.truckId && !job.trailerId) continue;
  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      truckId: job.truckId ?? null,
      trailerId: job.trailerId ?? null,
      notes: job.notes,
      date: job.date,
      status: job.status,
      reportedById: admin!.userId,
      assignedToId: job.assignedToId ?? null,
      assignedById: job.assignedToId ? admin!.userId : null,
      assignedAt: job.assignedToId ? job.date : null,
      fixedById: job.fixedById ?? null,
      fixedAt: job.fixedAt ?? null,
      fixedNotes: job.fixedNotes ?? null,
    },
  });
}

console.log("users:", [supervisor.email, staff.email, workshopA.email, workshopB.email].join(", "));
console.log("password:", PASSWORD);
console.log("trailers:", trailers.length, "jobs:", await prisma.maintenanceRequest.count());
