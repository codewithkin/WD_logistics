import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: "WD Logistics — Road Freight, Zimbabwe & SADC",
    template: "%s — WD Logistics",
  },
  description:
    "WD Logistics runs short and long distance road freight from our Mutare base — across Zimbabwe and into the SADC region. Full loads, part loads and bulk, on satellite-tracked trucks.",
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
