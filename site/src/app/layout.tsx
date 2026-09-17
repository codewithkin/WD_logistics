import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";
import { COMPANY, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/constants";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const DEFAULT_TITLE = "WD Logistics | Trucking & Freight Logistics Company in Mutare, Zimbabwe";
const DEFAULT_DESCRIPTION =
  "WD Logistics (Pvt) Ltd, founded by Wellington Dziruni, is a Mutare-based trucking and haulage company running full loads, part loads and bulk freight across Zimbabwe and the SADC region. Get a quote on WhatsApp today.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | WD Logistics",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "WD Logistics",
    "Wellington Dziruni",
    "logistics company Zimbabwe",
    "trucking company Mutare",
    "freight transport Zimbabwe",
    "haulage Zimbabwe",
    "road freight Zimbabwe",
    "SADC freight",
  ],
  authors: [{ name: COMPANY.founder }],
  creator: COMPANY.name,
  publisher: COMPANY.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_ZW",
    siteName: "WD Logistics",
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${bricolage.variable} ${dmSans.variable} flex justify-center antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
