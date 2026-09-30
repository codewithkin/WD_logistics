/**
 * Does a document the chat cannot carry still reach the person who asked?
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-document-handoff.ts
 *
 * The complaint this exists for: "it generates reports but cannot send them".
 * whatsapp-web.js sends a file by pushing it through the Chromium page it
 * drives, and gives up well below WhatsApp's own limit — so the report was
 * produced, the send failed, and the person got an apology telling them to go
 * and find it in the web app.
 *
 * The fallback parks the file and hands over a link. This exercises that end
 * to end against the real database and the real route handler: park a
 * document, fetch it back through GET /d/<token>, check the bytes match, then
 * check that an expired token and an invented one are both refused.
 *
 * No model, no WhatsApp, no cost.
 */

import { prisma } from "../../src/lib/prisma";
import { stashDocument, collectDocument } from "../../src/lib/documents/handoff";
import { GET } from "../../src/app/d/[token]/route";

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(48)} ${note}`);
}

const org = await prisma.organization.findFirst({ select: { id: true } });
if (!org) {
  console.log("no organisation in the database — run bun run db:seed first");
  process.exit(1);
}

// Something that is unmistakably a PDF and unmistakably ours.
const body = Buffer.concat([
  Buffer.from("%PDF-1.4\n"),
  Buffer.from("handoff check ".repeat(400)),
  Buffer.from("\n%%EOF\n"),
]);
const base64 = body.toString("base64");

const stashed = await stashDocument({
  organizationId: org.id,
  filename: "Profit and loss — Sept 2026.pdf",
  mimeType: "application/pdf",
  base64,
  forPhone: "+263771234567",
});

record(
  "a document can be parked",
  Boolean(stashed.token) && stashed.url.endsWith(`/d/${stashed.token}`),
  `${stashed.sizeKb}KB · ${stashed.url.replace(stashed.token, "…")}`,
);

record(
  "the link expires",
  stashed.expiresAt.getTime() > Date.now() &&
    stashed.expiresAt.getTime() < Date.now() + 25 * 60 * 60 * 1000,
  `${stashed.expiresAt.toISOString()} (24h)`,
);

// --- the route, exactly as a phone would hit it ---------------------------
const request = new Request(stashed.url);
const response = await GET(request as never, {
  params: Promise.resolve({ token: stashed.token }),
});

record("the link serves the file", response.status === 200, `HTTP ${response.status}`);

const served = Buffer.from(await response.arrayBuffer());
record(
  "the bytes are the document, unchanged",
  served.equals(body),
  `${served.length} bytes in, ${body.length} out`,
);

record(
  "it downloads rather than rendering",
  (response.headers.get("content-disposition") ?? "").startsWith("attachment"),
  response.headers.get("content-disposition") ?? "no header",
);

record(
  "the filename survives",
  (response.headers.get("content-disposition") ?? "").includes("Profit and loss"),
  "so it is recognisable in the downloads folder",
);

record(
  "nothing caches it",
  (response.headers.get("cache-control") ?? "").includes("no-store"),
  response.headers.get("cache-control") ?? "no header",
);

// --- the collection is recorded -------------------------------------------
const row = await prisma.documentHandoff.findUnique({
  where: { token: stashed.token },
  select: { downloadCount: true, downloadedAt: true, forPhone: true },
});
record(
  "the collection is on the record",
  row?.downloadCount === 1 && row?.downloadedAt !== null,
  `count ${row?.downloadCount}, for ${row?.forPhone}`,
);

// --- a stale link is refused ----------------------------------------------
await prisma.documentHandoff.update({
  where: { token: stashed.token },
  data: { expiresAt: new Date(Date.now() - 1000) },
});
const stale = await collectDocument(stashed.token);
record(
  "an expired link is refused",
  stale.ok === false && stale.reason === "expired",
  "the document stays put; the link stops working",
);

const expiredResponse = await GET(new Request(stashed.url) as never, {
  params: Promise.resolve({ token: stashed.token }),
});
record(
  "and says so in words, not a stack trace",
  expiredResponse.status === 404 &&
    (await expiredResponse.text()).includes("expired"),
  `HTTP ${expiredResponse.status}`,
);

const invented = await collectDocument("not-a-real-token-at-all");
record(
  "an invented token is refused",
  invented.ok === false,
  "and gets the same page as an expired one, so it tells a stranger nothing",
);

await prisma.documentHandoff.deleteMany({ where: { token: stashed.token } });

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0 ? " A report that will not send still arrives." : ""),
);
process.exit(failed === 0 ? 0 : 1);
