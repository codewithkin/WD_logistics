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
    default: "WD Logistics | Enterprise Fleet Management & Logistics Platform",
    template: "%s | WD Logistics",
  },
  description:
    "WD Logistics is an enterprise-grade fleet management platform designed for trucking companies. Streamline operations with AI-powered trip tracking, real-time driver management, comprehensive financial reporting, and intelligent logistics optimization.",
  keywords: [
    "fleet management software",
    "logistics platform",
    "trucking management",
    "transportation software",
    "driver management system",
    "trip tracking platform",
    "fleet operations",
    "logistics optimization",
    "expense management",
    "financial reporting",
    "freight management",
    "AI logistics",
    "vehicle tracking",
    "supply chain management",
  ],
  authors: [{ name: "WD Logistics" }],
  creator: "WD Logistics",
  publisher: "WD Logistics",
  applicationName: "WD Logistics",
  category: "Business",
  classification: "Fleet Management & Logistics",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://wdlogistics.com",
    siteName: "WD Logistics",
    title: "WD Logistics | Enterprise Fleet Management & Logistics Platform",
    description:
      "AI-powered fleet management platform for trucking companies. Optimize operations, track trips, manage drivers, and streamline financial reporting.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WD Logistics - Enterprise Fleet Management Platform",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@WDLogistics",
    creator: "@WDLogistics",
    title: "WD Logistics | Enterprise Fleet Management Platform",
    description:
      "AI-powered fleet management and logistics optimization for modern trucking companies.",
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
  verification: {
    google: "YOUR_GOOGLE_VERIFICATION_ID",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
