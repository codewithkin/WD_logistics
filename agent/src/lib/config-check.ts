/**
 * What is configured, reported at boot, without ever stopping the boot.
 *
 * This exists because of a deployment that crash-looped and rolled back: an
 * agent module read `OPENAI_API_KEY` at import time and threw when it was
 * missing, so the whole service died before serving a request — over a
 * variable that only one of its features needed.
 *
 * The rule now is that nothing at module load may throw over configuration.
 * A missing key disables the feature that needs it and says so here; the
 * service still starts, still answers its healthcheck, and still does
 * everything else. The only exception is a variable without which the
 * process has no purpose at all, and there is currently exactly one.
 */

interface Check {
  name: string;
  value: string | undefined;
  /** What stops working when it is absent. */
  enables: string;
  /** True when the service genuinely cannot run without it. */
  fatal?: boolean;
  /** Shown when it is missing, if there is something useful to say. */
  hint?: string;
}

function describe(value: string | undefined): string {
  if (!value) return "not set";
  // Never print a secret, but do show enough to tell two keys apart.
  if (value.length > 24) return `set (${value.slice(0, 6)}…, ${value.length} chars)`;
  return `set (${value})`;
}

export function checkConfiguration(): { fatal: string[] } {
  const checks: Check[] = [
    {
      name: "AGENT_API_KEY",
      value: process.env.AGENT_API_KEY,
      enables: "every call to the app — nothing works without it",
      fatal: true,
      hint: "Must be byte-identical to the app's AGENT_API_KEY.",
    },
    {
      name: "WEB_APP_URL",
      value: process.env.WEB_APP_URL,
      enables: "reaching the app",
      hint: "Defaults to http://localhost:3000, which is wrong in production.",
    },
    {
      name: "OPENROUTER_API_KEY",
      value: process.env.OPENROUTER_API_KEY,
      enables: "the WhatsApp assistant and the chat widget",
      hint: "Get one at https://openrouter.ai/keys. Everything else still runs without it.",
    },
    {
      name: "ASSISTANT_MODEL",
      value: process.env.ASSISTANT_MODEL,
      enables: "overriding the default model",
      hint: "Optional — defaults to google/gemini-3.5-flash-lite.",
    },
    {
      name: "ENABLE_WHATSAPP",
      value: process.env.ENABLE_WHATSAPP,
      enables: "the WhatsApp bot itself",
      hint: 'Optional — anything other than "true" runs the service as a plain API with no Chromium.',
    },
    {
      name: "AGENT_ORGANIZATION_ID",
      value: process.env.AGENT_ORGANIZATION_ID,
      enables: "delivery receipts",
      hint: "Optional — receipts are looked up by WhatsApp's own message id when absent.",
    },
  ];

  const fatal: string[] = [];

  console.log("\n⚙️  Configuration");
  for (const check of checks) {
    const ok = Boolean(check.value);
    const mark = ok ? "✅" : check.fatal ? "❌" : "➖";
    console.log(`   ${mark} ${check.name.padEnd(24)} ${describe(check.value)}`);
    if (!ok) {
      console.log(`      ${check.fatal ? "REQUIRED" : "optional"} — ${check.enables}`);
      if (check.hint) console.log(`      ${check.hint}`);
      if (check.fatal) fatal.push(check.name);
    }
  }

  if (fatal.length > 0) {
    console.error(
      `\n❌ Cannot run without: ${fatal.join(", ")}. Set them and redeploy.\n`,
    );
  } else {
    console.log("   Everything required is present.\n");
  }

  return { fatal };
}
