import "server-only";

/**
 * The one definition of how a WD Logistics document looks.
 *
 * Before this, the app had two visual systems: the payment receipt
 * (`lib/reports/receipt-generator.ts`) — logo, green accents, light-green
 * table headers, Helvetica — and everything else, which used a
 * black-and-white Times "accounting" style from `pdf-report-generator.ts`.
 * The client's own words: the receipt is immaculate, the invoice "looks more
 * like a statement". So the receipt's palette and type scale win, and this
 * module is where they live so no template can quietly diverge again.
 *
 * Server-only: the logo loader reads from disk.
 */

import fs from "fs";
import path from "path";

/** RGB tuples, because jsPDF cannot read CSS custom properties. */
export type Rgb = [number, number, number];

export const BRAND = {
  /** green-600 — the logo green, and the only strong colour on a document. */
  green: [22, 163, 74] as Rgb,
  /** A light tint, for table headers and the amount band. */
  greenLight: [220, 245, 227] as Rgb,
  /** blue-600 — a sparing accent, never a fill. */
  blue: [37, 99, 235] as Rgb,
  /** slate-800 — body text. */
  ink: [31, 41, 55] as Rgb,
  /** slate-500 — labels and secondary text. */
  muted: [107, 114, 128] as Rgb,
  /** slate-200 — hairlines. Never a black rule. */
  border: [229, 231, 235] as Rgb,
  /** Zebra striping on long tables. */
  zebra: [249, 250, 251] as Rgb,
  /** For negative figures and overdue states. */
  danger: [220, 38, 38] as Rgb,
  /** For "needs attention but not wrong" — unpaid, pending. */
  warn: [217, 119, 6] as Rgb,
} as const;

/**
 * One type scale for every document.
 *
 * jsPDF's built-in Helvetica has no glyphs outside Latin-1, which is fine for
 * "$", "US$" and "ZWG" but would garble a customer name containing, say, a
 * Cyrillic or CJK character. If that ever comes up, embed a TTF via
 * `addFileToVFS` rather than swapping the family here.
 */
export const TYPE = {
  family: "helvetica",
  /** The document's own name: INVOICE, RECEIPT, STATEMENT. */
  docTitle: 18,
  /** The organisation name in the header. */
  orgName: 14,
  /** Section headings. */
  heading: 11,
  /** The big number in an amount band. */
  amount: 17,
  body: 9.5,
  label: 9,
  small: 8,
  footer: 7.5,
} as const;

export const LAYOUT = {
  /** A4 portrait margins, in mm. */
  margin: 18,
  /** Where the header's accent rule sits. */
  headerRuleY: 36,
  /** First usable y below the header. */
  contentTop: 46,
  /** Space kept clear at the foot of every page for the footer. */
  footerReserve: 18,
  /** A4 height in mm, so callers can work out remaining space. */
  pageHeight: 297,
} as const;

/**
 * Company details as printed on documents.
 *
 * Defaults match the client's printed invoice book (photographed in
 * `designs/`), which is the authority — note it says 5182 Tameside Close,
 * where the marketing site says 1 Tameside Close. An Organization row that
 * fills these in overrides them.
 */
export interface CompanyDetails {
  name: string;
  motto: string;
  addressLines: string[];
  phone?: string;
  altPhone?: string;
  email?: string;
  website?: string;
  vatNumber?: string;
  bpNumber?: string;
  bankDetails?: string;
  invoiceTerms?: string;
}

const FALLBACK: CompanyDetails = {
  name: "WD LOGISTICS",
  motto: "Efficiency in Motion",
  addressLines: ["5182 Tameside Close", "Nyakamete Industrial Area", "Mutare"],
  phone: "+263 772 958 986",
  email: "dziruniw@gmail.com",
  website: "wd-logistics.co.zw",
};

/** What a caller passes in from an Organization row. */
export interface OrganizationLike {
  name?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  website?: string | null;
  vatNumber?: string | null;
  bpNumber?: string | null;
  bankDetails?: string | null;
  invoiceTerms?: string | null;
}

export function companyDetails(org?: OrganizationLike | null): CompanyDetails {
  if (!org) return FALLBACK;

  const addressLines = [org.addressLine1, org.addressLine2, org.city, org.country]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  return {
    name: org.name?.trim() || FALLBACK.name,
    motto: FALLBACK.motto,
    addressLines: addressLines.length > 0 ? addressLines : FALLBACK.addressLines,
    phone: org.phone?.trim() || FALLBACK.phone,
    altPhone: org.altPhone?.trim() || undefined,
    email: org.email?.trim() || FALLBACK.email,
    website: org.website?.trim() || FALLBACK.website,
    vatNumber: org.vatNumber?.trim() || undefined,
    bpNumber: org.bpNumber?.trim() || undefined,
    bankDetails: org.bankDetails?.trim() || undefined,
    invoiceTerms: org.invoiceTerms?.trim() || undefined,
  };
}

let cachedLogo: string | null | undefined;

/**
 * The logo as a data URL, read once per process.
 *
 * Reads from `public/` on disk, which works because app/Dockerfile copies the
 * full build tree rather than using Next's standalone output. A missing file
 * is not an error — templates fall back to a text wordmark.
 */
export function logoDataUrl(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const bytes = fs.readFileSync(logoPath);
    cachedLogo = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

/** One money formatter for every document. */
export function money(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/** "23 Sep 2026" — the form every document uses. */
export function shortDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** "1 Jul 2026 – 30 Sep 2026", for the period line under a report header. */
export function dateRangeLabel(
  from: Date | string,
  to: Date | string,
): string {
  return `${shortDate(from)} – ${shortDate(to)}`;
}
