"use client";

import { useState, type FormEvent } from "react";

const inputClass =
  "rounded-[4px] border border-(--color-border) bg-(--color-surface-muted) px-[18px] py-4 font-sans text-sm text-(--color-ink) placeholder:text-(--color-faint) focus:border-(--color-brand) focus:outline-none";

const labelClass = "font-sans text-[13px] font-semibold text-(--color-ink-soft)";

export function EnquiryForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-3 rounded-[6px] border border-(--color-border) bg-(--color-surface) p-10 text-center">
        <span className="mx-auto font-sans text-[22px] font-semibold">Enquiry sent</span>
        <p className="m-0 font-sans text-sm leading-[1.6] text-(--color-muted)">
          Thanks — we reply on WhatsApp within working hours, usually inside three hours.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mx-auto mt-2 rounded-[4px] border border-(--color-border-strong) px-6 py-3 font-sans text-sm font-medium text-(--color-ink-soft) hover:text-(--color-ink)"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-[6px] border border-(--color-border) bg-(--color-surface) p-6 sm:gap-8 sm:p-10"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-5">
          <span className="font-sans text-xl font-semibold tracking-[-0.01em]">Your details</span>
          <span className="font-sans text-xs font-medium text-(--color-faint)">Required</span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Full name</span>
            <input
              required
              name="name"
              type="text"
              placeholder="e.g. Tarisai Moyo"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>WhatsApp number</span>
            <input
              required
              name="whatsapp"
              type="tel"
              placeholder="+263 …"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>
              Email <span className="font-normal text-(--color-faint)">(optional)</span>
            </span>
            <input
              name="email"
              type="email"
              placeholder="you@company.co.zw"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>
              Company <span className="font-normal text-(--color-faint)">(optional)</span>
            </span>
            <input
              name="company"
              type="text"
              placeholder="Business or farm name"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-(--color-border) pt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-5">
          <span className="font-sans text-xl font-semibold tracking-[-0.01em]">
            About the load
          </span>
          <span className="rounded-[4px] bg-(--color-surface-muted) px-3 py-1.5 font-sans text-xs font-semibold text-(--color-brand)">
            All optional — skip what you don&apos;t know
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Unit load</span>
            <input
              name="unitLoad"
              type="text"
              placeholder="e.g. 30t maize in bags"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Number of units</span>
            <input
              name="units"
              type="text"
              placeholder="e.g. 2 trailer loads"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Start location</span>
            <input
              name="origin"
              type="text"
              placeholder="e.g. Nyakamete, Mutare"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Destination</span>
            <input
              name="destination"
              type="text"
              placeholder="e.g. Beitbridge"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Estimated distance</span>
            <input
              name="distance"
              type="text"
              placeholder="e.g. 275 km"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Departure date</span>
            <input name="departureDate" type="date" className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>
            Anything else <span className="font-normal text-(--color-faint)">(optional)</span>
          </span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Access at the gate, offloading equipment, a question about rates…"
            className={`${inputClass} resize-none`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-5 border-t border-(--color-border) pt-6">
        <span className="max-w-[34ch] text-balance font-sans text-[13px] leading-[1.6] text-(--color-faint)">
          We reply on WhatsApp within working hours — usually inside three hours.
        </span>
        <button
          type="submit"
          className="btn-cta rounded-[4px] bg-(--color-accent) px-7 py-3.5 font-sans text-sm font-semibold text-(--color-accent-ink)"
        >
          Send enquiry
        </button>
      </div>
    </form>
  );
}
