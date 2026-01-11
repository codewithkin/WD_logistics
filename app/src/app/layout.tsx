import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WD Logistics | Fleet Management & Transportation Solutions",
    template: "%s | WD Logistics",
  },
  description:
    "WD Logistics provides comprehensive fleet management, transportation, and logistics solutions. Track trips, manage drivers, handle invoices, and optimize your logistics operations with our all-in-one platform.",
  keywords: [
    "logistics",
    "fleet management",
    "transportation",
    "trucking",
    "freight",
    "delivery management",
    "driver management",
    "trip tracking",
    "invoice management",
    "supply chain",
  ],
  authors: [{ name: "WD Logistics" }],
  creator: "WD Logistics",
  publisher: "WD Logistics",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://wdlogistics.com",
    siteName: "WD Logistics",
    title: "WD Logistics | Fleet Management & Transportation Solutions",
    description:
      "Comprehensive fleet management, transportation, and logistics solutions. Optimize your operations with our all-in-one platform.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WD Logistics - Fleet Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WD Logistics | Fleet Management & Transportation Solutions",
    description:
      "Comprehensive fleet management, transportation, and logistics solutions.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
