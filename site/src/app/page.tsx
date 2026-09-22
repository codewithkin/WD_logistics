import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PhotoBlock } from "@/components/PhotoBlock";
import { CtaFooterFull } from "@/components/CtaFooter";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { COMPANY, COUNTRIES, DEFAULT_OG, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `WD Logistics | ${COMPANY.motto} — Road Freight Across the SADC Region`,
  description:
    "WD Logistics (Pvt) Ltd is a trucking and haulage company founded by Wellington Dziruni, running from its Mutare base across the SADC region. Full loads, part loads, bulk & tipper and abnormal loads — same-day quotes on WhatsApp.",
  alternates: { canonical: "/" },
  openGraph: {
    ...DEFAULT_OG,
    url: SITE_URL,
    title: `WD Logistics | ${COMPANY.motto} — Road Freight Across the SADC Region`,
    description:
      "Road freight across the SADC region from our Mutare base. Full loads, part loads, bulk & tipper and abnormal loads — same-day quotes on WhatsApp.",
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#organization`,
  name: COMPANY.name,
  legalName: COMPANY.name,
  founder: {
    "@type": "Person",
    name: COMPANY.founder,
  },
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.jpg`,
  image: `${SITE_URL}/images/truck-side-blue.jpg`,
  telephone: COMPANY.whatsapp,
  email: COMPANY.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "1 Tameside Close, Nyakamete",
    addressLocality: "Mutare",
    addressCountry: "ZW",
  },
  slogan: COMPANY.motto,
  areaServed: [
    "Zimbabwe",
    "Zambia",
    "Mozambique",
    "Democratic Republic of the Congo",
    "South Africa",
    "SADC region",
  ],
  sameAs: [COMPANY.whatsappHref],
};

// The ticker scrolls one half of the row out of view (translateX(-50%)), so each
// half has to be wider than the widest viewport or a gap appears at the loop
// point. Five short country names aren't enough on a 1920px screen, so the list
// is repeated before it's doubled.
const TICKER = Array.from({ length: 4 }, () => COUNTRIES).flat();

const FAQS = [
  {
    question: "How quickly can you quote a trip?",
    answer:
      "Most quotes go out inside three hours of the details landing on WhatsApp — sooner if the dispatcher is free.",
  },
  {
    question: "Do you move part loads, or only full trailers?",
    answer:
      "Both. If your cargo doesn't fill a trailer we put it on a consolidated run and you pay for the space it takes — Mutare–Harare leaves every Tuesday and Friday.",
  },
  {
    question: "Can I track my load while it's on the road?",
    answer:
      "Yes — every truck carries satellite tracking, and the dispatcher can share your load's position on request.",
  },
  {
    question: "Do you deliver to farms and mine sites?",
    answer:
      "Regularly. Tell us the gate or site access details up front and we'll match the right rig to the road.",
  },
  {
    question: "How do I pay, and in which currency?",
    answer:
      "USD or ZWL by transfer, cash or mobile money — invoiced per trip, with terms available for regular clients.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[1320px] bg-[#FBFCFB] text-[#1E2320]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ORGANIZATION_JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <Header />

      {/* Hero — the photo carries no text on purpose: the fleet line-up is the
          first thing a visitor should see, uninterrupted, at every width. All
          copy sits in the band below it. */}
      <div className="px-5 pt-5 sm:px-8 lg:px-[34px] lg:pt-[26px]">
        <PhotoBlock
          src="/images/fleet-lineup-yard.jpg"
          alt="The WD Logistics fleet of trucks lined up in the yard at the Mutare base"
          priority
          sizes="100vw"
          imgClassName="object-[50%_36%] sm:object-[50%_38%] lg:object-[50%_40%]"
          className="h-[46vh] min-h-[240px] rounded-[28px] sm:h-[360px] sm:rounded-[32px] lg:h-[520px] lg:rounded-[40px]"
        >
          <Reveal
            className="absolute left-5 top-5 sm:left-6 sm:top-6 lg:left-8 lg:top-8"
            y={16}
          >
            <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-white px-4 py-2.5 font-sans text-[11px] font-semibold tracking-[0.06em] sm:text-xs">
              <span className="h-[7px] w-[7px] rounded-full bg-[#1667C4]" />
              ROAD FREIGHT · SADC REGION
            </span>
          </Reveal>
        </PhotoBlock>
      </div>

      <div className="grid grid-cols-1 gap-8 px-5 pt-7 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-[34px] lg:px-[34px] lg:pt-10">
        <Reveal className="flex flex-col gap-5 lg:gap-6" y={20}>
          <h1 className="m-0 font-heading text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-[60px] lg:text-[80px] lg:leading-[0.96] lg:tracking-[-0.035em]">
            Efficiency
            <br />
            <span className="italic text-[#3D8A14]">in Motion.</span>
          </h1>
          <p className="m-0 max-w-full font-sans text-sm leading-[1.7] text-[#333833] text-balance sm:max-w-[48ch] sm:text-base">
            Short and long distance haulage from our Mutare base — across
            Zimbabwe, Zambia, Mozambique, DR Congo and South Africa. Satellite
            tracking on every truck, one dispatcher, a quote the same day.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={COMPANY.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#63C32E] px-6 py-4 font-sans text-sm font-bold text-[#15250A] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98] sm:px-7 sm:py-[17px] sm:text-[15px]"
            >
              WhatsApp us →
            </a>
            <Link
              href="/contact"
              className="rounded-full border border-[#D9DED6] bg-white px-6 py-4 font-sans text-sm font-semibold text-[#1E2320] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98] sm:px-7 sm:py-[17px] sm:text-[15px]"
            >
              Contact us
            </Link>
          </div>
          <Reveal
            className="flex flex-row flex-wrap items-center gap-3"
            y={16}
            delay={0.15}
          >
            <span className="flex flex-col gap-1 rounded-[20px] border border-[#E6E9E2] bg-white px-5 py-4 sm:rounded-[24px] sm:px-[26px] sm:py-5">
              <span className="font-heading text-2xl font-bold leading-none tracking-[-0.03em] sm:text-[34px]">
                4,100+
              </span>
              <span className="font-sans text-[11px] leading-[1.4] text-[#646B65] sm:text-xs">
                loads delivered
                <br />
                across the SADC region
              </span>
            </span>
            <span className="flex items-center gap-2.5 rounded-full bg-[#1667C4] px-4 py-3 font-sans text-xs font-semibold text-white sm:px-5 sm:py-3.5 sm:text-[13px]">
              98% on-time
            </span>
          </Reveal>
        </Reveal>

        <div className="flex flex-col items-start gap-4 lg:items-end">
            <Reveal
              className="flex w-full flex-col gap-4 rounded-[24px] border border-[#E6E9E2] bg-white p-5 shadow-[0_20px_50px_rgba(30,35,32,.10)] sm:rounded-[28px] sm:p-6 lg:w-[430px]"
              y={24}
              delay={0.25}
            >
              <span className="font-heading text-base font-bold">
                Get a same-day quote
              </span>
              <div className="flex gap-1.5 rounded-full bg-[#F3F4F0] p-[5px]">
                <span className="flex-1 rounded-full bg-[#1E2320] py-2.5 text-center font-sans text-xs font-semibold text-white">
                  Full load
                </span>
                <span className="flex-1 py-2.5 text-center font-sans text-xs font-medium text-[#646B65]">
                  Part load
                </span>
                <span className="flex-1 py-2.5 text-center font-sans text-xs font-medium text-[#646B65]">
                  Bulk
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="rounded-[14px] border border-[#E6E9E2] bg-[#F7F8F5] px-4 py-[13px] font-sans text-[13px] text-[#868C86]">
                  Collection point (e.g. Nyakamete, Mutare)
                </span>
                <span className="rounded-[14px] border border-[#E6E9E2] bg-[#F7F8F5] px-4 py-[13px] font-sans text-[13px] text-[#868C86]">
                  Destination (e.g. Harare CBD)
                </span>
                <div className="flex gap-2.5">
                  <span className="flex-1 rounded-[14px] border border-[#E6E9E2] bg-[#F7F8F5] px-4 py-[13px] font-sans text-[13px] text-[#868C86]">
                    Tonnage
                  </span>
                  <span className="flex-1 rounded-[14px] border border-[#E6E9E2] bg-[#F7F8F5] px-4 py-[13px] font-sans text-[13px] text-[#868C86]">
                    Date
                  </span>
                </div>
              </div>
              <a
                href={COMPANY.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#63C32E] py-[15px] text-center font-sans text-sm font-bold text-[#15250A]"
              >
                Send on WhatsApp
              </a>
            </Reveal>
        </div>
      </div>

      {/* Country ticker */}
      <div className="my-8 overflow-hidden bg-[#1E2320] py-4 text-white lg:my-[34px] lg:py-[18px]">
        <div className="animate-marquee flex w-max items-center gap-6 whitespace-nowrap font-heading text-sm font-semibold tracking-[0.02em] sm:gap-[34px] sm:text-[15px]">
          {[...TICKER, ...TICKER].map((country, i) => (
            <span key={`${country}-${i}`} className="flex items-center gap-6 sm:gap-[34px]">
              <span className="text-[#8FD94F]">✳</span>
              <span>{country}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Services */}
      <div id="b-services" className="px-5 pb-12 pt-5 sm:px-8 lg:px-[34px] lg:pb-[70px]">
        <Reveal className="flex flex-col gap-6 pb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:pb-[34px]">
          <h2 className="m-0 max-w-full font-heading text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[40px] lg:max-w-[22ch] lg:text-[50px] lg:leading-[1.02] lg:tracking-[-0.03em]">
            One fleet, every kind of <span className="italic">load</span>
          </h2>
          <p className="m-0 max-w-full font-sans text-sm leading-[1.6] text-[#646B65] text-balance sm:text-base lg:max-w-[40ch]">
            Road freight is all we do — which is why we do it properly. Tell
            us what&apos;s on the floor and we&apos;ll tell you which trailer
            it needs.
          </p>
        </Reveal>

        <StaggerGroup className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem className="group sm:col-span-2 flex flex-col gap-[18px] rounded-[28px] border border-[#E6E9E2] bg-white p-6 transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(30,35,32,.08)] lg:rounded-[32px] lg:p-[26px]">
            <PhotoBlock
              src="/images/truck-side-blue.jpg"
              alt="WD Logistics superlink truck cab, side profile"
              className="h-[210px] rounded-[22px]"
              imgClassName="object-[center_30%]"
            />
            <div className="flex items-end justify-between gap-6">
              <span className="flex flex-col gap-2.5">
                <span className="font-heading text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]">
                  Full loads
                </span>
                <span className="max-w-[34ch] font-sans text-sm leading-[1.6] text-[#646B65]">
                  A whole trailer for one consignment — up to 30 tonnes,
                  tarped, strapped and delivered door to door.
                </span>
              </span>
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#EFF8E5] font-sans text-lg font-semibold text-[#3D8A14] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                ↗
              </span>
            </div>
          </StaggerItem>

          <StaggerItem className="group flex min-h-[290px] flex-col justify-between gap-5 rounded-[32px] bg-[#63C32E] p-[26px] text-[#15250A] transition-transform duration-300 hover:-translate-y-1.5">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white/65 font-sans text-lg font-semibold">
              ◱
            </span>
            <span className="flex flex-col gap-2.5">
              <span className="font-heading text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]">
                Part loads
              </span>
              <span className="font-sans text-sm leading-[1.6] text-[#15250A]/[.78]">
                Pay only for the space you use. Consolidated runs
                Mutare–Harare every Tuesday and Friday.
              </span>
              <span className="pt-1 font-sans text-[13px] font-bold text-[#15250A]">
                Check the schedule →
              </span>
            </span>
          </StaggerItem>

          <StaggerItem className="flex flex-col gap-4 rounded-[32px] border border-[#E6E9E2] bg-white p-[26px] transition-transform duration-300 hover:-translate-y-1.5">
            <PhotoBlock
              src="/images/truck-side-white-green-2.jpg"
              alt="WD Logistics tipper truck, side profile"
              className="h-[120px] rounded-[20px]"
              imgClassName="object-[center_25%]"
            />
            <span className="flex flex-col gap-2.5">
              <span className="font-heading text-2xl font-semibold leading-[1.1] tracking-[-0.02em]">
                Bulk &amp; tipper
              </span>
              <span className="font-sans text-sm leading-[1.6] text-[#646B65]">
                Maize, fertiliser, granite, sand — farm, mine or quarry to
                site.
              </span>
            </span>
          </StaggerItem>

          <StaggerItem className="sm:col-span-2 flex flex-col items-start gap-5 rounded-[28px] border border-[#E6E9E2] bg-white p-6 transition-transform duration-300 hover:-translate-y-1.5 sm:flex-row sm:items-center sm:gap-[22px] lg:rounded-[32px] lg:p-[26px]">
            <PhotoBlock
              src="/images/truck-side-white-green-1.jpg"
              alt="WD Logistics low-bed truck for machinery and abnormal loads"
              className="h-[140px] w-full shrink-0 rounded-[24px] sm:h-[180px] sm:w-[180px]"
              imgClassName="object-[center_25%]"
            />
            <span className="flex flex-col gap-2.5">
              <span className="font-heading text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]">
                Abnormal &amp; project loads
              </span>
              <span className="font-sans text-sm leading-[1.6] text-[#646B65] text-balance">
                Plant, generators, tanks and equipment on low-bed trailers,
                with permits and escorts arranged before the wheels turn.
              </span>
              <span className="pt-0.5 font-sans text-[13px] font-bold text-[#3D8A14]">
                Plan a move →
              </span>
            </span>
          </StaggerItem>

          <StaggerItem className="flex min-h-[230px] flex-col justify-between gap-5 rounded-[32px] bg-[#F3F4F0] p-[26px] transition-transform duration-300 hover:-translate-y-1.5">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#1667C4] font-sans text-lg font-semibold text-white">
              ✓
            </span>
            <span className="flex flex-col gap-2.5">
              <span className="font-heading text-2xl font-semibold leading-[1.1] tracking-[-0.02em]">
                Tracked in real time
              </span>
              <span className="font-sans text-sm leading-[1.6] text-[#646B65]">
                Satellite tracking on every vehicle, so we always know where
                your load is.
              </span>
            </span>
          </StaggerItem>

          <StaggerItem className="flex min-h-[230px] flex-col justify-between gap-5 rounded-[32px] bg-[#1E2320] p-[26px] text-white transition-transform duration-300 hover:-translate-y-1.5">
            <span className="font-mono text-[13px] font-semibold tracking-[0.12em] text-[#8FD94F]">
              NOT SURE?
            </span>
            <span className="flex flex-col gap-3.5">
              <span className="font-heading text-2xl font-semibold leading-[1.1] tracking-[-0.02em]">
                Send a photo of the load
              </span>
              <a
                href={COMPANY.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit rounded-full bg-[#63C32E] px-5 py-3 font-sans text-[13px] font-bold text-[#15250A] transition-transform duration-200 hover:scale-[1.05] active:scale-[0.98]"
              >
                WhatsApp →
              </a>
            </span>
          </StaggerItem>
        </StaggerGroup>
      </div>

      {/* Four steps */}
      <div className="bg-[#EFF8E5] px-5 py-12 sm:px-8 lg:px-[34px] lg:py-[70px]">
        <Reveal className="flex flex-col gap-5 pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-10 lg:pb-10">
          <h2 className="m-0 max-w-full font-heading text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:max-w-[20ch] sm:text-[40px] lg:text-[50px] lg:leading-[1.02] lg:tracking-[-0.03em]">
            Four steps from message to delivery note
          </h2>
          <span className="w-fit rounded-full bg-white px-5 py-3 font-sans text-[13px] font-semibold">
            Most quotes inside 3 hours
          </span>
        </Reveal>
        <StaggerGroup className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "01",
              bg: "bg-[#1E2320]",
              text: "text-white",
              title: "Send the details",
              body: "WhatsApp or the form: what it is, where it's going, when it must be there.",
            },
            {
              n: "02",
              bg: "bg-[#63C32E]",
              text: "text-[#15250A]",
              title: "Get the rate",
              body: "One all-in price per trip — fuel, tolls and cover included. No surprises on invoice.",
            },
            {
              n: "03",
              bg: "bg-[#1667C4]",
              text: "text-white",
              title: "We collect",
              body: "Truck at your gate in the agreed window, loaded and secured by our crew.",
            },
            {
              n: "04",
              bg: "bg-[#1E2320]",
              text: "text-white",
              title: "You get the POD",
              body: "Updates on the road, then a signed delivery note on WhatsApp within the hour.",
            },
          ].map((step) => (
            <StaggerItem
              key={step.n}
              className="flex flex-col gap-4 rounded-[28px] bg-white p-7 transition-transform duration-300 hover:-translate-y-1.5"
            >
              <span
                className={`flex h-[52px] w-[52px] items-center justify-center rounded-full font-heading text-lg font-bold ${step.bg} ${step.text}`}
              >
                {step.n}
              </span>
              <span className="font-heading text-xl font-semibold leading-[1.15] tracking-[-0.02em]">
                {step.title}
              </span>
              <span className="font-sans text-sm leading-[1.6] text-[#646B65] text-balance">
                {step.body}
              </span>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>

      {/* Why clients stay */}
      <div className="grid grid-cols-1 items-center gap-8 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-[34px] lg:px-[34px] lg:py-[74px]">
        <Reveal x={-24} y={0}>
        <PhotoBlock
          src="/images/yard-under-shed.jpg"
          alt="WD Logistics trucks parked under the loading shed at the Nyakamete yard, Mutare"
          className="h-[320px] rounded-[28px] sm:h-[400px] sm:rounded-[36px] lg:h-[480px]"
        >
          <span className="absolute right-5 top-5 flex flex-col gap-1 rounded-[18px] bg-white px-4 py-3 text-right sm:right-[26px] sm:top-[26px] sm:rounded-[22px] sm:px-[22px] sm:py-[18px]">
            <span className="font-heading text-2xl font-bold leading-none tracking-[-0.03em] sm:text-[30px]">
              12
            </span>
            <span className="font-sans text-xs leading-[1.3] text-[#646B65]">
              trucks in the
              <br />
              WD fleet
            </span>
          </span>
        </PhotoBlock>
        </Reveal>
        <Reveal x={24} y={0} className="flex flex-col gap-5 lg:gap-6" delay={0.1}>
          <span className="w-fit rounded-full bg-[#EFF8E5] px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
            WHY CLIENTS STAY
          </span>
          <h2 className="m-0 max-w-full font-heading text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[40px] lg:max-w-[22ch] lg:text-[46px] lg:leading-[1.04] lg:tracking-[-0.03em]">
            SADC roads, one crew that knows them
          </h2>
          <p className="m-0 max-w-full font-sans text-sm leading-[1.7] text-[#646B65] text-balance sm:text-base lg:max-w-[46ch]">
            We know which weighbridge is slow, which detour floods in
            February and which farm gate needs a smaller rig. That&apos;s not
            something a booking app can tell you.
          </p>
          <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2" stagger={0.06}>
            {[
              "Satellite-tracked fleet",
              "100% Hazchem compliant",
              "24/7 dispatch line",
              "Mutare workshop, in-house",
            ].map((item) => (
              <StaggerItem
                key={item}
                y={12}
                className="flex items-center gap-2.5 rounded-[18px] bg-[#F3F4F0] px-4.5 py-4 font-sans text-sm font-medium text-[#333833] transition-colors duration-300 hover:bg-[#EFF8E5]"
              >
                <span className="font-bold text-[#3D8A14]">✓</span> {item}
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Reveal>
      </div>

      {/* FAQ */}
      <div
        id="b-faq"
        className="grid grid-cols-1 gap-8 px-5 pb-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-[34px] lg:px-[34px] lg:pb-[74px]"
      >
        <Reveal x={-24} y={0} className="flex flex-col gap-5 lg:gap-[22px]">
          <h2 className="m-0 max-w-full font-heading text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[40px] lg:max-w-[18ch] lg:text-[46px] lg:leading-[1.04] lg:tracking-[-0.03em]">
            Questions we get every week
          </h2>
          <p className="m-0 max-w-full font-sans text-sm leading-[1.7] text-[#646B65] text-balance sm:text-[15px] lg:max-w-[34ch]">
            Anything else, the dispatcher picks up: {COMPANY.whatsapp}.
          </p>
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-full bg-[#1E2320] px-6 py-[15px] font-sans text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
          >
            Ask on WhatsApp →
          </a>
        </Reveal>
        <Reveal x={24} y={0} delay={0.1}>
          <FaqAccordion items={FAQS} />
        </Reveal>
      </div>

      {/* Testimonials */}
      <div className="px-5 pb-12 sm:px-8 lg:px-[34px] lg:pb-[74px]">
        <StaggerGroup className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem className="flex flex-col gap-4.5 rounded-[28px] border border-[#E6E9E2] bg-white p-[30px] transition-transform duration-300 hover:-translate-y-1.5">
            <span className="font-sans text-sm font-medium text-[#1667C4]">
              ★★★★★
            </span>
            <p className="m-0 font-sans text-base leading-[1.65] text-[#333833] text-balance">
              &ldquo;We move fertiliser to Mvurwi every month. Four seasons
              with WD and not one late delivery.&rdquo;
            </p>
            <span className="mt-auto flex items-center gap-3 border-t border-[#ECEEE9] pt-3.5">
              <span className="h-10 w-10 rounded-full bg-[#EFF8E5]" />
              <span className="flex flex-col gap-0.5">
                <span className="font-sans text-sm font-bold">
                  Tendai Mutasa
                </span>
                <span className="font-sans text-[13px] text-[#787F79]">
                  Agri-supply, Mazowe
                </span>
              </span>
            </span>
          </StaggerItem>

          <StaggerItem className="flex flex-col gap-4.5 rounded-[28px] border border-[#E6E9E2] bg-white p-[30px] transition-transform duration-300 hover:-translate-y-1.5">
            <span className="font-sans text-sm font-medium text-[#1667C4]">
              ★★★★★
            </span>
            <p className="m-0 font-sans text-base leading-[1.65] text-[#333833] text-balance">
              &ldquo;They took a generator to Hwange on a low-bed with all the
              permits sorted. I just sent a photo on WhatsApp.&rdquo;
            </p>
            <span className="mt-auto flex items-center gap-3 border-t border-[#ECEEE9] pt-3.5">
              <span className="h-10 w-10 rounded-full bg-[#EFF8E5]" />
              <span className="flex flex-col gap-0.5">
                <span className="font-sans text-sm font-bold">
                  Rudo Chikafu
                </span>
                <span className="font-sans text-[13px] text-[#787F79]">
                  Site manager, Hwange
                </span>
              </span>
            </span>
          </StaggerItem>

          <StaggerItem className="flex flex-col justify-between gap-5.5 rounded-[28px] bg-[#1E2320] p-[30px] text-white transition-transform duration-300 hover:-translate-y-1.5">
            <span className="font-mono text-xs font-semibold tracking-[0.12em] text-[#8FD94F]">
              WHERE WE RUN
            </span>
            <span className="flex flex-col gap-2">
              <span className="font-heading text-[60px] font-bold leading-none tracking-[-0.04em]">
                5
              </span>
              <span className="font-sans text-[15px] leading-[1.6] text-[#CFD5CB] text-balance">
                SADC countries served from our Mutare base — Zimbabwe, Zambia,
                Mozambique, DR Congo and South Africa.
              </span>
            </span>
            <Link
              href="/about"
              className="w-fit rounded-full bg-white px-5 py-3 font-sans text-[13px] font-bold text-[#1E2320] transition-transform duration-200 hover:scale-[1.05] active:scale-[0.98]"
            >
              See coverage →
            </Link>
          </StaggerItem>
        </StaggerGroup>
      </div>

      <Reveal y={32}>
        <CtaFooterFull
          heading="Tell us the load and the route. We'll quote you today."
          columns={[
            {
              title: "PAGES",
              links: [
                { label: "Home", href: "/" },
                { label: "About", href: "/about" },
                { label: "Contact us", href: "/contact" },
              ],
            },
            {
              title: "SERVICES",
              links: [
                { label: "Full loads", href: "#b-services" },
                { label: "Part loads", href: "#b-services" },
                { label: "Bulk & tipper", href: "#b-services" },
                { label: "Abnormal loads", href: "#b-services" },
              ],
            },
            {
              title: "ON THIS PAGE",
              links: [
                { label: "FAQs", href: "#b-faq" },
                { label: "Coverage", href: "#b-services" },
                { label: "Payment terms", href: "#b-faq" },
              ],
            },
          ]}
        />
      </Reveal>
    </div>
  );
}
