import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { PhotoBlock } from "@/components/PhotoBlock";
import { CtaFooterSimple } from "@/components/CtaFooter";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { COMPANY, DEFAULT_OG, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact WD Logistics | Freight Transport & Haulage Quotes in Zimbabwe",
  description:
    "Get a same-day freight quote from WD Logistics. Call or WhatsApp +263 77 450 8908, email operations@wd-logistics.co.zw, or visit our yard at 1 Tameside Close, Nyakamete, Mutare, Zimbabwe.",
  alternates: { canonical: "/contact" },
  openGraph: {
    ...DEFAULT_OG,
    url: `${SITE_URL}/contact`,
    title: "Contact WD Logistics | Freight Transport & Haulage Quotes in Zimbabwe",
    description:
      "Call or WhatsApp +263 77 450 8908 for a same-day freight quote, or visit our yard at 1 Tameside Close, Nyakamete, Mutare, Zimbabwe.",
  },
};

export default function ContactPage() {
  return (
    <div className="w-[1320px] max-w-full bg-[#FBFCFB] text-[#1E2320]">
      <Header />

      <div className="grid grid-cols-1 items-start gap-8 px-5 pb-12 pt-10 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-[34px] lg:px-[34px] lg:pb-[70px] lg:pt-14">
        <Reveal x={-24} y={0} className="flex flex-col gap-4 lg:gap-[18px]">
          <span className="w-fit rounded-full bg-[#EFF8E5] px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
            CONTACT US
          </span>
          <h1 className="m-0 max-w-full font-heading text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-[46px] lg:max-w-[16ch] lg:text-[58px] lg:leading-none lg:tracking-[-0.035em]">
            Let&apos;s get it <span className="italic text-[#3D8A14]">on the road</span>
          </h1>
          <p className="m-0 max-w-full font-sans text-sm leading-[1.7] text-[#646B65] text-balance sm:text-base lg:max-w-[38ch]">
            Fill in as much as you know — only your name and number are
            required. If you have the load details handy, add them and
            we&apos;ll come back with a price instead of questions.
          </p>

          <StaggerGroup className="flex flex-col gap-3 pt-1.5" stagger={0.07}>
            <StaggerItem y={14} className="flex items-center gap-4 rounded-[26px] bg-[#63C32E] px-6 py-[22px] text-[#15250A] transition-transform duration-300 hover:-translate-y-1">
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
            </StaggerItem>
            <StaggerItem y={14} className="flex items-center gap-4 rounded-[26px] border border-[#E6E9E2] bg-white px-6 py-[22px] transition-transform duration-300 hover:-translate-y-1">
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
            </StaggerItem>
            <StaggerItem y={14} className="flex items-center gap-4 rounded-[26px] border border-[#E6E9E2] bg-white px-6 py-[22px] transition-transform duration-300 hover:-translate-y-1">
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
            </StaggerItem>
            <StaggerItem y={14} className="flex items-center justify-between gap-4 rounded-[26px] bg-[#F3F4F0] px-6 py-5">
              <span className="font-sans text-sm font-medium leading-[1.4] text-[#4A5149]">
                Office hours
              </span>
              <span className="text-right font-sans text-sm font-semibold leading-[1.4]">
                Mon–Fri 07:00–18:00
                <br />
                Sat 08:00–13:00
              </span>
            </StaggerItem>
            <StaggerItem y={14} className="flex items-center gap-3 rounded-[26px] bg-[#1E2320] px-6 py-[18px] text-white">
              <span className="h-[9px] w-[9px] rounded-full bg-[#8FD94F]" />
              <span className="font-sans text-sm font-medium leading-[1.4] text-[#CFD5CB]">
                Dispatch line answers 24/7 for loads already on the road
              </span>
            </StaggerItem>
          </StaggerGroup>
        </Reveal>

        <Reveal x={24} y={0} delay={0.1}>
          <EnquiryForm />
        </Reveal>
      </div>

      <Reveal className="px-5 pb-12 sm:px-8 lg:px-[34px] lg:pb-[70px]">
        <PhotoBlock
          src="/images/yard-under-shed.jpg"
          alt="The WD Logistics yard and workshop at Nyakamete, Mutare"
          className="h-[220px] rounded-[28px] sm:h-[300px] sm:rounded-[36px]"
        >
          <a
            href="https://www.google.com/maps/search/?api=1&query=Nyakamete+Mutare+Zimbabwe"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 rounded-full bg-[#1E2320] px-[22px] py-3.5 font-sans text-[13px] font-bold text-white transition-transform duration-200 hover:scale-[1.05] active:scale-[0.98] sm:bottom-6 sm:right-6"
          >
            Open in Maps →
          </a>
        </PhotoBlock>
      </Reveal>

      <Reveal y={32}>
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
      </Reveal>
    </div>
  );
}
