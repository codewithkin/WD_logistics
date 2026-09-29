"use client";

/**
 * The enquiry form.
 *
 * It used to be decoration: no field had a name, nothing was read on submit,
 * and `handleSubmit` simply flipped to "Enquiry received". Somebody who filled
 * it in was told their load had reached us when it had reached nobody. It
 * posts to a server action now, and only says received when the mail has
 * actually gone to operations and admin.
 */

import { AnimatePresence, motion } from "motion/react";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { submitEnquiry } from "@/app/actions/enquiry";
import { serviceLabel } from "@/lib/site";

const easeOut = [0.16, 1, 0.3, 1] as const;

const FIELD_CLASS =
  "rounded-2xl border border-[#E6E9E2] bg-[#F7F8F5] px-[18px] py-4 font-sans text-sm text-[#1E2320] placeholder:text-[#868C86] outline-none transition-colors focus:border-[#63C32E] focus:bg-white";

const FIELD_ERROR_CLASS =
  "rounded-2xl border border-[#C4362F] bg-[#FDF4F3] px-[18px] py-4 font-sans text-sm text-[#1E2320] placeholder:text-[#868C86] outline-none transition-colors focus:border-[#C4362F] focus:bg-white";

function Field({
  name,
  label,
  optional,
  placeholder,
  type = "text",
  invalid,
}: {
  name: string;
  label: string;
  optional?: boolean;
  placeholder: string;
  type?: string;
  invalid?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-sans text-[13px] font-semibold text-[#333833]">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-[#787F79]">(optional)</span>
        ) : null}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={invalid ? FIELD_ERROR_CLASS : FIELD_CLASS}
      />
    </label>
  );
}

/**
 * The service card they arrived from, read off the URL.
 *
 * In its own Suspense boundary because `useSearchParams` suspends while this
 * statically-rendered page hydrates. Without it the whole form would wait,
 * and the point of a static contact page is that the form is there
 * immediately.
 */
export function EnquiryForm() {
  return (
    <Suspense fallback={<EnquiryFormInner slug={null} service={null} />}>
      <WithService />
    </Suspense>
  );
}

function WithService() {
  const params = useSearchParams();
  const slug = params.get("service");
  const label = serviceLabel(slug);
  // Only pass the slug on if it resolved to something we recognise, so a
  // hand-edited query string cannot ride into the form.
  return <EnquiryFormInner slug={label ? slug : null} service={label} />;
}

/**
 * @param slug  What is posted — the action resolves it to a label itself, so
 *              the email never prints a string that came off the URL.
 * @param service  The label, for the person reading the page.
 */
function EnquiryFormInner({
  slug,
  service,
}: {
  slug?: string | null;
  service: string | null;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badField, setBadField] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const form = e.currentTarget;
    const data = new FormData(form);

    setSending(true);
    setError(null);
    setBadField(null);

    try {
      const result = await submitEnquiry(data);
      if (result.ok) {
        form.reset();
        setSubmitted(true);
      } else {
        setError(result.error ?? "That did not send. Please try again.");
        setBadField(result.field ?? null);
      }
    } catch {
      // A network failure rather than a refusal — same advice either way.
      setError(
        "That did not send. Please message us on WhatsApp instead — the number is at the top of this page.",
      );
    } finally {
      setSending(false);
    }
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
            Thanks — it is with our operations team now. We&apos;ll reply on
            WhatsApp within working hours, usually inside three hours. For
            anything urgent, message the dispatch line directly.
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
          noValidate
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="flex flex-col gap-[30px] rounded-[40px] border border-[#E6E9E2] bg-white p-[38px] shadow-[0_24px_60px_rgba(30,35,32,.07)]"
        >
          {/* Invisible to a person, and anything that fills it in is a bot. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />

          {service ? (
            <>
              <input type="hidden" name="service" value={slug ?? ""} />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EFF8E5] px-[18px] py-3.5">
                <span className="font-sans text-[13px] leading-[1.5] text-[#2B4A14]">
                  About{" "}
                  <span className="font-semibold text-[#15250A]">{service}</span>
                  . Change it below if that is not right.
                </span>
                <Link
                  href="/contact"
                  className="shrink-0 font-sans text-[13px] font-semibold text-[#3D8A14] underline decoration-[#3D8A14]/40 underline-offset-2 transition-colors hover:decoration-[#3D8A14]"
                >
                  Clear
                </Link>
              </div>
            </>
          ) : null}

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
          <Field
            name="name"
            label="Full name"
            placeholder="e.g. Tarisai Moyo"
            invalid={badField === "name"}
          />
          <Field
            name="phone"
            label="WhatsApp number"
            placeholder="+263 …"
            type="tel"
            invalid={badField === "phone"}
          />
          <Field
            name="email"
            label="Email"
            optional
            placeholder="you@company.co.zw"
            type="email"
            invalid={badField === "email"}
          />
          <Field
            name="company"
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
          <Field name="unitLoad" label="Unit load" placeholder="e.g. 30t maize in bags" />
          <Field
            name="units"
            label="Number of units"
            placeholder="e.g. 2 trailer loads"
          />
          <Field name="origin" label="Start location" placeholder="e.g. Nyakamete, Mutare" />
          <Field name="destination" label="Destination" placeholder="e.g. Beitbridge" />
          <Field name="distance" label="Estimated distance" placeholder="e.g. 275 km" />
          <Field name="departure" label="Departure date" placeholder="dd / mm / yyyy" type="date" />
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-sans text-[13px] font-semibold text-[#333833]">
            Anything else{" "}
            <span className="font-normal text-[#787F79]">(optional)</span>
          </span>
          <textarea
            name="notes"
            placeholder="Access at the gate, offloading equipment, a question about rates…"
            rows={4}
            className={`${FIELD_CLASS} resize-none`}
          />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="m-0 rounded-2xl bg-[#FDF4F3] px-[18px] py-4 font-sans text-[14px] leading-[1.6] text-[#8E2B25]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-5 border-t border-[#ECEEE9] pt-6">
        <span className="max-w-[34ch] font-sans text-[13px] leading-[1.6] text-[#787F79] text-balance">
          We reply on WhatsApp within working hours — usually inside three
          hours.
        </span>
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-[#63C32E] px-[30px] py-[17px] font-sans text-[15px] font-bold text-[#15250A] transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {sending ? "Sending…" : "Send enquiry →"}
        </button>
      </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
