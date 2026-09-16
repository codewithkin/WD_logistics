"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY, NAV_LINKS } from "@/lib/site";

export function Header() {
  const pathname = usePathname();

  return (
    <div className="px-[34px] pt-[26px]">
      <div className="flex items-center justify-between gap-7 rounded-full border border-[#E5E7E1] bg-white py-3 pl-5 pr-3.5 shadow-[0_10px_30px_rgba(16,24,20,.06)]">
        <Link href="/" className="block shrink-0">
          <Image
            src="/images/logo.jpg"
            alt="WD Logistics"
            width={532}
            height={296}
            priority
            className="h-[42px] w-auto"
          />
        </Link>

        <nav className="flex items-center gap-2 font-sans text-sm font-medium text-[#4A5149]">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2.5 ${
                  active ? "bg-[#EFF8E5] text-[#1E2320]" : "hover:text-[#1E2320]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          {pathname === "/contact" ? (
            <a
              href={COMPANY.emailHref}
              className="rounded-full border border-[#D3D6D0] px-[18px] py-3 font-sans text-[13px] font-medium text-[#333833]"
            >
              {COMPANY.email}
            </a>
          ) : (
            <Link
              href="/contact"
              className="rounded-full border border-[#D3D6D0] px-[18px] py-3 font-sans text-[13px] font-medium text-[#333833]"
            >
              Contact us
            </Link>
          )}
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#63C32E] px-5 py-3 font-sans text-[13px] font-bold text-[#15250A]"
          >
            WhatsApp →
          </a>
        </div>
      </div>
    </div>
  );
}
