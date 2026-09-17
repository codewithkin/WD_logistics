export const SITE_URL = "https://www.wd-logistics.co.zw";

// Next.js does not deep-merge `openGraph`/`twitter` between a layout's metadata
// and a page's metadata — a page that sets its own `openGraph` replaces the
// layout's entirely. Every page's `openGraph.images`/`twitter` block should
// spread this default in so the image and card type are never silently lost.
export const DEFAULT_OG_IMAGE = {
  url: "/images/fleet-lineup-yard.jpg",
  width: 2560,
  height: 1920,
  alt: "WD Logistics truck fleet lined up in the yard in Mutare, Zimbabwe",
} as const;

export const COMPANY = {
  name: "WD Logistics (Pvt) Ltd",
  founder: "Wellington Dziruni",
  address: "1 Tameside Close, Nyakamete, Mutare",
  addressFull: "1 Tameside Close, Nyakamete, Mutare, Zimbabwe",
  whatsapp: "+263 77 450 8908",
  whatsappHref: "https://wa.me/263774508908",
  whatsappE164: "+263774508908",
  office: "+263 77 295 8986",
  officeE164: "+263772958986",
  email: "operations@wd-logistics.co.zw",
  hours: [
    { label: "Mon–Fri", value: "07:00–18:00" },
    { label: "Sat", value: "08:00–13:00" },
  ],
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact us" },
] as const;
