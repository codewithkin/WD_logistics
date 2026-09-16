import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { CtaFooterSimple } from "@/components/CtaFooter";
import { EnquiryForm } from "@/components/EnquiryForm";
import { COMPANY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us — WD Logistics",
};

export default function ContactPage() {
  return (
    <div className="w-[1320px] max-w-full bg-[#FBFCFB] text-[#1E2320]">
      <Header />

      <div className="grid grid-cols-[0.82fr_1.18fr] items-start gap-[34px] px-[34px] pb-[70px] pt-14">
        <div className="flex flex-col gap-[18px]">
          <span className="w-fit rounded-full bg-[#EFF8E5] px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
            CONTACT US
          </span>
          <h1 className="m-0 max-w-[16ch] font-heading text-[58px] font-semibold leading-none tracking-[-0.035em] text-balance">
            Let&apos;s get it <span className="italic text-[#3D8A14]">on the road</span>
          </h1>
          <p className="m-0 max-w-[38ch] font-sans text-base leading-[1.7] text-[#646B65] text-balance">
            Fill in as much as you know — only your name and number are
            required. If you have the load details handy, add them and
            we&apos;ll come back with a price instead of questions.
          </p>

          <div className="flex flex-col gap-3 pt-1.5">
            <div className="flex items-center gap-4 rounded-[26px] bg-[#63C32E] px-6 py-[22px] text-[#15250A]">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-white/70 font-sans text-lg font-semibold">
                ✆
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-sans text-xs font-semibold tracking-[0.1em]">
                  CALL OR WHATSAPP
                </span>
                <span className="font-heading text-xl font-bold tracking-[-0.02em]">
                  {COMPANY.whatsapp}
                </span>
                <span className="font-sans text-[13px] font-medium">
                  Office: {COMPANY.office}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-[26px] border border-[#E6E9E2] bg-white px-6 py-[22px]">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#EFF8E5] font-sans text-lg font-semibold text-[#3D8A14]">
                ✉
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-sans text-xs font-semibold tracking-[0.1em] text-[#646B65]">
                  EMAIL
                </span>
                <span className="font-sans text-[17px] font-semibold">
                  {COMPANY.email}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-[26px] border border-[#E6E9E2] bg-white px-6 py-[22px]">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#EFF8E5] font-sans text-lg font-semibold text-[#1667C4]">
                ⌖
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-sans text-xs font-semibold tracking-[0.1em] text-[#646B65]">
                  YARD &amp; OFFICE
                </span>
                <span className="font-sans text-base font-semibold leading-[1.4]">
                  1 Tameside Close,
                  <br />
                  Nyakamete, Mutare
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[26px] bg-[#F3F4F0] px-6 py-5">
              <span className="font-sans text-sm font-medium leading-[1.4] text-[#4A5149]">
                Office hours
              </span>
              <span className="text-right font-sans text-sm font-semibold leading-[1.4]">
                Mon–Fri 07:00–18:00
                <br />
                Sat 08:00–13:00
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-[26px] bg-[#1E2320] px-6 py-[18px] text-white">
              <span className="h-[9px] w-[9px] rounded-full bg-[#8FD94F]" />
              <span className="font-sans text-sm font-medium leading-[1.4] text-[#CFD5CB]">
                Dispatch line answers 24/7 for loads already on the road
              </span>
            </div>
          </div>
        </div>

        <EnquiryForm />
      </div>

      <div className="px-[34px] pb-[70px]">
        <PhotoPlaceholder
          variant="neutral"
          label="MAP — NYAKAMETE, MUTARE"
          className="flex h-[300px] items-end justify-between gap-5 rounded-[36px] p-6"
        >
          <a
            href="https://www.google.com/maps/search/?api=1&query=Nyakamete+Mutare+Zimbabwe"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#1E2320] px-[22px] py-3.5 font-sans text-[13px] font-bold text-white"
          >
            Open in Maps →
          </a>
        </PhotoPlaceholder>
      </div>

      <CtaFooterSimple
        heading="Rather just talk? The dispatcher is on the line."
        secondaryLabel="Call the yard"
        secondaryHref={COMPANY.officeHref}
        bottomText={
          <>
            Home · About · Contact us
            <br />© {COMPANY.year} {COMPANY.name} · {COMPANY.domain}
          </>
        }
      />
    </div>
  );
}
