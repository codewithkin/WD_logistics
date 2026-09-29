export const COMPANY = {
  name: "WD Logistics (Pvt) Ltd",
  motto: "Efficiency in Motion",
  founder: "Wellington Dziruni",
  address: "1 Tameside Close, Nyakamete, Mutare",
  addressFull: "1 Tameside Close, Nyakamete, Mutare, Zimbabwe",
  whatsapp: "+263 77 450 8908",
  whatsappHref: "https://wa.me/263774508908",
  office: "+263 77 295 8986",
  officeHref: "tel:+263772958986",
  email: "operations@wd-logistics.co.zw",
  emailHref: "mailto:operations@wd-logistics.co.zw",
  domain: "wd-logistics.co.zw",
  year: 2026,
};

// NOTE: placeholder production domain — confirm and update once real DNS/hosting
// is set up for the marketing site.
export const SITE_URL = "https://wd-logistics.co.zw";

// The SADC countries WD runs in. Single source of truth: the home-page route
// ticker, the JSON-LD `areaServed` and the coverage copy all read from here.
export const COUNTRIES = [
  "ZIMBABWE",
  "ZAMBIA",
  "MOZAMBIQUE",
  "DR CONGO",
  "SOUTH AFRICA",
];

// Shared OpenGraph fields, pulled into a constant so every page can spread it
// into its own `openGraph` object — Next.js metadata merging *replaces* the
// whole `openGraph` object (not a deep merge) whenever a page defines one, so
// without this, per-page `openGraph` blocks would silently drop `images`/
// `type`/`locale`/`siteName` inherited from the root layout.
export const DEFAULT_OG = {
  type: "website" as const,
  locale: "en_ZW",
  siteName: COMPANY.name,
  images: [
    {
      url: "/images/truck-side-blue.jpg",
      width: 1200,
      height: 800,
      alt: "A WD Logistics truck on the road in the SADC region",
    },
  ],
};

/**
 * The services the home page offers, and the slug each one carries into the
 * enquiry form.
 *
 * One source for both, so a card cannot link to a service the form does not
 * recognise. The three cards that used to end in "Check the schedule →" or a
 * hovering ↗ were plain spans — they looked like the way in and went nowhere,
 * which on the page whose job is to produce enquiries is the worst place for
 * a dead control.
 */
export const SERVICES = [
  { slug: "full-loads", label: "Full loads" },
  { slug: "part-loads", label: "Part loads" },
  { slug: "bulk-tipper", label: "Bulk & tipper" },
  { slug: "abnormal", label: "Abnormal & project loads" },
] as const;

export type ServiceSlug = (typeof SERVICES)[number]["slug"];

/** The label for a slug off the URL, or null if it is not one of ours. */
export function serviceLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return SERVICES.find((service) => service.slug === slug)?.label ?? null;
}

/** Where a service card points. */
export function enquiryHref(slug: ServiceSlug): string {
  return `/contact?service=${slug}`;
}

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact us" },
];
