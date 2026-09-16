import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, DM_Sans } from "next/font/google";
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
  title: "WD Logistics — Zimbabwe road freight & haulage",
  description:
    "WD Logistics (Pvt) Ltd — road freight and haulage across Zimbabwe and the SADC region, based in Mutare. Full loads, part loads, bulk & tipper, and abnormal loads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${bricolageGrotesque.variable} ${dmSans.variable}`}
    >
      <body className="flex justify-center bg-[#EDEFEC] font-sans text-[#1E2320]">
        {children}
      </body>
    </html>
  );
}
