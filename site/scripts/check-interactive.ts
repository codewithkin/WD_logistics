/**
 * Does everything on the site that looks interactive actually do something?
 *
 * Run against the prerendered HTML of every page, so it sees what a browser
 * gets before a line of our JavaScript runs. It exists because the site
 * shipped with a footer whose phone number and email were plain text, four
 * service links pointing at one anchor, a footer link renderer that turned
 * any tel:/mailto: href into a dead <span>, cards that lifted on hover with
 * nothing behind them, and a contact form that lost the enquiry if you hit
 * Send before the page had hydrated. Every one of those looked finished in a
 * screenshot.
 *
 *   bun run build && bun run check:interactive
 *
 * The rules it holds: no phone number, email address or postal address is
 * ever printed as dead text; every internal link resolves; each service has
 * its own way in; the nav says where you are; anything collapsed is out of
 * reach rather than merely invisible; and the enquiry form posts without
 * JavaScript. Anything deliberately not a link is listed in ALLOWED_PLAIN
 * with a reason — an audit that skips quietly is worse than none, because it
 * produces a pass that stops anybody looking.
 */

import { readFileSync } from "node:fs";
import { COMPANY, NAV_LINKS, SERVICES } from "../src/lib/site";

const PAGES = [
  { path: "/", file: ".next/server/app/index.html" },
  { path: "/about", file: ".next/server/app/about.html" },
  { path: "/contact", file: ".next/server/app/contact.html" },
];

const CONTACT_DETAILS = [
  { label: "the WhatsApp number", value: COMPANY.whatsapp, href: COMPANY.whatsappHref },
  { label: "the office number", value: COMPANY.office, href: COMPANY.officeHref },
  { label: "the email address", value: COMPANY.email, href: COMPANY.emailHref },
  { label: "the yard address", value: COMPANY.address, href: COMPANY.mapsHref },
] as const;

/**
 * Contact details allowed to appear as plain text, and why. Empty on purpose:
 * every number, address and email on the site is currently reachable, and a
 * new one that is not has to be argued for here.
 */
const ALLOWED_PLAIN: Array<{ page: string; value: string; why: string }> = [];

/** Build output and the favicon — not links anybody follows. */
const isAsset = (href: string) =>
  href.startsWith("/_next/") || href.startsWith("/favicon");

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(50)} ${note}`);
}

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();
const textOf = (html: string) => collapse(html.replace(/<[^>]*>/g, " "));

/**
 * The visible page with its links and buttons removed, so what is left is
 * everything a reader can see but cannot act on. Head and scripts go too:
 * JSON-LD carries the phone number by design.
 */
function deadText(html: string): string {
  return textOf(
    html
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<a\b[\s\S]*?<\/a>/gi, " ")
      .replace(/<button\b[\s\S]*?<\/button>/gi, " "),
  );
}

for (const page of PAGES) {
  let html: string;
  try {
    html = readFileSync(page.file, "utf8");
  } catch {
    record(
      `${page.path} was prerendered`,
      false,
      `${page.file} is missing — run bun run build first`,
    );
    continue;
  }

  const dead = deadText(html);
  // Attribute values come back with & escaped, so compare against a copy
  // with the entities put back rather than escaping every href we look for.
  const hrefs = html.replace(/&amp;/g, "&");

  for (const detail of CONTACT_DETAILS) {
    const allowed = ALLOWED_PLAIN.some(
      (entry) => entry.page === page.path && entry.value === detail.value,
    );
    const printedDead = dead.includes(detail.value) && !allowed;
    // It only has to be reachable where it is shown at all.
    const shown = textOf(html.replace(/<head[\s\S]*?<\/head>/gi, " ")).includes(
      detail.value,
    );
    const linked = hrefs.includes(`href="${detail.href}"`);
    record(
      `${page.path}: ${detail.label} is a link, not text`,
      !printedDead && (!shown || linked),
      printedDead
        ? `printed as plain text: ${detail.value}`
        : shown && !linked
          ? `shown but nothing links to ${detail.href}`
          : "",
    );
  }

  const ids = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  );
  const routes = new Set(NAV_LINKS.map((link) => link.href));
  const slugs = new Set<string>(SERVICES.map((service) => service.slug));
  const broken: string[] = [];
  for (const [, href] of html.matchAll(/href="(\/[^"]*|#[^"]+)"/g)) {
    if (href.startsWith("#")) {
      if (!ids.has(href.slice(1))) broken.push(href);
      continue;
    }
    if (isAsset(href)) continue;
    const [path, query] = href.split("?");
    if (!routes.has(path)) {
      broken.push(href);
      continue;
    }
    const service = new URLSearchParams(query ?? "").get("service");
    if (service !== null && !slugs.has(service)) broken.push(href);
  }
  record(
    `${page.path}: every internal link resolves`,
    broken.length === 0,
    broken.length === 0 ? "" : [...new Set(broken)].join(", "),
  );

  record(
    `${page.path}: the nav marks the current page`,
    html.includes('aria-current="page"'),
    "",
  );

  // Collapsed with grid-template-rows, so without this its links stay in the
  // tab order and a screen reader reads the menu out on every page.
  const menu = html.match(/<div[^>]*id="site-menu"[^>]*>/i)?.[0] ?? "";
  record(
    `${page.path}: the closed mobile menu is inert`,
    /aria-hidden="true"/.test(menu) && /\binert(=|\s|>)/.test(menu),
    menu ? "" : "no #site-menu found",
  );

  // Every disclosure says what it controls, and the thing it controls exists.
  const triggers = [
    ...html.matchAll(/<button\b[^>]*aria-controls="([^"]+)"[^>]*>/g),
  ];
  const orphans = triggers.filter(
    (match) => !html.includes(`id="${match[1]}"`),
  );
  const unlabelled = triggers.filter(
    (match) => !/aria-expanded="(true|false)"/.test(match[0]),
  );
  record(
    `${page.path}: every toggle controls a panel that exists`,
    triggers.length > 0 && orphans.length === 0 && unlabelled.length === 0,
    `${triggers.length} toggles` +
      (orphans.length ? `, ${orphans.length} pointing at nothing` : "") +
      (unlabelled.length ? `, ${unlabelled.length} without aria-expanded` : ""),
  );

  // A panel hidden from the accessibility tree must be out of the tab order
  // too, or it is a trap: invisible links a keyboard still walks into.
  const hiddenPanels = [...html.matchAll(/<div[^>]*aria-hidden="true"[^>]*>/g)];
  const reachable = hiddenPanels.filter(
    (match) => !/\binert(=|\s|>)/.test(match[0]),
  );
  record(
    `${page.path}: nothing hidden is still reachable`,
    reachable.length === 0,
    reachable.length === 0
      ? `${hiddenPanels.length} hidden panels`
      : reachable.map((match) => match[0].slice(0, 70)).join(" | "),
  );
}

// Each service has its own way in: a card and a footer link, both carrying
// the slug the form reads. All four footer links used to share one anchor.
const home = readFileSync(PAGES[0].file, "utf8");
for (const service of SERVICES) {
  const href = `/contact?service=${service.slug}`;
  const count = home.split(`href="${href}"`).length - 1;
  record(
    `/: "${service.label}" starts its own enquiry`,
    count >= 2,
    `${count} link${count === 1 ? "" : "s"} (card + footer)`,
  );
}

// The enquiry form works before hydration: a real POST to a server action,
// not a client-only handler that drops the enquiry into the query string.
const contact = readFileSync(PAGES[2].file, "utf8");
const form = contact.match(/<form\b[^>]*>/i)?.[0] ?? "";
record(
  "/contact: the form posts without JavaScript",
  /method="POST"/i.test(form) && /name="\$ACTION_(REF_)?\d/.test(contact),
  form ? "" : "no form found",
);
record(
  "/contact: the send button submits the form",
  /<button[^>]*type="submit"[^>]*>/i.test(contact),
  "",
);
record(
  "/contact: the honeypot is hidden from people",
  /name="website"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*name="website"/.test(
    contact.replace(/\s+/g, " "),
  ),
  "",
);

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0
      ? " Nothing on the site looks clickable without being it."
      : ""),
);
process.exit(failed === 0 ? 0 : 1);
