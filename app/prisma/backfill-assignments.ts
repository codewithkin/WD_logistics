/**
 * Derives driver/truck assignment history from the trips already on record.
 *
 * `DriverTruckAssignment` is new, so every fleet running this app has years of
 * history that was never captured — `Driver.assignedTruckId` only ever knew
 * the present. Without a backfill, item 25's per-truck snapshots would start
 * from the day the feature shipped and show nothing before it.
 *
 * The derivation: order each driver's trips by date, and group consecutive
 * trips on the same truck into one segment. A segment starts on its first
 * trip and ends when the next segment starts. The final segment stays open
 * only if it matches the driver's current `assignedTruckId` — otherwise the
 * driver has since moved on in a way the trips don't show.
 *
 * Run:
 *   bun prisma/backfill-assignments.ts            # dry run, prints the plan
 *   bun prisma/backfill-assignments.ts --apply    # writes it
 *
 * Idempotent: rows it would create that already exist are skipped, so running
 * it twice produces no duplicates.
 */

import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

interface Segment {
  driverId: string;
  driverName: string;
  truckId: string;
  registrationNo: string;
  startDate: Date;
  endDate: Date | null;
}

async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  let totalPlanned = 0;
  let totalSkipped = 0;

  for (const org of organizations) {
    console.log(`\n=== ${org.name} ===`);

    const drivers = await prisma.driver.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        startDate: true,
        assignedTruckId: true,
        assignedTruck: { select: { registrationNo: true, createdAt: true } },
      },
    });

    const segments: Segment[] = [];

    for (const driver of drivers) {
      const name = `${driver.firstName} ${driver.lastName}`;

      const trips = await prisma.trip.findMany({
        where: { driverId: driver.id, organizationId: org.id },
        select: {
          truckId: true,
          scheduledDate: true,
          endDate: true,
          truck: { select: { registrationNo: true } },
        },
        orderBy: { scheduledDate: "asc" },
      });

      if (trips.length === 0) {
        // No trips to derive from. If they currently hold a truck, open one
        // assignment from the later of their start date and the truck's.
        if (driver.assignedTruckId && driver.assignedTruck) {
          const start =
            driver.startDate > driver.assignedTruck.createdAt
              ? driver.startDate
              : driver.assignedTruck.createdAt;
          segments.push({
            driverId: driver.id,
            driverName: name,
            truckId: driver.assignedTruckId,
            registrationNo: driver.assignedTruck.registrationNo,
            startDate: start,
            endDate: null,
          });
        }
        continue;
      }

      // Group consecutive trips on the same truck.
      const driverSegments: Segment[] = [];
      for (const trip of trips) {
        const last = driverSegments[driverSegments.length - 1];
        if (last && last.truckId === trip.truckId) continue;
        driverSegments.push({
          driverId: driver.id,
          driverName: name,
          truckId: trip.truckId,
          registrationNo: trip.truck.registrationNo,
          startDate: trip.scheduledDate,
          endDate: null,
        });
      }

      // Each segment ends where the next begins — windows are [start, end),
      // so a same-day switch does not overlap.
      for (let i = 0; i < driverSegments.length - 1; i += 1) {
        driverSegments[i].endDate = driverSegments[i + 1].startDate;
      }

      // The last segment stays open only if the driver is still on that
      // truck. Otherwise close it at its last trip — they have moved on in a
      // way the trip record does not show.
      const last = driverSegments[driverSegments.length - 1];
      if (last.truckId !== driver.assignedTruckId) {
        const lastTrip = trips[trips.length - 1];
        last.endDate = lastTrip.endDate ?? lastTrip.scheduledDate;

        // And if they hold a different truck now, that is a segment too.
        if (driver.assignedTruckId && driver.assignedTruck) {
          driverSegments.push({
            driverId: driver.id,
            driverName: name,
            truckId: driver.assignedTruckId,
            registrationNo: driver.assignedTruck.registrationNo,
            startDate: last.endDate,
            endDate: null,
          });
        }
      }

      segments.push(...driverSegments);
    }

    // ---- Report, then optionally write ----
    const byDriver = new Map<string, Segment[]>();
    for (const segment of segments) {
      const list = byDriver.get(segment.driverName) ?? [];
      list.push(segment);
      byDriver.set(segment.driverName, list);
    }

    for (const [driverName, list] of [...byDriver].sort()) {
      console.log(`\n  ${driverName}`);
      for (const segment of list) {
        const from = segment.startDate.toISOString().split("T")[0];
        const to = segment.endDate
          ? segment.endDate.toISOString().split("T")[0]
          : "present";
        console.log(`    ${segment.registrationNo.padEnd(12)} ${from} → ${to}`);
      }
    }

    for (const segment of segments) {
      // Idempotence: the same driver, truck and start date is the same row.
      const existing = await prisma.driverTruckAssignment.findFirst({
        where: {
          driverId: segment.driverId,
          truckId: segment.truckId,
          startDate: segment.startDate,
        },
        select: { id: true },
      });

      if (existing) {
        totalSkipped += 1;
        continue;
      }

      totalPlanned += 1;
      if (APPLY) {
        await prisma.driverTruckAssignment.create({
          data: {
            organizationId: org.id,
            driverId: segment.driverId,
            truckId: segment.truckId,
            startDate: segment.startDate,
            endDate: segment.endDate,
            endReason: segment.endDate ? "backfill" : null,
          },
        });
      }
    }
  }

  console.log(
    `\n${APPLY ? "Created" : "Would create"} ${totalPlanned} assignment(s); ` +
      `${totalSkipped} already existed.`,
  );
  if (!APPLY) {
    console.log(
      "\nThis was a dry run. Review the segments above — they are derived " +
        "from trips, so a driver who moved trucks without running a trip on " +
        "the new one will look like they stayed put. Re-run with --apply " +
        "once the history reads correctly.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
