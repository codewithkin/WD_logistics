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
      className="h-9 w-auto sm:h-10"
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
  <div className="flex flex-wrap items-center gap-2.5">
    <a
      href={COMPANY.whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full bg-white px-5 py-3.5 font-sans text-sm font-bold text-[#1E2320] sm:px-7 sm:py-[17px] sm:text-[15px]"
    >
      WhatsApp {COMPANY.whatsapp}
    </a>
    <Link
      href={secondaryHref}
      className="rounded-full border border-[#15250A]/35 px-5 py-3.5 font-sans text-sm font-semibold text-[#15250A] sm:px-7 sm:py-[17px] sm:text-[15px]"
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
      <div className="flex flex-col gap-10 rounded-[32px] bg-[#63C32E] px-6 pb-8 pt-10 text-[#15250A] sm:rounded-[40px] sm:px-9 lg:gap-[52px] lg:rounded-[48px] lg:px-[46px] lg:pb-10 lg:pt-[60px]">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-12">
          <h2 className="m-0 max-w-full font-heading text-[30px] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[40px] lg:max-w-[24ch] lg:text-[52px] lg:leading-[1.02] lg:tracking-[-0.03em]">
            {heading}
          </h2>
          <PrimaryButtons secondaryLabel="Contact us" secondaryHref="/contact" />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-[#15250A]/[.22] pt-8 sm:grid-cols-4 sm:gap-10 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:pt-10">
          <div className="col-span-2 flex flex-col gap-4 sm:col-span-4 lg:col-span-1">
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

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <span className="max-w-full font-heading text-[8vw] font-bold leading-[0.82] tracking-[-0.04em] text-[#15250A] sm:text-[64px] lg:text-[118px] lg:tracking-[-0.05em]">
            WD&nbsp;LOGISTICS
          </span>
          <span className="shrink-0 text-left font-sans text-xs leading-[1.5] text-[#15250A]/[.78] sm:text-right sm:text-[13px]">
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
      <div className="flex flex-col gap-8 rounded-[32px] bg-[#63C32E] px-6 pb-8 pt-9 text-[#15250A] sm:rounded-[40px] sm:px-9 lg:gap-11 lg:rounded-[48px] lg:px-[46px] lg:pb-10 lg:pt-14">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-12">
          <h2 className="m-0 max-w-full font-heading text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-balance sm:text-[36px] lg:max-w-[22ch] lg:text-[48px] lg:leading-[1.04] lg:tracking-[-0.03em]">
            {heading}
          </h2>
          <PrimaryButtons secondaryLabel={secondaryLabel} secondaryHref={secondaryHref} />
        </div>

        <div className="flex flex-col items-start gap-6 border-t border-[#15250A]/[.22] pt-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8 lg:pt-[34px]">
          <LogoBadge />
          <span className="text-left font-sans text-[13px] leading-[1.6] text-[#15250A]/[.78] sm:text-right">
            {bottomText}
          </span>
        </div>
      </div>
    </section>
  );
}
