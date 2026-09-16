import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { CtaBanner } from "@/components/CtaBanner";

export const metadata: Metadata = {
  title: "About",
  description:
    "WD Logistics started with one truck on the Mutare–Harare run. Twelve trucks later, the rule hasn't moved: if we say Thursday, it's Thursday.",
};

const STATS = ["12 trucks", "10 provinces", "4,100+ loads", "Zimbabwe & SADC"];

const VALUES = [
  {
    label: "HONESTY",
    description: "If a truck is running late you hear it from us first, with a new time.",
    dark: false,
  },
  {
    label: "CARE",
    description: "Loads are strapped and tarped by the same crew that will offload them.",
    dark: false,
  },
  {
    label: "DISCIPLINE",
    description: "Services every 15,000km in our own workshop — not when something breaks.",
    dark: true,
  },
  {
    label: "LOCAL",
    description: "Mutare-based, Zimbabwean drivers, and cross-border runs we have done for years.",
    dark: false,
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      {/* Hero */}
      <div className="grid grid-cols-1 items-center gap-10 px-5 pt-10 pb-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-12 lg:pt-16 lg:pb-[58px]">
        <div className="flex flex-col gap-4 sm:gap-[22px]">
          <span className="font-sans text-xs font-semibold tracking-[0.14em] text-(--color-brand)">
            ABOUT WD LOGISTICS
          </span>
          <h1 className="m-0 max-w-[18ch] text-balance font-sans text-[32px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[38px] lg:text-[44px] lg:leading-[1.1]">
            A haulage company built on kept promises.
          </h1>
          <p className="m-0 max-w-[52ch] text-balance font-sans text-[15px] leading-[1.6] text-(--color-muted) sm:text-base sm:leading-[1.65]">
            We started with one truck on the Mutare–Harare run and a simple rule: if we say it
            will be there Thursday, it is there Thursday. Twelve trucks later, the rule
            hasn&apos;t moved.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {STATS.map((stat) => (
              <span
                key={stat}
                className="rounded-[4px] border border-(--color-border-strong) px-[18px] py-3 font-sans text-sm font-semibold text-(--color-ink-soft)"
              >
                {stat}
              </span>
            ))}
          </div>
        </div>
        <PhotoPlaceholder label="PHOTO — FLEET LINED UP AT THE YARD" className="h-[240px] sm:h-[300px] lg:h-[380px]" />
      </div>

      {/* Photo gallery */}
      <div className="px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12 lg:pb-[60px]">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:grid-rows-2 lg:grid-cols-4">
          <PhotoPlaceholder
            label="PHOTO — LOADING BAY, GRANITESIDE"
            className="h-[220px] sm:col-span-2 sm:row-span-2 sm:h-full lg:col-span-2"
          />
          <PhotoPlaceholder label="TARPING A LOAD" className="h-[140px] sm:h-full" />
          <div className="flex h-[140px] flex-col justify-between rounded-[6px] bg-(--color-accent) p-5 text-(--color-accent-ink) sm:h-full">
            <span className="font-mono text-[11px] font-semibold tracking-[0.12em]">
              ON THE ROAD
            </span>
            <span className="text-balance font-sans text-sm leading-[1.5]">
              Every trip is planned the night before — route, weighbridge stops, fuel and a
              back-up driver.
            </span>
          </div>
          <PhotoPlaceholder
            label="PHOTO — TIPPER OFFLOADING AT SITE"
            className="h-[140px] sm:col-span-2 sm:h-full"
          />
        </div>
      </div>

      {/* Founder */}
      <div className="grid grid-cols-1 items-center gap-8 border-t border-b border-(--color-border) bg-(--color-surface-muted) px-5 py-12 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10 lg:px-12 lg:py-16">
        <PhotoPlaceholder label="PHOTO — TRUCK CAB, ROAD AHEAD" className="h-[240px] sm:h-[300px] lg:h-[380px]" />
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-[4px] border border-(--color-border-strong) bg-(--color-surface) px-[14px] py-2 font-sans text-xs font-semibold tracking-[0.06em] text-(--color-brand)">
            FROM THE FOUNDER
          </span>
          <p className="m-0 max-w-[40ch] text-balance font-sans text-xl leading-[1.35] font-semibold tracking-[-0.01em] sm:text-[26px] sm:leading-[1.3]">
            &ldquo;I grew up watching goods sit in yards because someone didn&apos;t phone back. WD
            exists so that never happens to a Zimbabwean business again.&rdquo;
          </p>
          <p className="m-0 max-w-[52ch] text-balance font-sans text-base leading-[1.7] text-(--color-body)">
            &ldquo;We are deliberately small enough that I still know every driver by name and
            every regular client&apos;s delivery window. When we grow, that is the thing we will
            protect.&rdquo;
          </p>
          <div className="flex flex-col gap-1 border-t border-(--color-border) pt-4">
            <span className="font-sans text-[17px] font-bold">W. Dziruni</span>
            <span className="font-sans text-sm text-(--color-muted)">Founder, WD Logistics</span>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <h2 className="m-0 mb-6 max-w-[24ch] text-balance font-sans text-2xl leading-[1.15] font-semibold tracking-[-0.02em] sm:mb-8 sm:text-[30px]">
          How we work, in four sentences
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <div
              key={value.label}
              className={`flex flex-col gap-3.5 rounded-[6px] border p-6 sm:p-7 ${
                value.dark
                  ? "border-(--color-ink) bg-(--color-ink) text-white"
                  : "border-(--color-border) bg-(--color-surface)"
              }`}
            >
              <span
                className={`font-mono text-[12px] font-semibold tracking-[0.12em] ${
                  value.dark ? "text-(--color-accent)" : "text-(--color-brand)"
                }`}
              >
                {value.label}
              </span>
              <span
                className={`text-balance font-sans text-[15px] leading-[1.6] ${
                  value.dark ? "text-[#cfd5cb]" : "text-(--color-ink-soft)"
                }`}
              >
                {value.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <CtaBanner
        heading="Got a load that needs moving this week?"
        description="Send us the route and the tonnage — we'll come back with a price the same day."
      />
    </PageShell>
  );
}
