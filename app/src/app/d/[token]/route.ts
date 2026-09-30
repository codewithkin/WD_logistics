import { NextRequest, NextResponse } from "next/server";
import { collectDocument } from "@/lib/documents/handoff";

/**
 * Collecting a document the assistant could not send over WhatsApp.
 *
 * Deliberately unauthenticated: it is opened on a phone, in a yard, from a
 * chat, by somebody who is not going to sign in for a PDF. The token is the
 * credential — 32 random bytes, good for a day, recorded every time it is
 * used (see lib/documents/handoff.ts).
 */
/**
 * A version of the name that can sit in a header: printable ASCII only, no
 * quotes. Dashes and accents become "-" rather than disappearing, so
 * "Profit and loss — Sept 2026.pdf" stays readable instead of collapsing to
 * "Profit and lossSept 2026.pdf".
 */
function asciiFilename(filename: string): string {
  return (
    filename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "-")
      .replace(/["\\]/g, "")
      .trim() || "document"
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const result = await collectDocument(token);

  if (!result.ok) {
    // One message for both cases. "Expired" and "never existed" are different
    // to us and the same to somebody holding a link that does not work, and
    // telling them apart tells a stranger which tokens are real.
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>Link expired</title>` +
        `<body style="font-family:system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f8f5;color:#1e2320">` +
        `<main style="max-width:32rem;padding:2rem;text-align:center">` +
        `<h1 style="font-size:1.25rem;margin:0 0 .5rem">This link has expired</h1>` +
        `<p style="margin:0;color:#646b65;line-height:1.6">Documents sent from the assistant can be collected for 24 hours. ` +
        `Ask for the report again and a fresh link will be sent.</p>` +
        `</main></body>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      "Content-Type": result.mimeType,
      // `attachment` so a phone offers to save it rather than trying to
      // render a CSV as a wall of text.
      //
      // Two filenames, because ours are not ASCII: the reports are named
      // "Profit and loss — Sept 2026.pdf" with a real em dash, and a raw one
      // in a header value is rejected outright before the response is even
      // built. The plain `filename` is stripped down for anything old, and
      // `filename*` (RFC 5987) carries the real one.
      "Content-Disposition":
        `attachment; filename="${asciiFilename(result.filename)}"; ` +
        `filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      "Content-Length": String(result.data.length),
      // Nothing about this should sit in a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
