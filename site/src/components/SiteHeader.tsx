"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY, NAV_LINKS } from "@/lib/constants";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between gap-10 border-b border-(--color-border) px-12 py-5">
      <Link href="/" className="flex shrink-0 items-center" aria-label="WD Logistics home">
        <Image
          src="/logo.jpg"
          alt="WD Logistics"
          width={200}
          height={111}
          priority
          className="block h-11 w-auto"
        />
      </Link>

      <nav className="flex items-center gap-8 font-sans text-sm font-medium text-(--color-body)">
        {NAV_LINKS.map((link) => {
          const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? "text-(--color-brand)" : "text-(--color-body) hover:text-(--color-ink)"}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5">
        <Link
          href="/contact"
          className="rounded-[4px] border border-(--color-border-strong) px-[18px] py-[11px] font-sans text-[13px] font-medium text-(--color-ink-soft) hover:text-(--color-ink)"
        >
          Contact us
        </Link>
        <a
          href={COMPANY.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[4px] bg-(--color-accent) px-[18px] py-[11px] font-sans text-[13px] font-semibold text-(--color-accent-ink) hover:text-(--color-accent-ink)"
        >
          WhatsApp
        </a>
      </div>
    </header>
  );
}
