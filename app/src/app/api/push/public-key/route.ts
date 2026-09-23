import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

/**
 * Serves the VAPID public key at runtime.
 *
 * The browser needs this to create a subscription. It used to come from
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, which Next substitutes during `next build`
 * — and the Dockerfile declares that ARG with an empty default, so unless
 * someone remembered to pass it as a build arg, every production image
 * shipped with an empty key and "Enable notifications" failed before it did
 * anything. Reading it from the process environment here means the value can
 * be set like any other runtime variable.
 */
export async function GET() {
  const key = getVapidPublicKey();

  if (!key) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Push notifications are not configured on the server. An admin needs to set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ configured: true, key });
}
