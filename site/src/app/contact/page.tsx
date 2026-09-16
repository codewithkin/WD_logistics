import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { CtaBanner } from "@/components/CtaBanner";
import { EnquiryForm } from "@/components/EnquiryForm";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Tell WD Logistics the load and the route on WhatsApp, phone or the enquiry form and we'll come back with a price the same day.",
};

export default function ContactPage() {
  return (
    <PageShell>
      <div className="grid grid-cols-1 items-start gap-12 px-12 pt-16 pb-16 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="flex flex-col gap-4">
          <span className="font-sans text-xs font-semibold tracking-[0.14em] text-(--color-brand)">
            CONTACT US
          </span>
          <h1 className="m-0 max-w-[16ch] font-sans text-[40px] leading-[1.1] font-semibold tracking-[-0.02em]">
            Let&apos;s get it on the road.
          </h1>
          <p className="m-0 max-w-[38ch] text-balance font-sans text-base leading-[1.7] text-(--color-muted)">
            Fill in as much as you know — only your name and number are required. If you have the
            load details handy, add them and we&apos;ll come back with a price instead of
            questions.
          </p>

          <div className="mt-2 flex flex-col gap-3">
            <a
              href={COMPANY.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-[6px] bg-(--color-accent) px-6 py-[22px] text-(--color-accent-ink)"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-white/70 font-sans text-lg font-semibold">
                ✆
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-sans text-xs font-semibold tracking-[0.1em]">
                  CALL OR WHATSAPP
                </span>
                <span className="font-sans text-xl leading-none font-bold tracking-[-0.02em]">
                  {COMPANY.whatsapp}
                </span>
                <span className="font-sans text-[13px] font-medium">
                  Office: {COMPANY.office}
                </span>
              </span>
            </a>

            <a
              href={`mailto:${COMPANY.email}`}
              className="flex items-center gap-4 rounded-[6px] border border-(--color-border) bg-(--color-surface) px-6 py-[22px]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-(--color-surface-muted) font-sans text-lg font-semibold text-(--color-brand)">
                ✉
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-sans text-xs font-semibold tracking-[0.1em] text-(--color-muted)">
                  EMAIL
                </span>
                <span className="font-sans text-[17px] font-semibold text-(--color-ink)">
                  {COMPANY.email}
                </span>
              </span>
            </a>

            <div className="flex items-center gap-4 rounded-[6px] border border-(--color-border) bg-(--color-surface) px-6 py-[22px]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-(--color-surface-muted) font-sans text-lg font-semibold text-[#1667c4]">
                ⌖
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-sans text-xs font-semibold tracking-[0.1em] text-(--color-muted)">
                  YARD &amp; OFFICE
                </span>
                <span className="font-sans text-[16px] leading-[1.4] font-semibold text-(--color-ink)">
                  {COMPANY.address}
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[6px] bg-(--color-surface-muted) px-6 py-5">
              <span className="font-sans text-sm font-medium text-(--color-body)">
                Office hours
              </span>
              <span className="text-right font-sans text-sm leading-[1.4] font-semibold text-(--color-ink)">
                {COMPANY.hours.map((h) => (
                  <span key={h.label} className="block">
                    {h.label} {h.value}
                  </span>
                ))}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-[6px] bg-(--color-ink) px-6 py-4.5 text-white">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-accent)" />
              <span className="font-sans text-sm leading-[1.4] font-medium text-[#cfd5cb]">
                Dispatch line answers 24/7 for loads already on the road
              </span>
            </div>
          </div>
        </div>

        <EnquiryForm />
      </div>

      {/* Map */}
      <div className="px-12 pb-16">
        <div className="photo-placeholder flex h-[280px] items-end justify-between gap-5 rounded-[6px] p-5">
          <span className="rounded-[4px] bg-(--color-surface) px-3 py-2 font-mono text-[11px] leading-none tracking-[0.08em] text-(--color-label)">
            MAP — NYAKAMETE, MUTARE
          </span>
          <a
            href="https://www.google.com/maps/search/?api=1&query=1+Tameside+Close+Nyakamete+Mutare+Zimbabwe"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[4px] bg-(--color-ink) px-[22px] py-3.5 font-sans text-[13px] font-semibold text-white hover:text-white"
          >
            Open in Maps
          </a>
        </div>
      </div>

      {/* CTA */}
      <CtaBanner
        heading="Rather just talk? The dispatcher is on the line."
        description={`${COMPANY.whatsapp} · ${COMPANY.office}`}
        secondaryLabel="Call the yard"
        secondaryHref={`tel:${COMPANY.office.replace(/\s+/g, "")}`}
      />
    </PageShell>
  );
}
