/**
 * The assistant must not be able to make an admin.
 *
 *   bun run check:escalation
 *
 * Offline — no model, no network, no database.
 *
 * Every other write the assistant does is recoverable: a wrong expense is
 * deleted, a wrong trip status is changed back. An admin is not. They see
 * every figure the business has, and they can make more admins — including
 * approving the edit request that would have caught them.
 *
 * And over WhatsApp the only proof of who is asking is a phone number. A SIM
 * swap, a borrowed handset or a phone left on a seat is enough. So the one
 * action whose blast radius is the whole system stays behind a session in the
 * web app.
 *
 * Four layers, because the first three have each been the only one somewhere
 * before: the model is never shown "admin" as an option, the schema refuses
 * it, and the handler refuses it again in case anything ever hands it through
 * uncast.
 */

import { findOperation, operationManifest } from "@/lib/assistant/operations";

const ROLE_TAKING_OPS = ["create_user", "change_user_role"] as const;

let failures = 0;

function check(label: string, ok: boolean, note = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(58)} ${note}`);
}

for (const name of ROLE_TAKING_OPS) {
  const operation = findOperation(name);
  if (!operation) {
    check(`${name}: exists`, false, "operation not found");
    continue;
  }

  const asAdmin =
    name === "create_user"
      ? { name: "Mallory", email: "mallory@example.com", role: "admin" }
      : { person: "Mallory", role: "admin" };

  const asSupervisor =
    name === "create_user"
      ? { name: "Sam", email: "sam@example.com", role: "supervisor" }
      : { person: "Sam", role: "supervisor" };

  check(
    `${name}: schema refuses role "admin"`,
    !operation.schema.safeParse(asAdmin).success,
  );

  // The point is to stop escalation, not to break the feature.
  check(
    `${name}: schema still accepts "supervisor"`,
    operation.schema.safeParse(asSupervisor).success,
  );

  const result = (await operation.handler(asAdmin as never, {} as never)) as {
    error?: string;
  };
  check(
    `${name}: handler refuses admin when called directly`,
    typeof result?.error === "string" && result.error.includes("web app"),
    typeof result?.error === "string" ? "" : "no refusal returned",
  );
}

// What the model is actually shown. A tool whose description still offers
// admin teaches it to try, and a refusal it was invited into reads as a bug.
const manifest = operationManifest("admin");
for (const name of ROLE_TAKING_OPS) {
  const tool = manifest.find((entry) => entry.name === name);
  if (!tool) {
    check(`${name}: offered to an admin`, false, "missing from the manifest");
    continue;
  }
  const advertised = JSON.stringify(tool.schema);
  const roleEnum = advertised.match(/"enum":\[[^\]]*"supervisor"[^\]]*\]/)?.[0] ?? "";
  check(`${name}: advertised role list omits admin`, !roleEnum.includes('"admin"'), roleEnum);
}

console.log(
  failures === 0
    ? `\nthe assistant cannot make an admin — ${ROLE_TAKING_OPS.length} operations, 4 layers each`
    : `\n${failures} check(s) failed`,
);
process.exit(failures ? 1 : 0);
