"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";

const easeOut = [0.16, 1, 0.3, 1] as const;

const FIELD_CLASS =
  "rounded-2xl border border-[#E6E9E2] bg-[#F7F8F5] px-[18px] py-4 font-sans text-sm text-[#1E2320] placeholder:text-[#868C86] outline-none transition-colors focus:border-[#63C32E] focus:bg-white";

function Field({
  label,
  optional,
  placeholder,
  type = "text",
}: {
  label: string;
  optional?: boolean;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-sans text-[13px] font-semibold text-[#333833]">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-[#787F79]">(optional)</span>
        ) : null}
      </span>
      <input type={type} placeholder={placeholder} className={FIELD_CLASS} />
    </label>
  );
}

export function EnquiryForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // No backend for this marketing site yet — just confirm receipt client-side.
    setSubmitted(true);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {submitted ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="flex flex-col items-start gap-4 rounded-[40px] border border-[#E6E9E2] bg-white p-[38px] shadow-[0_24px_60px_rgba(30,35,32,.07)]"
        >
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: easeOut }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF8E5] font-sans text-xl font-bold text-[#3D8A14]"
          >
            ✓
          </motion.span>
          <span className="font-heading text-2xl font-semibold">
            Enquiry received
          </span>
          <p className="m-0 max-w-[46ch] font-sans text-[15px] leading-[1.7] text-[#646B65]">
            Thanks — we&apos;ll reply on WhatsApp within working hours, usually
            inside three hours. For anything urgent, message the dispatch line
            directly.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="rounded-full bg-[#63C32E] px-6 py-3.5 font-sans text-sm font-bold text-[#15250A] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
          >
            Send another enquiry
          </button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="flex flex-col gap-[30px] rounded-[40px] border border-[#E6E9E2] bg-white p-[38px] shadow-[0_24px_60px_rgba(30,35,32,.07)]"
        >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-5">
          <span className="font-heading text-2xl font-semibold tracking-[-0.02em]">
            Your details
          </span>
          <span className="font-sans text-xs font-medium text-[#787F79]">
            Required
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Full name" placeholder="e.g. Tarisai Moyo" />
          <Field label="WhatsApp number" placeholder="+263 …" type="tel" />
          <Field
            label="Email"
            optional
            placeholder="you@company.co.zw"
            type="email"
          />
          <Field
            label="Company"
            optional
            placeholder="Business or farm name"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[#ECEEE9] pt-[26px]">
        <div className="flex flex-wrap items-baseline justify-between gap-5">
          <span className="font-heading text-2xl font-semibold tracking-[-0.02em]">
            About the load
          </span>
          <span className="rounded-full bg-[#EFF8E5] px-3.5 py-1.5 font-sans text-xs font-semibold text-[#3D8A14]">
            All optional — skip what you don&apos;t know
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Unit load" placeholder="e.g. 30t maize in bags" />
          <Field
            label="Number of units"
            placeholder="e.g. 2 trailer loads"
          />
          <Field label="Start location" placeholder="e.g. Nyakamete, Mutare" />
          <Field label="Destination" placeholder="e.g. Beitbridge" />
          <Field label="Estimated distance" placeholder="e.g. 275 km" />
          <Field label="Departure date" placeholder="dd / mm / yyyy" type="date" />
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-sans text-[13px] font-semibold text-[#333833]">
            Anything else{" "}
            <span className="font-normal text-[#787F79]">(optional)</span>
          </span>
          <textarea
            placeholder="Access at the gate, offloading equipment, a question about rates…"
            rows={4}
            className={`${FIELD_CLASS} resize-none`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-5 border-t border-[#ECEEE9] pt-6">
        <span className="max-w-[34ch] font-sans text-[13px] leading-[1.6] text-[#787F79] text-balance">
          We reply on WhatsApp within working hours — usually inside three
          hours.
        </span>
        <button
          type="submit"
          className="rounded-full bg-[#63C32E] px-[30px] py-[17px] font-sans text-[15px] font-bold text-[#15250A] transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Send enquiry →
        </button>
      </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
