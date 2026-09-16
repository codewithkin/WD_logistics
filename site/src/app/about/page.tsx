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
      <div className="grid grid-cols-[1.1fr_0.9fr] items-end gap-[34px] px-[34px] pb-11 pt-14">
        <div className="flex flex-col gap-[22px]">
          <span className="w-fit rounded-full bg-[#EFF8E5] px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
            ABOUT WD LOGISTICS
          </span>
          <h1 className="m-0 max-w-[20ch] font-heading text-[66px] font-semibold leading-none tracking-[-0.035em] text-balance">
            A haulage company built on{" "}
            <span className="italic text-[#3D8A14]">kept promises</span>
          </h1>
          <p className="m-0 max-w-[52ch] font-sans text-[17px] leading-[1.7] text-[#646B65] text-balance">
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
          className="flex h-[400px] items-end rounded-[36px] p-6"
        />
      </div>

      {/* Photo grid */}
      <div className="px-[34px] pb-[70px]">
        <div className="grid grid-cols-4 auto-rows-[220px] gap-[18px]">
          <PhotoPlaceholder
            variant="card"
            label="PHOTO — LOADING BAY, GRANITESIDE"
            className="col-span-2 row-span-2 flex items-end rounded-[32px] p-6"
          />
          <PhotoPlaceholder
            variant="card"
            label="TARPING A LOAD"
            className="flex items-end rounded-[32px] p-[22px]"
            labelClassName="text-[10px] px-[13px] py-2"
          />
          <div className="flex flex-col justify-between rounded-[32px] bg-[#63C32E] p-[26px] text-[#15250A]">
            <span className="font-mono text-[11px] font-semibold tracking-[0.12em]">
              ON THE ROAD
            </span>
            <span className="font-sans text-[15px] leading-[1.55] text-balance">
              Every trip is planned the night before — route, weighbridge
              stops, fuel and a back-up driver.
            </span>
          </div>
          <PhotoPlaceholder
            variant="card"
            label="PHOTO — TIPPER OFFLOADING AT SITE"
            className="col-span-2 flex items-end rounded-[32px] p-[22px]"
            labelClassName="text-[10px] px-[13px] py-2"
          />
        </div>
      </div>

      {/* Founder quote */}
      <div className="bg-[#EFF8E5] px-[34px] py-[70px]">
        <div className="grid grid-cols-[0.85fr_1.15fr] items-center gap-10">
          <PhotoPlaceholder
            variant="tint"
            label="PHOTO — TRUCK CAB, ROAD AHEAD"
            className="flex h-[440px] items-end rounded-[36px] p-6"
          />
          <div className="flex flex-col gap-[26px]">
            <span className="w-fit rounded-full bg-white px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
              FROM THE FOUNDER
            </span>
            <p className="m-0 max-w-[40ch] font-heading text-[38px] font-semibold leading-[1.22] tracking-[-0.025em] text-balance">
              &ldquo;I grew up watching goods sit in yards because someone
              didn&apos;t phone back. WD exists so that never happens to a
              Zimbabwean business again.&rdquo;
            </p>
            <p className="m-0 max-w-[52ch] font-sans text-base leading-[1.7] text-[#4A5149] text-balance">
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
      <div className="px-[34px] py-[70px]">
        <h2 className="m-0 mb-[34px] max-w-[24ch] font-heading text-[46px] font-semibold leading-[1.04] tracking-[-0.03em] text-balance">
          How we work, in four sentences
        </h2>
        <div className="grid grid-cols-4 gap-[18px]">
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
