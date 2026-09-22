import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, DM_Sans } from "next/font/google";
import { PageTransition } from "@/components/motion/PageTransition";
import { COMPANY, DEFAULT_OG, SITE_URL } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s",
    default: `WD Logistics | ${COMPANY.motto} — Road Freight Across the SADC Region`,
  },
  description:
    "WD Logistics (Pvt) Ltd — road freight and haulage across the SADC region, run from our Mutare base. Full loads, part loads, bulk & tipper, and abnormal loads.",
  authors: [{ name: COMPANY.founder }],
  keywords: [
    "WD Logistics",
    "Wellington Dziruni",
    "SADC haulage",
    "cross-border trucking",
    "trucking company Mutare",
    "freight transport Zambia",
    "freight transport Mozambique",
    "haulage DR Congo",
    "haulage South Africa",
  ],
  openGraph: {
    ...DEFAULT_OG,
    url: SITE_URL,
    title: `WD Logistics | ${COMPANY.motto} — Road Freight Across the SADC Region`,
    description:
      "Road freight and haulage across the SADC region, run from our Mutare base. Full loads, part loads, bulk & tipper, and abnormal loads — same-day quotes on WhatsApp.",
  },
  twitter: {
    card: "summary_large_image",
    title: `WD Logistics | ${COMPANY.motto} — Road Freight Across the SADC Region`,
    description:
      "Road freight and haulage across the SADC region, run from our Mutare base. Same-day quotes on WhatsApp.",
    images: ["/images/truck-side-blue.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${bricolageGrotesque.variable} ${dmSans.variable}`}
    >
      <body className="flex justify-center overflow-x-hidden bg-[#EDEFEC] font-sans text-[#1E2320]">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
