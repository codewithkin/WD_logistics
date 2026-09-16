import Link from "next/link";
import { COMPANY } from "@/lib/constants";

export function CtaBanner({
  heading,
  description,
  secondaryLabel = "Contact us",
  secondaryHref = "/contact",
}: {
  heading: string;
  description: React.ReactNode;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-10 bg-(--color-accent) px-12 py-11 text-(--color-accent-ink)">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 max-w-[30ch] font-sans text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance">
          {heading}
        </h2>
        <p className="m-0 font-sans text-[15px] leading-[1.5] text-[rgba(21,37,10,0.8)]">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 gap-2.5">
        <a
          href={COMPANY.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[4px] bg-(--color-surface) px-6 py-3.5 font-sans text-sm font-semibold text-(--color-ink) hover:text-(--color-ink)"
        >
          WhatsApp
        </a>
        <Link
          href={secondaryHref}
          className="rounded-[4px] border border-[rgba(21,37,10,0.35)] px-6 py-3.5 font-sans text-sm font-medium text-(--color-accent-ink) hover:text-(--color-ink)"
        >
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}
