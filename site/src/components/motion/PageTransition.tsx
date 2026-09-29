"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    /* Every animation on the site runs under here — the page transition, the
       reveals, the staggered cards, the form and the FAQ. Only the marquee
       honoured "reduce motion" (it is CSS, and globals.css turns it off);
       everything else kept sliding, which is the half of the site that moves
       most. reducedMotion="user" leaves opacity alone and drops the movement,
       so the content still fades in rather than appearing from nothing. */
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className="w-full"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
