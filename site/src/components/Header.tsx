"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { COMPANY, NAV_LINKS } from "@/lib/site";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-5 pt-5 sm:px-8 lg:px-[34px] lg:pt-[26px]">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-[#E5E7E1] bg-white py-3 pl-4 pr-3 shadow-[0_10px_30px_rgba(16,24,20,.06)] lg:gap-7 lg:rounded-full lg:py-3 lg:pl-5 lg:pr-3.5">
        <Link href="/" className="block shrink-0" onClick={() => setOpen(false)}>
          <Image
            src="/images/logo.jpg"
            alt="WD Logistics"
            width={532}
            height={296}
            priority
            className="h-9 w-auto lg:h-[42px]"
          />
        </Link>

        <nav className="hidden items-center gap-2 font-sans text-sm font-medium text-[#4A5149] lg:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2.5 transition-colors ${
                  active ? "bg-[#EFF8E5] text-[#1E2320]" : "hover:text-[#1E2320]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          {pathname === "/contact" ? (
            <a
              href={COMPANY.emailHref}
              className="rounded-full border border-[#D3D6D0] px-[18px] py-3 font-sans text-[13px] font-medium text-[#333833] transition-colors hover:border-[#1E2320]"
            >
              {COMPANY.email}
            </a>
          ) : (
            <Link
              href="/contact"
              className="rounded-full border border-[#D3D6D0] px-[18px] py-3 font-sans text-[13px] font-medium text-[#333833] transition-colors hover:border-[#1E2320]"
            >
              Contact us
            </Link>
          )}
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#63C32E] px-5 py-3 font-sans text-[13px] font-bold text-[#15250A] transition-transform hover:scale-[1.04]"
          >
            WhatsApp →
          </a>
        </div>

        {/* Mobile: WhatsApp quick action + menu toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#63C32E] px-4 py-2.5 font-sans text-xs font-bold text-[#15250A]"
          >
            WhatsApp →
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-[#E5E7E1]"
          >
            <span
              className={`h-[2px] w-4 bg-[#1E2320] transition-transform ${
                open ? "translate-y-[3.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-[2px] w-4 bg-[#1E2320] transition-transform ${
                open ? "-translate-y-[3.5px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out lg:hidden ${
          open ? "grid-rows-[1fr] pt-3" : "grid-rows-[0fr]"
        }`}
      >
        <div className="flex min-h-0 flex-col gap-2 rounded-[24px] border border-[#E5E7E1] bg-white p-3 font-sans text-sm font-medium text-[#4A5149] shadow-[0_10px_30px_rgba(16,24,20,.06)]">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-2xl px-4 py-3 ${
                  active ? "bg-[#EFF8E5] text-[#1E2320]" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="rounded-2xl border border-[#D3D6D0] px-4 py-3 text-center font-semibold text-[#333833]"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
