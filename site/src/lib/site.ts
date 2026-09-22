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

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact us" },
];
