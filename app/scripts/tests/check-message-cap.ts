/**
 * The fair-use cap's arithmetic: 200 messages, and when the month turns over.
 *
 *   bun run check:cap
 *
 * Offline. No model, no WhatsApp; the only database query is the one the
 * settings page runs, checked against a raw count.
 *
 * The cap is the whole commercial safety net — the client pays $5/month flat,
 * so if this counts wrong the service loses money quietly rather than
 * failing loudly. It had no test at all: every criterion for it was ticked by
 * hand in improvements.md, and `resetUsageCache` was exported from the agent
 * "used by the checks" while nothing called it.
 *
 * The month boundary is the part most worth pinning down. Africa/Harare is
 * UTC+2 with no daylight saving, so counting in UTC would roll the month over
 * at 2am local and hand two extra hours of the old month's quota to whoever
 * was awake. That is an off-by-two-hours nobody would ever notice by hand,
 * which is exactly why it is asserted here.
 */

import {
  DEFAULT_MESSAGE_CAP,
  describeUsage,
  messageCap,
  monthEnd,
  monthStart,
  monthlyUsage,
} from "../../src/lib/assistant/usage";
import { prisma } from "../../src/lib/prisma";

let failures = 0;
let total = 0;

function check(label: string, ok: boolean, note = "") {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(56)} ${note}`);
}

// ------------------------------------------------------------------ the limit

const originalCap = process.env.WHATSAPP_MESSAGE_CAP;
delete process.env.WHATSAPP_MESSAGE_CAP;

check(
  "the cap is 200 a month",
  messageCap() === 200 && DEFAULT_MESSAGE_CAP === 200,
  `${messageCap()}`,
);

// A commercial term, not an engineering one: it was 120 in the first draft and
// 200 by the time it shipped. It has to move without a deploy.
process.env.WHATSAPP_MESSAGE_CAP = "350";
check("WHATSAPP_MESSAGE_CAP moves it without a deploy", messageCap() === 350, `${messageCap()}`);

for (const junk of ["0", "-5", "banana", ""]) {
  process.env.WHATSAPP_MESSAGE_CAP = junk;
  const got = messageCap();
  check(
    `a cap of "${junk}" falls back to 200 rather than to nothing`,
    got === 200,
    `${got}`,
  );
}

if (originalCap === undefined) delete process.env.WHATSAPP_MESSAGE_CAP;
else process.env.WHATSAPP_MESSAGE_CAP = originalCap;

// ------------------------------------------------------------- where it stops

// The boundary itself, from both sides. 199 has to answer: a cap that stops a
// message early is a customer complaint, and one that stops it late is the
// loss this exists to prevent.
check("199 messages still answers", describeUsage(199).blocked === false, "1 left");
check("the 200th is the last one allowed", describeUsage(199).remaining === 1);
check("at 200 the assistant is blocked", describeUsage(200).blocked === true, "0 left");
check("and remaining is 0, not negative", describeUsage(200).remaining === 0);

// If the local count ever overshoots — the agent increments between refreshes
// — the number shown to an admin must not go below zero.
check("an overshoot still reads 0 left", describeUsage(260).remaining === 0, "260 used");
check("and stays blocked", describeUsage(260).blocked === true);

// ------------------------------------------------------- the month, in Harare

// 22:30 UTC on 30 September is already 00:30 on 1 October in Harare, so the
// month it belongs to is October. Counting in UTC would put it in September
// and give the old month two extra hours of quota.
const justAfterMidnightHarare = new Date("2026-09-30T22:30:00Z");
check(
  "a message at 00:30 Harare on the 1st counts in the new month",
  monthStart(justAfterMidnightHarare).toISOString() === "2026-09-30T22:00:00.000Z",
  monthStart(justAfterMidnightHarare).toISOString(),
);

// And an hour earlier is still the old month.
const justBeforeMidnightHarare = new Date("2026-09-30T21:30:00Z");
check(
  "an hour earlier is still the old month",
  monthStart(justBeforeMidnightHarare).toISOString() === "2026-08-31T22:00:00.000Z",
  monthStart(justBeforeMidnightHarare).toISOString(),
);

check(
  "the count resets at Harare midnight, not UTC midnight",
  monthEnd(justBeforeMidnightHarare).toISOString() === "2026-09-30T22:00:00.000Z",
  monthEnd(justBeforeMidnightHarare).toISOString(),
);

// The window is derived from the clock, never stored, so the reset needs no
// job to run and cannot be missed because a container was down on the 1st.
const midMonth = new Date("2026-09-15T09:00:00Z");
check(
  "one month wide, so nothing has to run on the 1st",
  monthEnd(midMonth).getTime() > monthStart(midMonth).getTime() &&
    monthEnd(midMonth).getTime() - monthStart(midMonth).getTime() <= 32 * 24 * 3600_000,
  `${Math.round((monthEnd(midMonth).getTime() - monthStart(midMonth).getTime()) / 86_400_000)} days`,
);

// The date an admin is shown, in the month the reset actually falls in.
check(
  "and an admin is told the date in words",
  describeUsage(10, midMonth).resetsOn === "1 October",
  describeUsage(10, midMonth).resetsOn,
);

// --------------------------------------------- the number the page is showing

// The settings card and this query must agree, or the client is quoted a
// figure the cap is not enforcing.
const org = await prisma.organization.findFirst({ select: { id: true } });
if (!org) {
  check("the page's figure matches a raw count", false, "no organization — run db:seed");
} else {
  const shown = await monthlyUsage(org.id);
  const counted = await prisma.whatsAppMessage.count({
    where: {
      organizationId: org.id,
      direction: "inbound",
      createdAt: { gte: monthStart() },
    },
  });
  check(
    "the page's figure matches a raw count",
    shown.used === counted,
    `page ${shown.used}, count ${counted}`,
  );
  // Outbound messages are not counted: one question answered is one message,
  // which is what the customer-facing wording promises.
  const outbound = await prisma.whatsAppMessage.count({
    where: {
      organizationId: org.id,
      direction: "outbound",
      createdAt: { gte: monthStart() },
    },
  });
  check(
    "replies are not charged as messages",
    outbound === 0 || shown.used < counted + outbound,
    outbound === 0
      ? "no replies this month to test against"
      : `${outbound} replies sent, none of them counted`,
  );
}

console.log(
  failures === 0
    ? `\n${total} checks, 0 failed. 200 a month, counted in Harare.`
    : `\n${failures} of ${total} check(s) failed`,
);
process.exit(failures ? 1 : 0);
