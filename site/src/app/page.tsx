import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PhotoImage } from "@/components/PhotoImage";
import { CtaBanner } from "@/components/CtaBanner";
import { COMPANY } from "@/lib/constants";

const SERVICES = [
  {
    title: "Full loads",
    description:
      "A whole trailer for one consignment — up to 30 tonnes, tarped and strapped, door to door.",
  },
  {
    title: "Part loads",
    description:
      "Pay for the space you use. We consolidate on the Mutare–Harare run twice a week.",
  },
  {
    title: "Bulk & tipper",
    description:
      "Maize, fertiliser, granite, sand and aggregates from mine, farm or quarry to site.",
  },
];

const WHY_WD = [
  {
    number: "01",
    title: "You speak to the dispatcher",
    description: "No call centre. The person who answers knows where every truck is.",
  },
  {
    number: "02",
    title: "Our own trucks and drivers",
    description: "Maintained in our Nyakamete yard, so breakdowns don't become your problem.",
  },
  {
    number: "03",
    title: "Tracked and Hazchem compliant",
    description:
      "Satellite tracking on every vehicle, and drivers and trucks that are 100% Hazchem compliant.",
  },
];

export default function HomePage() {
  return (
    <PageShell>
      {/* Hero */}
      <div className="grid grid-cols-1 items-center gap-10 px-5 pt-10 pb-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-12 lg:pt-16 lg:pb-[58px]">
        <div className="animate-fade-in-up flex flex-col gap-4 sm:gap-[22px]">
          <span className="font-sans text-xs font-semibold tracking-[0.14em] text-(--color-brand)">
            ROAD FREIGHT · ZIMBABWE &amp; SADC
          </span>
          <h1 className="m-0 text-balance font-sans text-[32px] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[38px] lg:text-[46px] lg:leading-[1.1]">
            Loads moved across Zimbabwe, on the day we promised.
          </h1>
          <p className="m-0 max-w-[50ch] text-balance font-sans text-[15px] leading-[1.6] text-(--color-muted) sm:text-base sm:leading-[1.65]">
            WD Logistics runs short and long distance road freight from our Mutare base — across
            Zimbabwe and into the SADC region. Full loads, part loads and bulk, on
            satellite-tracked trucks. Send us the details on WhatsApp and we&apos;ll quote you
            today.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={COMPANY.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cta rounded-[4px] bg-(--color-accent) px-6 py-3.5 font-sans text-sm font-semibold text-(--color-accent-ink) hover:text-(--color-accent-ink)"
            >
              WhatsApp
            </a>
            <Link
              href="/contact"
              className="rounded-[4px] border border-(--color-border-strong) px-6 py-3.5 font-sans text-sm font-medium text-(--color-ink-soft) hover:text-(--color-ink)"
            >
              Contact us
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 border-t border-(--color-border) pt-5 font-sans text-sm text-(--color-muted) sm:gap-9">
            <span>
              <strong className="font-sans text-lg font-semibold text-(--color-ink)">10</strong>
              &nbsp; provinces covered
            </span>
            <span>
              <strong className="font-sans text-lg font-semibold text-(--color-ink)">100%</strong>
              &nbsp; Hazchem compliant
            </span>
            <span>
              <strong className="font-sans text-lg font-semibold text-(--color-ink)">24/7</strong>
              &nbsp; dispatch line
            </span>
          </div>
        </div>
        <PhotoImage
          src="/images/truck-side-white-green-2.jpg"
          alt="White and green WD Logistics truck, side profile, at the company yard"
          className="h-[240px] sm:h-[300px] lg:h-[380px]"
          sizes="(min-width: 1024px) 45vw, 100vw"
          priority
        />
      </div>

      {/* Services */}
      <div id="services" className="px-5 pb-10 sm:px-8 sm:pb-14 lg:px-12 lg:pb-[60px]">
        <h2 className="m-0 mb-2 font-sans text-2xl leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[30px]">
          What we haul
        </h2>
        <p className="m-0 mb-6 max-w-[56ch] text-balance font-sans text-[15px] leading-[1.6] text-(--color-muted) sm:mb-[30px]">
          Three ways to move goods with us. Same drivers, same trucks, same dispatcher on the
          phone.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <div
              key={service.title}
              className="flex flex-col gap-2.5 rounded-[6px] border border-(--color-border) p-6 sm:p-7"
            >
              <h3 className="m-0 font-sans text-[19px] leading-[1.25] font-semibold">
                {service.title}
              </h3>
              <p className="m-0 text-balance font-sans text-sm leading-[1.6] text-(--color-muted)">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Why WD */}
      <div
        id="why"
        className="grid grid-cols-1 gap-8 border-t border-b border-(--color-border) bg-(--color-surface-muted) px-5 py-10 sm:grid-cols-2 sm:gap-5 sm:px-8 sm:py-11 lg:grid-cols-3 lg:px-12"
      >
        {WHY_WD.map((item) => (
          <div key={item.number} className="flex flex-col gap-2">
            <span className="font-mono text-[13px] font-semibold text-(--color-brand)">
              {item.number}
            </span>
            <span className="font-sans text-[17px] leading-[1.3] font-semibold">
              {item.title}
            </span>
            <span className="text-balance font-sans text-sm leading-[1.6] text-(--color-muted)">
              {item.description}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div id="contact">
        <CtaBanner
          heading="Tell us the load and the route. We'll quote you today."
          description={
            <>
              {COMPANY.whatsapp} · {COMPANY.office}
              <br />
              {COMPANY.email}
            </>
          }
        />
      </div>
    </PageShell>
  );
}
