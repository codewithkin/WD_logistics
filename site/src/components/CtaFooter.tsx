import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY } from "@/lib/site";

type FooterColumn = {
  title: string;
  links: { label: string; href: string }[];
};

const LogoBadge = () => (
  <span className="inline-flex self-start rounded-[20px] bg-white p-3">
    <Image
      src="/images/logo.jpg"
      alt="WD Logistics"
      width={532}
      height={296}
      className="h-10 w-auto"
    />
  </span>
);

const PrimaryButtons = ({
  secondaryLabel,
  secondaryHref,
}: {
  secondaryLabel: string;
  secondaryHref: string;
}) => (
  <div className="flex items-center gap-2.5">
    <a
      href={COMPANY.whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full bg-white px-7 py-[17px] font-sans text-[15px] font-bold text-[#1E2320]"
    >
      WhatsApp {COMPANY.whatsapp}
    </a>
    <Link
      href={secondaryHref}
      className="rounded-full border border-[#15250A]/35 px-7 py-[17px] font-sans text-[15px] font-semibold text-[#15250A]"
    >
      {secondaryLabel}
    </Link>
  </div>
);

export function CtaFooterFull({
  heading,
  columns,
}: {
  heading: ReactNode;
  columns: FooterColumn[];
}) {
  return (
    <section className="px-5 pb-5">
      <div className="flex flex-col gap-[52px] rounded-[48px] bg-[#63C32E] px-[46px] pb-10 pt-[60px] text-[#15250A]">
        <div className="flex flex-wrap items-end justify-between gap-12">
          <h2 className="m-0 max-w-[24ch] font-heading text-[52px] font-semibold leading-[1.02] tracking-[-0.03em] text-balance">
            {heading}
          </h2>
          <PrimaryButtons secondaryLabel="Contact us" secondaryHref="/contact" />
        </div>

        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-10 border-t border-[#15250A]/[.22] pt-10">
          <div className="flex flex-col gap-4">
            <LogoBadge />
            <p className="m-0 max-w-[32ch] font-sans text-sm leading-[1.7] text-[#15250A]/[.78] text-balance">
              {COMPANY.address}
              <br />
              {COMPANY.whatsapp} · {COMPANY.office}
              <br />
              {COMPANY.email}
            </p>
          </div>
          {columns.map((col) => (
            <div
              key={col.title}
              className="flex flex-col gap-3 font-sans text-sm text-[#15250A]/[.78]"
            >
              <span className="pb-1 font-sans text-xs font-bold tracking-[0.12em] text-[#15250A]">
                {col.title}
              </span>
              {col.links.map((link) =>
                link.href.startsWith("#") || link.href.startsWith("/") ? (
                  <Link key={link.label} href={link.href} className="text-[#15250A]/[.78]">
                    {link.label}
                  </Link>
                ) : (
                  <span key={link.label}>{link.label}</span>
                ),
              )}
            </div>
          ))}
        </div>

        <div className="flex items-end justify-between gap-6">
          <span className="font-heading text-[118px] font-bold leading-[0.82] tracking-[-0.05em] text-[#15250A]">
            WD&nbsp;LOGISTICS
          </span>
          <span className="shrink-0 text-right font-sans text-[13px] leading-[1.5] text-[#15250A]/[.78]">
            © {COMPANY.year} {COMPANY.name}
            <br />
            {COMPANY.domain} · Harare, Zimbabwe
          </span>
        </div>
      </div>
    </section>
  );
}

export function CtaFooterSimple({
  heading,
  secondaryLabel,
  secondaryHref,
  bottomText,
}: {
  heading: ReactNode;
  secondaryLabel: string;
  secondaryHref: string;
  bottomText: ReactNode;
}) {
  return (
    <section className="px-5 pb-5">
      <div className="flex flex-col gap-11 rounded-[48px] bg-[#63C32E] px-[46px] pb-10 pt-14 text-[#15250A]">
        <div className="flex flex-wrap items-end justify-between gap-12">
          <h2 className="m-0 max-w-[22ch] font-heading text-[48px] font-semibold leading-[1.04] tracking-[-0.03em] text-balance">
            {heading}
          </h2>
          <PrimaryButtons secondaryLabel={secondaryLabel} secondaryHref={secondaryHref} />
        </div>

        <div className="flex items-end justify-between gap-8 border-t border-[#15250A]/[.22] pt-[34px]">
          <LogoBadge />
          <span className="text-right font-sans text-[13px] leading-[1.6] text-[#15250A]/[.78]">
            {bottomText}
          </span>
        </div>
      </div>
    </section>
  );
}
