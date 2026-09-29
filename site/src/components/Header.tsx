"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COMPANY, NAV_LINKS } from "@/lib/site";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes it. The panel covers the page on a phone and the only way
  // out was to find the toggle again, which a keyboard user reaches last.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A route change leaves it open otherwise: every link in it closes it by
  // hand, so anything that navigates without one (the browser's back button,
  // a link added later that forgets the handler) strands the panel open over
  // the new page. Done during render rather than in an effect so the new page
  // never paints with the old page's menu over it.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

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
                // The green pill was the only sign of where you are. Sighted
                // only: nothing in the markup said it.
                aria-current={active ? "page" : undefined}
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
            aria-controls="site-menu"
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

      {/* Mobile menu panel.

          It is collapsed with grid-template-rows, so while closed it is a
          zero-height box with its links still in the document — tabbing from
          the toggle walked into three invisible links and the office number,
          and a screen reader read the whole menu out on every page. `inert`
          rather than `hidden` because hidden would drop the row out of the
          grid and take the open/close animation with it. */}
      <div
        id="site-menu"
        aria-hidden={!open}
        inert={!open}
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
                aria-current={active ? "page" : undefined}
                className={`rounded-2xl px-4 py-3 ${
                  active ? "bg-[#EFF8E5] text-[#1E2320]" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {/* "Contact us" is already in the list above — a second button with
              the same words under it read as two different destinations. The
              office number is the thing this panel was missing. */}
          <a
            href={COMPANY.officeHref}
            onClick={() => setOpen(false)}
            className="rounded-2xl border border-[#D3D6D0] px-4 py-3 text-center font-semibold text-[#333833]"
          >
            Call {COMPANY.office}
          </a>
        </div>
      </div>
    </div>
  );
}
