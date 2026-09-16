"use client";

import { useState } from "react";

export type FaqItem = { question: string; answer: string };

export function FaqAccordion({
  items,
  defaultOpenIndex = 1,
}: {
  items: FaqItem[];
  defaultOpenIndex?: number;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div
            key={item.question}
            className={`flex flex-col gap-3 rounded-[20px] ${
              open
                ? "bg-[#63C32E] px-5 py-5 text-[#15250A] sm:px-[26px] sm:py-6"
                : "border border-[#E6E9E2] bg-white px-5 py-4 text-[#333833] sm:px-[26px] sm:py-[22px]"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className={`flex w-full items-center justify-between gap-5 text-left font-sans ${
                open ? "text-base font-semibold" : "text-base font-medium"
              }`}
            >
              <span>{item.question}</span>
              <span className={`font-bold ${open ? "" : "text-[#3D8A14]"}`}>
                {open ? "−" : "+"}
              </span>
            </button>
            {open ? (
              <p className="m-0 max-w-[56ch] font-sans text-sm leading-[1.7] text-[#15250A]/80 text-balance">
                {item.answer}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
