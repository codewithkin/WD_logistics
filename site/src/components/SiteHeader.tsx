"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { COMPANY, NAV_LINKS } from "@/lib/constants";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative border-b border-(--color-border)">
      <div className="flex items-center justify-between gap-6 px-5 py-4 sm:px-8 sm:py-5 lg:gap-10 lg:px-12">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="WD Logistics home"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/logo.jpg"
            alt="WD Logistics"
            width={200}
            height={111}
            priority
            className="block h-9 w-auto sm:h-11"
          />
        </Link>

        <nav className="hidden items-center gap-8 font-sans text-sm font-medium text-(--color-body) lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive ? "text-(--color-brand)" : "text-(--color-body) hover:text-(--color-ink)"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
          <Link
            href="/contact"
            className="rounded-[4px] border border-(--color-border-strong) px-[18px] py-[11px] font-sans text-[13px] font-medium text-(--color-ink-soft) transition-colors hover:text-(--color-ink)"
          >
            Contact us
          </Link>
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta rounded-[4px] bg-(--color-accent) px-[18px] py-[11px] font-sans text-[13px] font-semibold text-(--color-accent-ink) hover:text-(--color-accent-ink)"
          >
            WhatsApp
          </a>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[4px] border border-(--color-border-strong) lg:hidden"
        >
          <span
            className={`block h-[1.5px] w-5 bg-(--color-ink) transition-transform ${
              menuOpen ? "translate-y-[6.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-[1.5px] w-5 bg-(--color-ink) transition-opacity ${
              menuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`block h-[1.5px] w-5 bg-(--color-ink) transition-transform ${
              menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full z-20 flex flex-col gap-1 border-b border-(--color-border) bg-(--color-surface) px-5 py-4 shadow-lg sm:px-8 lg:hidden">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-[4px] px-3 py-3 font-sans text-[15px] font-medium ${
                  isActive
                    ? "bg-(--color-surface-muted) text-(--color-brand)"
                    : "text-(--color-body)"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mt-2 flex items-center gap-2.5 border-t border-(--color-border) pt-4">
            <Link
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="flex-1 rounded-[4px] border border-(--color-border-strong) px-[18px] py-3 text-center font-sans text-[13px] font-medium text-(--color-ink-soft)"
            >
              Contact us
            </Link>
            <a
              href={COMPANY.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-[4px] bg-(--color-accent) px-[18px] py-3 text-center font-sans text-[13px] font-semibold text-(--color-accent-ink)"
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
