import Image from "next/image";
import Link from "next/link";
import { COMPANY, NAV_LINKS } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="bg-(--color-surface) px-5 pt-10 pb-6 sm:px-8 lg:px-12 lg:pt-11">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3.5">
          <Image
            src="/logo.jpg"
            alt="WD Logistics logo"
            width={200}
            height={111}
            className="block h-[38px] w-auto self-start"
          />
          <p className="m-0 max-w-[32ch] font-sans text-sm leading-[1.65] text-(--color-muted)">
            {COMPANY.addressFull}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 font-sans text-sm text-(--color-muted)">
          <span className="pb-1 font-mono text-xs font-semibold tracking-[0.12em] text-(--color-ink)">
            PAGES
          </span>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-(--color-muted) hover:text-(--color-ink)">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 font-sans text-sm text-(--color-muted)">
          <span className="pb-1 font-mono text-xs font-semibold tracking-[0.12em] text-(--color-ink)">
            ON THIS PAGE
          </span>
          <Link href="/#services" className="text-(--color-muted) hover:text-(--color-ink)">
            Full loads
          </Link>
          <Link href="/#services" className="text-(--color-muted) hover:text-(--color-ink)">
            Part loads
          </Link>
          <Link href="/#services" className="text-(--color-muted) hover:text-(--color-ink)">
            Bulk &amp; tipper
          </Link>
          <Link href="/#why" className="text-(--color-muted) hover:text-(--color-ink)">
            Why WD
          </Link>
        </div>

        <div className="flex flex-col gap-2.5 font-sans text-sm text-(--color-muted)">
          <span className="pb-1 font-mono text-xs font-semibold tracking-[0.12em] text-(--color-ink)">
            GET IN TOUCH
          </span>
          <span>{COMPANY.whatsapp} (WhatsApp)</span>
          <span>{COMPANY.office} (office)</span>
          <span>{COMPANY.email}</span>
          {COMPANY.hours.map((h) => (
            <span key={h.label}>
              {h.label} {h.value}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-6 border-t border-(--color-border) pt-5 font-sans text-[13px] text-(--color-faint)">
        <span>© 2026 {COMPANY.name}. Mutare, Zimbabwe.</span>
        <span>wd-logistics.co.zw</span>
      </div>
    </footer>
  );
}
