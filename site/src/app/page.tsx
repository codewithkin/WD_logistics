import Link from "next/link";
import { Header } from "@/components/Header";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { CtaFooterFull } from "@/components/CtaFooter";
import { FaqAccordion } from "@/components/FaqAccordion";
import { COMPANY } from "@/lib/site";

const ROUTES = [
  "MUTARE",
  "HARARE",
  "FORBES BORDER",
  "BULAWAYO",
  "BEITBRIDGE",
  "MASVINGO",
  "GWERU",
  "CHIRUNDU",
  "SADC REGION",
  "MUTARE",
];

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
    <div className="w-[1320px] max-w-full bg-[#FBFCFB] text-[#1E2320]">
      <Header />

      {/* Hero */}
      <div className="px-[34px] pt-[26px]">
        <PhotoPlaceholder
          variant="neutral"
          className="flex min-h-[800px] flex-col justify-between rounded-[40px] p-[46px]"
          label=""
        >
          <div className="flex items-start justify-between gap-10">
            <div className="flex max-w-[640px] flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-white px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em]">
                <span className="h-[7px] w-[7px] rounded-full bg-[#1667C4]" />
                ROAD FREIGHT · ZIMBABWE &amp; SADC
              </span>
              <h1 className="m-0 font-heading text-[74px] font-semibold leading-[0.98] tracking-[-0.035em] text-balance">
                Zimbabwe&apos;s
                <br />
                load, moved
                <br />
                <span className="italic text-[#3D8A14]">on time.</span>
              </h1>
              <p className="m-0 max-w-[44ch] rounded-[20px] bg-white/85 px-[22px] py-[18px] font-sans text-base leading-[1.6] text-[#333833] text-balance">
                Short and long distance haulage from our Mutare base — across
                Zimbabwe and into the SADC region. Satellite tracking on every
                truck, one dispatcher, a quote the same day.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={COMPANY.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[#63C32E] px-7 py-[17px] font-sans text-[15px] font-bold text-[#15250A]"
                >
                  WhatsApp us →
                </a>
                <Link
                  href="/contact"
                  className="rounded-full bg-white px-7 py-[17px] font-sans text-[15px] font-semibold text-[#1E2320]"
                >
                  Contact us
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <span className="flex flex-col gap-1 rounded-[24px] bg-white px-[26px] py-5 text-right">
                <span className="font-heading text-[34px] font-bold leading-none tracking-[-0.03em]">
                  4,100+
                </span>
                <span className="font-sans text-xs leading-[1.4] text-[#646B65]">
                  loads delivered
                  <br />
                  across Zimbabwe
                </span>
              </span>
              <span className="flex items-center gap-2.5 rounded-full bg-[#1667C4] px-5 py-3.5 font-sans text-[13px] font-semibold text-white">
                98% on-time
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-2 font-mono text-[11px] tracking-[0.08em] text-[#6A716B]">
              HERO PHOTO — LOADED TRAILER, WIDE CROP
            </span>
            <div className="flex w-[430px] flex-col gap-4 rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(30,35,32,.18)]">
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
            </div>
          </div>
        </PhotoPlaceholder>
      </div>

      {/* Route ticker */}
      <div className="my-[34px] overflow-hidden bg-[#1E2320] py-[18px] text-white">
        <div className="flex items-center gap-[34px] whitespace-nowrap font-heading text-[15px] font-semibold tracking-[0.02em]">
          {ROUTES.map((route, i) => (
            <span key={`${route}-${i}`} className="flex items-center gap-[34px]">
              <span className="text-[#8FD94F]">✳</span>
              <span>{route}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Services */}
      <div id="b-services" className="px-[34px] pb-[70px] pt-5">
        <div className="flex items-end justify-between gap-10 pb-[34px]">
          <h2 className="m-0 max-w-[22ch] font-heading text-[50px] font-semibold leading-[1.02] tracking-[-0.03em] text-balance">
            One fleet, every kind of <span className="italic">load</span>
          </h2>
          <p className="m-0 max-w-[40ch] font-sans text-base leading-[1.6] text-[#646B65] text-balance">
            Road freight is all we do — which is why we do it properly. Tell
            us what&apos;s on the floor and we&apos;ll tell you which trailer
            it needs.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-[18px]">
          <div className="col-span-2 flex flex-col gap-[18px] rounded-[32px] border border-[#E6E9E2] bg-white p-[26px]">
            <PhotoPlaceholder
              variant="card"
              label="PHOTO — SUPERLINK ON THE MUTARE ROAD"
              className="flex h-[210px] items-center justify-center rounded-[22px]"
              labelClassName="text-[10px] px-0 bg-transparent"
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
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#EFF8E5] font-sans text-lg font-semibold text-[#3D8A14]">
                ↗
              </span>
            </div>
          </div>

          <div className="flex min-h-[290px] flex-col justify-between gap-5 rounded-[32px] bg-[#63C32E] p-[26px] text-[#15250A]">
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
          </div>

          <div className="flex flex-col gap-4 rounded-[32px] border border-[#E6E9E2] bg-white p-[26px]">
            <PhotoPlaceholder
              variant="card"
              label="TIPPER TRUCK"
              className="flex h-[120px] items-center justify-center rounded-[20px]"
              labelClassName="text-[10px] px-0 bg-transparent"
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
          </div>

          <div className="col-span-2 flex items-center gap-[22px] rounded-[32px] border border-[#E6E9E2] bg-white p-[26px]">
            <PhotoPlaceholder
              variant="card"
              label="LOW-BED MACHINERY"
              className="flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-[24px] text-center"
              labelClassName="text-[10px] px-0 bg-transparent"
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
          </div>

          <div className="flex min-h-[230px] flex-col justify-between gap-5 rounded-[32px] bg-[#F3F4F0] p-[26px]">
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
          </div>

          <div className="flex min-h-[230px] flex-col justify-between gap-5 rounded-[32px] bg-[#1E2320] p-[26px] text-white">
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
                className="w-fit rounded-full bg-[#63C32E] px-5 py-3 font-sans text-[13px] font-bold text-[#15250A]"
              >
                WhatsApp →
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Four steps */}
      <div className="bg-[#EFF8E5] px-[34px] py-[70px]">
        <div className="flex items-end justify-between gap-10 pb-10">
          <h2 className="m-0 max-w-[20ch] font-heading text-[50px] font-semibold leading-[1.02] tracking-[-0.03em] text-balance">
            Four steps from message to delivery note
          </h2>
          <span className="rounded-full bg-white px-5 py-3 font-sans text-[13px] font-semibold">
            Most quotes inside 3 hours
          </span>
        </div>
        <div className="grid grid-cols-4 gap-[18px]">
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
            <div
              key={step.n}
              className="flex flex-col gap-4 rounded-[28px] bg-white p-7"
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
            </div>
          ))}
        </div>
      </div>

      {/* Why clients stay */}
      <div className="grid grid-cols-2 items-center gap-[34px] px-[34px] py-[74px]">
        <PhotoPlaceholder
          variant="neutral"
          label="PHOTO — LOADING AT THE NYAKAMETE YARD"
          className="flex h-[480px] items-end rounded-[36px] p-[26px]"
        >
          <span className="absolute right-[26px] top-[26px] flex flex-col gap-1 rounded-[22px] bg-white px-[22px] py-[18px] text-right">
            <span className="font-heading text-[30px] font-bold leading-none tracking-[-0.03em]">
              12
            </span>
            <span className="font-sans text-xs leading-[1.3] text-[#646B65]">
              trucks in the
              <br />
              WD fleet
            </span>
          </span>
        </PhotoPlaceholder>
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-full bg-[#EFF8E5] px-4 py-2.5 font-sans text-xs font-semibold tracking-[0.06em] text-[#3D8A14]">
            WHY CLIENTS STAY
          </span>
          <h2 className="m-0 max-w-[22ch] font-heading text-[46px] font-semibold leading-[1.04] tracking-[-0.03em] text-balance">
            Zimbabwean roads, Zimbabwean crew
          </h2>
          <p className="m-0 max-w-[46ch] font-sans text-base leading-[1.7] text-[#646B65] text-balance">
            We know which weighbridge is slow, which detour floods in
            February and which farm gate needs a smaller rig. That&apos;s not
            something a booking app can tell you.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Satellite-tracked fleet",
              "100% Hazchem compliant",
              "24/7 dispatch line",
              "Mutare workshop, in-house",
            ].map((item) => (
              <span
                key={item}
                className="flex items-center gap-2.5 rounded-[18px] bg-[#F3F4F0] px-4.5 py-4 font-sans text-sm font-medium text-[#333833]"
              >
                <span className="font-bold text-[#3D8A14]">✓</span> {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div
        id="b-faq"
        className="grid grid-cols-[0.9fr_1.1fr] gap-[34px] px-[34px] pb-[74px]"
      >
        <div className="flex flex-col gap-[22px]">
          <h2 className="m-0 max-w-[18ch] font-heading text-[46px] font-semibold leading-[1.04] tracking-[-0.03em] text-balance">
            Questions we get every week
          </h2>
          <p className="m-0 max-w-[34ch] font-sans text-[15px] leading-[1.7] text-[#646B65] text-balance">
            Anything else, the dispatcher picks up: {COMPANY.whatsapp}.
          </p>
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-full bg-[#1E2320] px-6 py-[15px] font-sans text-sm font-bold text-white"
          >
            Ask on WhatsApp →
          </a>
        </div>
        <FaqAccordion items={FAQS} />
      </div>

      {/* Testimonials */}
      <div className="px-[34px] pb-[74px]">
        <div className="grid grid-cols-3 gap-[18px]">
          <div className="flex flex-col gap-4.5 rounded-[28px] border border-[#E6E9E2] bg-white p-[30px]">
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
          </div>

          <div className="flex flex-col gap-4.5 rounded-[28px] border border-[#E6E9E2] bg-white p-[30px]">
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
          </div>

          <div className="flex flex-col justify-between gap-5.5 rounded-[28px] bg-[#1E2320] p-[30px] text-white">
            <span className="font-mono text-xs font-semibold tracking-[0.12em] text-[#8FD94F]">
              WHERE WE RUN
            </span>
            <span className="flex flex-col gap-2">
              <span className="font-heading text-[60px] font-bold leading-none tracking-[-0.04em]">
                10/10
              </span>
              <span className="font-sans text-[15px] leading-[1.6] text-[#CFD5CB] text-balance">
                provinces served from our Mutare base, plus cross-border work
                into the SADC region.
              </span>
            </span>
            <Link
              href="/about"
              className="w-fit rounded-full bg-white px-5 py-3 font-sans text-[13px] font-bold text-[#1E2320]"
            >
              See coverage →
            </Link>
          </div>
        </div>
      </div>

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
    </div>
  );
}
