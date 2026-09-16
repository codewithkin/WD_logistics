export const COMPANY = {
  name: "WD Logistics (Pvt) Ltd",
  address: "1 Tameside Close, Nyakamete, Mutare",
  addressFull: "1 Tameside Close, Nyakamete, Mutare, Zimbabwe",
  whatsapp: "+263 77 450 8908",
  whatsappHref: "https://wa.me/263774508908",
  office: "+263 77 295 8986",
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
