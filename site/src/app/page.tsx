import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
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
      <div className="grid grid-cols-1 items-center gap-12 px-12 pt-16 pb-[58px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-[22px]">
          <span className="font-sans text-xs font-semibold tracking-[0.14em] text-(--color-brand)">
            ROAD FREIGHT · ZIMBABWE &amp; SADC
          </span>
          <h1 className="m-0 text-balance font-sans text-[46px] leading-[1.1] font-semibold tracking-[-0.02em]">
            Loads moved across Zimbabwe, on the day we promised.
          </h1>
          <p className="m-0 max-w-[50ch] text-balance font-sans text-base leading-[1.65] text-(--color-muted)">
            WD Logistics runs short and long distance road freight from our Mutare base — across
            Zimbabwe and into the SADC region. Full loads, part loads and bulk, on
            satellite-tracked trucks. Send us the details on WhatsApp and we&apos;ll quote you
            today.
          </p>
          <div className="flex items-center gap-2.5">
            <a
              href={COMPANY.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[4px] bg-(--color-accent) px-6 py-3.5 font-sans text-sm font-semibold text-(--color-accent-ink) hover:text-(--color-accent-ink)"
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
          <div className="flex gap-9 border-t border-(--color-border) pt-5 font-sans text-sm text-(--color-muted)">
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
        <PhotoPlaceholder label="PHOTO — WD TRUCK ON THE HARARE ROAD" className="h-[380px]" />
      </div>

      {/* Services */}
      <div id="services" className="px-12 pb-[60px]">
        <h2 className="m-0 mb-2 font-sans text-[30px] leading-[1.15] font-semibold tracking-[-0.02em]">
          What we haul
        </h2>
        <p className="m-0 mb-[30px] max-w-[56ch] text-balance font-sans text-[15px] leading-[1.6] text-(--color-muted)">
          Three ways to move goods with us. Same drivers, same trucks, same dispatcher on the
          phone.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {SERVICES.map((service) => (
            <div
              key={service.title}
              className="flex flex-col gap-2.5 rounded-[6px] border border-(--color-border) p-7"
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
        className="grid grid-cols-1 gap-5 border-t border-b border-(--color-border) bg-(--color-surface-muted) px-12 py-11 sm:grid-cols-3"
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
