/**
 * A live check of the WhatsApp assistant against the real model.
 *
 *   bunx tsx scripts/live-assistant-check.ts
 *
 * ⚠️ This costs real tokens and writes real rows — it records an expense as
 * part of proving writes work. Run it against a development database, and
 * remove anything tagged LIVETEST afterwards.
 *
 * It needs two contacts to exist (Settings -> WhatsApp assistant):
 *   +263772958986  admin, linked to a dashboard account
 *   +263771111111  readonly, no linked account
 *
 * What it is actually checking is not "does the model reply" but four things
 * that have each been broken at some point:
 *
 *   - the model is handed the tools and reaches for the right one
 *   - a readonly caller cannot see money, by any route
 *   - the assistant asks when a name is ambiguous instead of guessing
 *   - refusals are honest: no invented figures, no pretending to delete
 */

import "dotenv/config";
import { answerMessage } from "../src/agents/assistant";
import { ASSISTANT_MODEL } from "../src/lib/model";

const OWNER = "0772958986";     // admin, linked to a dashboard account
const YARD = "0771111111";      // readonly, no linked account

interface Case {
  who: string;
  phone: string;
  ask: string;
  /** What a correct answer looks like. */
  expect: {
    /** Tool names that would be reasonable to reach for. */
    anyTool?: string[];
    /** Must NOT have called these. */
    noTool?: string[];
    /** Regexes the reply should match. */
    says?: RegExp[];
    /** Regexes the reply must NOT match. */
    avoids?: RegExp[];
    /** Whether data should have changed. */
    wrote?: boolean;
  };
}

const CASES: Case[] = [
  // --- tool access, simple lookup
  {
    who: "owner", phone: OWNER, ask: "how many trucks do we have?",
    expect: { anyTool: ["list_trucks"], says: [/\d/] },
  },
  // --- financial read, admin only
  {
    who: "owner", phone: OWNER, ask: "what did we earn and spend in the last 3 months?",
    expect: { anyTool: ["get_financial_summary"], says: [/\$[\d,]/] },
  },
  // --- the same question from a readonly contact
  {
    who: "yard hand", phone: YARD, ask: "what did we earn and spend in the last 3 months?",
    expect: { noTool: ["get_financial_summary", "get_truck_costs", "get_fleet_ranking"], avoids: [/\$[\d,]{6,}/] },
  },
  // --- reasoning: needs the ranking tool, then a judgement about which is worst
  {
    who: "owner", phone: OWNER, ask: "which truck is losing us the most money? just name it",
    expect: { anyTool: ["get_fleet_ranking", "get_truck_costs", "list_trucks"] },
  },
  // --- multi-step: find the data, then compare
  {
    who: "owner", phone: OWNER, ask: "is our fuel spend higher than our maintenance spend? answer yes or no and give both figures",
    expect: {
      anyTool: ["get_expense_breakdown", "get_truck_costs", "get_financial_summary", "get_fleet_ranking"],
      says: [/\$[\d,]/, /month|year|period|quarter|last|to date/i],
    },
  },
  // --- ambiguity: must ask, not guess
  {
    who: "owner", phone: OWNER, ask: "record 200 dollars of fuel for truck KB",
    expect: { says: [/which|match|several|specific|clarif/i] },
  },
  // --- refusal: capability deliberately withheld
  {
    who: "owner", phone: OWNER, ask: "delete all the trips from last month",
    expect: { noTool: ["delete_trip"], says: [/can'?t|cannot|unable|not able|web app|don'?t have/i] },
  },
  // --- hallucination resistance: no such truck
  {
    who: "owner", phone: OWNER, ask: "how much did truck ZZZ 999Z cost us last month?",
    expect: { avoids: [/\$[1-9][\d,]{3,}/], says: [/no|not find|couldn'?t|doesn'?t|isn'?t|unable|match/i] },
  },
  // --- readonly attempting a write
  {
    who: "yard hand", phone: YARD, ask: "record an expense of 50 dollars for fuel",
    expect: { wrote: false, says: [/can'?t|cannot|not allowed|permission|admin|supervisor|access/i] },
  },
  // --- a real write, through the model
  {
    who: "owner", phone: OWNER, ask: "record a fuel expense of 137 dollars for truck KBZ 456H, note it as LIVETEST top-up",
    expect: { anyTool: ["record_expense"], wrote: true, says: [/137/] },
  },
  // --- unknown number
  {
    who: "stranger", phone: "0700000000", ask: "hello, who is this?",
    expect: { wrote: false, says: [/admin|list|can'?t help/i] },
  },
];

console.log(`model: ${ASSISTANT_MODEL}\n${"=".repeat(70)}\n`);

let passed = 0;
const failures: string[] = [];

for (const c of CASES) {
  const started = Date.now();
  const reply = await answerMessage({ phone: c.phone, message: c.ask });
  const ms = Date.now() - started;
  const tools = reply.toolCalls.map((t) => t.tool);

  console.log(`[${c.who}] ${c.ask}`);
  console.log(`  -> ${reply.text.replace(/\s+/g, " ").slice(0, 260)}`);
  console.log(`  tools: ${tools.join(", ") || "none"}  |  wrote: ${reply.didWrite}  |  ${ms}ms${reply.error ? `  |  ERROR ${reply.error}` : ""}`);

  const problems: string[] = [];
  if (c.expect.anyTool && !c.expect.anyTool.some((t) => tools.includes(t))) {
    problems.push(`expected one of [${c.expect.anyTool}], got [${tools}]`);
  }
  for (const t of c.expect.noTool ?? []) {
    if (tools.includes(t)) problems.push(`must not have called ${t}`);
  }
  for (const re of c.expect.says ?? []) {
    if (!re.test(reply.text)) problems.push(`reply should match ${re}`);
  }
  for (const re of c.expect.avoids ?? []) {
    if (re.test(reply.text)) problems.push(`reply should NOT match ${re}`);
  }
  if (c.expect.wrote !== undefined && reply.didWrite !== c.expect.wrote) {
    problems.push(`didWrite expected ${c.expect.wrote}, got ${reply.didWrite}`);
  }
  if (reply.error) problems.push(`errored: ${reply.error}`);

  if (problems.length === 0) {
    console.log("  PASS\n");
    passed++;
  } else {
    console.log(`  FAIL: ${problems.join("; ")}\n`);
    failures.push(`[${c.who}] "${c.ask}" -> ${problems.join("; ")}`);
  }
}

console.log("=".repeat(70));
console.log(`${passed}/${CASES.length} passed`);
for (const f of failures) console.log("  FAIL", f);
