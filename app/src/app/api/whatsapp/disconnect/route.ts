import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

/**
 * Unlink the WhatsApp bot, from the web app.
 *
 * Unlinking on the phone used to leave the pairing row in Postgres, so the
 * app went on showing a live connection and the next start restored a
 * session WhatsApp had already thrown away. The agent now clears its own
 * row when the phone unlinks; this is the other direction — an admin
 * ending it from here.
 *
 * Two steps, and the second is the one that matters:
 *
 *  1. Ask the agent to log out. That tells WhatsApp, so the device leaves
 *     Linked Devices on the phone, and clears the browser profile.
 *  2. Delete the stored pairing directly, whatever step 1 did.
 *
 * Step 2 runs even when the agent is unreachable, and that is deliberate.
 * The agent being down is exactly when someone needs this button: the row
 * says connected, nothing is listening, and without a way to clear it from
 * here the only remedy is editing the table by hand. The row is the app's
 * data as much as the agent's, and the app can always speak to its own
 * database.
 */

/** Matches SESSION_NAME in the agent's lib/whatsapp.ts. */
const SESSION_NAME = "agent-whatsapp";

const AGENT_URL = process.env.AGENT_URL || process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export async function POST() {
  const session = await getServerSession();
  if (!session?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ending the pairing stops WhatsApp for everyone, so it is an admin's call.
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin can disconnect WhatsApp." },
      { status: 403 },
    );
  }

  let toldAgent = false;
  let agentSaid: string | null = null;

  try {
    const response = await fetch(`${AGENT_URL}/whatsapp/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: session.organizationId }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;
    toldAgent = response.ok && body?.success === true;
    agentSaid = body?.message ?? null;
  } catch (error) {
    console.warn("[whatsapp] agent unreachable while disconnecting:", error);
  }

  // Whatever the agent managed, the stored pairing goes.
  let cleared = 0;
  try {
    const result = await prisma.whatsAppSession.deleteMany({
      where: { session: SESSION_NAME },
    });
    cleared = result.count;
  } catch (error) {
    console.error("[whatsapp] could not clear the stored pairing:", error);
    return NextResponse.json(
      {
        error:
          "Could not clear the stored pairing. Try again, and if it keeps failing the row will need removing by hand.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    toldAgent,
    sessionCleared: cleared > 0,
    message: toldAgent
      ? (agentSaid ??
        "Disconnected. The device has been removed from your phone's linked devices.")
      : cleared > 0
        ? "The stored pairing was cleared, but the agent could not be reached to tell WhatsApp. Remove the device under Linked Devices on your phone as well."
        : "There was no pairing stored. Nothing to disconnect.",
  });
}
