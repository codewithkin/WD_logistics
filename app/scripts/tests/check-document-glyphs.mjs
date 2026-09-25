/**
 * Scans every PDF generator for characters the built-in jsPDF fonts cannot
 * draw, and for generators that build a document without the guard.
 *
 * Cheap and offline. Run after touching anything under lib/documents or
 * lib/reports. It exists because a customer's invoice went out reading
 * "B e i r a !' B e i r a" — the route arrow is not in cp1252, and nothing
 * caught it between writing the code and the customer reading the PDF.
 */
import fs from "fs";
import path from "path";

const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const drawable = (ch) => {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x20 && c <= 0x7e) ||
    (c >= 0xa0 && c <= 0xff) ||
    CP1252_EXTRA.includes(ch) ||
    ch === "\n" || ch === "\t" || ch === "\r"
  );
};

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
for (const r of ["src/lib/documents", "src/lib/reports"]) if (fs.existsSync(r)) walk(r);

let problems = 0;

// 1. Any generator that makes its own jsPDF must ask for the guard.
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!src.includes("new jsPDF")) continue;
  if (src.includes("drawOnlyWhatTheFontHas") || src.includes("createDocument")) continue;
  console.log(`UNGUARDED  ${f} builds a jsPDF without drawOnlyWhatTheFontHas`);
  problems++;
}

// 2. The guard rewrites arrows and ticks, but anything it has no mapping for
//    is dropped. Flag un-drawable characters so a new one is a decision, not
//    a silent deletion.
const KNOWN = "→➡➔←⬅↔⇄✓✔✗✘✕•●▪≥≤≠";
for (const f of files) {
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const ch of line) {
      if (drawable(ch) || KNOWN.includes(ch)) continue;
      console.log(
        `UNMAPPED   ${f}:${i + 1} has ${JSON.stringify(ch)} ` +
          `(U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}) — ` +
          `add it to UNDRAWABLE in documents/kit.ts or it will be dropped`,
      );
      problems++;
    }
  });
}

console.log(problems === 0
  ? `\nchecked ${files.length} files: every generator is guarded, no unmapped glyphs`
  : `\n${problems} problem(s)`);
process.exit(problems ? 1 : 0);
