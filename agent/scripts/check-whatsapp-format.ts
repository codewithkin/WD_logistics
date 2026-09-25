/**
 * What the model writes vs what WhatsApp renders.
 *
 * Fast and free — no model, no network. Run it after touching
 * lib/whatsapp-format.ts. The first three cases are verbatim replies the
 * assistant actually sent during a live check, asterisks and all.
 */
import { toWhatsAppMarkup as f } from "../src/lib/whatsapp-format";

const cases: Array<[string, string, string]> = [
  // label, input, expected
  ["real reply from the run", "You're welcome, **Kin**. Let me know whenever you need anything else!", "You're welcome, *Kin*. Let me know whenever you need anything else!"],
  ["real reply 2", "I am sending the **Profit Per Unit Report** as a PDF now.", "I am sending the *Profit Per Unit Report* as a PDF now."],
  ["role leak", "as a **Yard hand** with **readonly** access", "as a *Yard hand* with *readonly* access"],
  ["bold+italic", "***urgent***", "*_urgent_*"],
  ["underscore bold", "__Total__: $500", "*Total*: $500"],
  ["heading", "## Fleet summary\nADS2673 lost $265.00", "*Fleet summary*\nADS2673 lost $265.00"],
  ["md link", "See [the report](https://wd.co.zw/r/1) for detail", "See the report (https://wd.co.zw/r/1) for detail"],
  ["table", "| Truck | Profit |\n| --- | --- |\n| ADS2673 | -$265.00 |", "Truck — Profit\n\nADS2673 — -$265.00"],
  ["hr", "Totals\n---\n$500", "Totals\n\n$500"],
  // Must NOT be touched:
  ["already correct bold", "*ADS2673* lost *$265.00* last month", "*ADS2673* lost *$265.00* last month"],
  ["italic left alone", "_provisional_ figure", "_provisional_ figure"],
  ["strikethrough", "~$300~ $265", "~$300~ $265"],
  ["dash bullets", "- ADS2673: -$265.00\n- AEU7902: -$40.00", "- ADS2673: -$265.00\n- AEU7902: -$40.00"],
  ["numbered list", "1. ADS2673\n2. AEU7902", "1. ADS2673\n2. AEU7902"],
  ["blockquote", "> overspending on maintenance", "> overspending on maintenance"],
  ["code fence untouched", "```\n**not bold in here**\n```", "```\n**not bold in here**\n```"],
  ["inline code untouched", "set `**x**` in config", "set `**x**` in config"],
  ["maths not mangled", "2 * 3 = 6 and 4 * 5 = 20", "2 * 3 = 6 and 4 * 5 = 20"],
];

let bad = 0;
for (const [label, input, expected] of cases) {
  const got = f(input);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        in : ${JSON.stringify(input)}\n        got: ${JSON.stringify(got)}\n        exp: ${JSON.stringify(expected)}`);
}
console.log(`\n${cases.length - bad}/${cases.length} formatting cases correct`);
process.exit(bad ? 1 : 0);
