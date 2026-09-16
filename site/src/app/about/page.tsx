import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { CtaFooterSimple } from "@/components/CtaFooter";
import { COMPANY } from "@/lib/site";

export const metadata: Metadata = {
  title: "About — WD Logistics",
};

const PRINCIPLES = [
  {
    label: "HONESTY",
    labelColor: "text-[#3D8A14]",
    body: "If a truck is running late you hear it from us first, with a new time.",
    bg: "bg-white border border-[#E6E9E2]",
    text: "text-[#333833]",
  },
  {
    label: "CARE",
    labelColor: "text-[#3D8A14]",
    body: "Loads are strapped and tarped by the same crew that will offload them.",
    bg: "bg-white border border-[#E6E9E2]",
    text: "text-[#333833]",
  },
  {
    label: "DISCIPLINE",
    labelColor: "text-[#8FD94F]",
    body: "Services every 15,000km in our own workshop — not when something breaks.",
    bg: "bg-[#1E2320]",
    text: "text-[#CFD5CB]",
  },
  {
    label: "LOCAL",
    labelColor: "text-[#3D8A14]",
    body: "Mutare-based, Zimbabwean drivers, and cross-border runs we have done for years.",
    bg: "bg-white border border-[#E6E9E2]",
    text: "text-[#333833]",
  },
];

export default function AboutPage() {
  return (
    <div className="w-[1320px] max-w-full bg-[#FBFCFB] text-[#1E2320]">
      <Header />

      {/* Intro */}
      <div className="grid grid-cols-1 items-start gap-8 px-5 pb-8 pt-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-[34px] lg:px-[34px] lg:pb-11 lg:pt-14">
        <div className="flex flex-col gap-4 lg:gap-[22px]">
          <span className="w-fit rounded-full bg-[#EFF8E5] px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
            ABOUT WD LOGISTICS
          </span>
          <h1 className="m-0 max-w-full font-heading text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-balance sm:text-[48px] lg:max-w-[20ch] lg:text-[66px] lg:leading-none lg:tracking-[-0.035em]">
            A haulage company built on{" "}
            <span className="italic text-[#3D8A14]">kept promises</span>
          </h1>
          <p className="m-0 max-w-full font-sans text-[15px] leading-[1.7] text-[#646B65] text-balance sm:text-[17px] lg:max-w-[52ch]">
            We started with one truck on the Mutare–Harare run and a simple
            rule: if we say it will be there Thursday, it is there Thursday.
            Twelve trucks later, the rule hasn&apos;t moved.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <span className="rounded-full border border-[#E6E9E2] bg-white px-5 py-3.5 font-sans text-sm font-semibold">
              12 trucks
            </span>
            <span className="rounded-full border border-[#E6E9E2] bg-white px-5 py-3.5 font-sans text-sm font-semibold">
              10 provinces
            </span>
            <span className="rounded-full border border-[#E6E9E2] bg-white px-5 py-3.5 font-sans text-sm font-semibold">
              4,100+ loads
            </span>
            <span className="rounded-full bg-[#63C32E] px-5 py-3.5 font-sans text-sm font-semibold text-[#15250A]">
              Zimbabwe &amp; SADC
            </span>
          </div>
        </div>
        <PhotoPlaceholder
          variant="neutral"
          label="PHOTO — FLEET LINED UP AT THE YARD"
          className="flex h-[240px] items-end rounded-[28px] p-5 sm:h-[320px] sm:rounded-[36px] sm:p-6 lg:h-[400px]"
        />
      </div>

      {/* Photo grid */}
      <div className="px-5 pb-12 sm:px-8 lg:px-[34px] lg:pb-[70px]">
        <div className="grid grid-cols-2 auto-rows-[160px] gap-3 sm:auto-rows-[200px] sm:gap-4 lg:grid-cols-4 lg:auto-rows-[220px] lg:gap-[18px]">
          <PhotoPlaceholder
            variant="card"
            label="PHOTO — LOADING BAY, GRANITESIDE"
            className="col-span-2 row-span-2 flex items-end rounded-[24px] p-4 sm:rounded-[32px] sm:p-6"
          />
          <PhotoPlaceholder
            variant="card"
            label="TARPING A LOAD"
            className="flex items-end rounded-[24px] p-3 sm:rounded-[32px] sm:p-[22px]"
            labelClassName="text-[10px] px-[13px] py-2"
          />
          <div className="flex flex-col justify-between rounded-[24px] bg-[#63C32E] p-4 text-[#15250A] sm:rounded-[32px] sm:p-[26px]">
            <span className="font-mono text-[10px] font-semibold tracking-[0.12em] sm:text-[11px]">
              ON THE ROAD
            </span>
            <span className="font-sans text-sm leading-[1.5] text-balance sm:text-[15px] sm:leading-[1.55]">
              Every trip is planned the night before — route, weighbridge
              stops, fuel and a back-up driver.
            </span>
          </div>
          <PhotoPlaceholder
            variant="card"
            label="PHOTO — TIPPER OFFLOADING AT SITE"
            className="col-span-2 flex items-end rounded-[24px] p-3 sm:rounded-[32px] sm:p-[22px]"
            labelClassName="text-[10px] px-[13px] py-2"
          />
        </div>
      </div>

      {/* Founder quote */}
      <div className="bg-[#EFF8E5] px-5 py-12 sm:px-8 lg:px-[34px] lg:py-[70px]">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
          <PhotoPlaceholder
            variant="tint"
            label="PHOTO — TRUCK CAB, ROAD AHEAD"
            className="flex h-[260px] items-end rounded-[28px] p-5 sm:h-[360px] sm:rounded-[36px] sm:p-6 lg:h-[440px]"
          />
          <div className="flex flex-col gap-5 lg:gap-[26px]">
            <span className="w-fit rounded-full bg-white px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
              FROM THE FOUNDER
            </span>
            <p className="m-0 max-w-full font-heading text-2xl font-semibold leading-[1.28] tracking-[-0.015em] text-balance sm:text-[30px] lg:max-w-[40ch] lg:text-[38px] lg:leading-[1.22] lg:tracking-[-0.025em]">
              &ldquo;I grew up watching goods sit in yards because someone
              didn&apos;t phone back. WD exists so that never happens to a
              Zimbabwean business again.&rdquo;
            </p>
            <p className="m-0 max-w-full font-sans text-sm leading-[1.7] text-[#4A5149] text-balance sm:text-base lg:max-w-[52ch]">
              &ldquo;We are deliberately small enough that I still know every
              driver by name and every regular client&apos;s delivery window.
              When we grow, that is the thing we will protect.&rdquo;
            </p>
            <span className="flex flex-col gap-1 border-t border-[#1E2320]/[.14] pt-1.5">
              <span className="font-sans text-[17px] font-bold">
                W. Dziruni
              </span>
              <span className="font-sans text-sm text-[#646B65]">
                Founder, WD Logistics
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* How we work */}
      <div className="px-5 py-12 sm:px-8 lg:px-[34px] lg:py-[70px]">
        <h2 className="m-0 mb-6 max-w-full font-heading text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-balance sm:text-[36px] lg:mb-[34px] lg:max-w-[24ch] lg:text-[46px] lg:leading-[1.04] lg:tracking-[-0.03em]">
          How we work, in four sentences
        </h2>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div
              key={p.label}
              className={`flex flex-col gap-3.5 rounded-[28px] p-7 ${p.bg}`}
            >
              <span
                className={`font-mono text-xs font-semibold tracking-[0.12em] ${p.labelColor}`}
              >
                {p.label}
              </span>
              <span className={`font-sans text-base leading-[1.6] text-balance ${p.text}`}>
                {p.body}
              </span>
            </div>
          ))}
        </div>
      </div>

      <CtaFooterSimple
        heading="Got a load that needs moving this week?"
        secondaryLabel="Contact us"
        secondaryHref="/contact"
        bottomText={
          <>
            {COMPANY.address} · {COMPANY.email}
            <br />© {COMPANY.year} {COMPANY.name} · {COMPANY.domain}
          </>
        }
      />
    </div>
  );
}
