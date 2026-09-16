import type { CSSProperties, ReactNode } from "react";

const STRIPES = {
  neutral: ["#EBECE8", "#DEE0DB"],
  card: ["#EFF0EC", "#E3E5E0"],
  tint: ["#E4EFD6", "#D8E6C6"],
} as const;

type StripeVariant = keyof typeof STRIPES;

export function PhotoPlaceholder({
  label,
  variant = "neutral",
  stripe = 12,
  className = "",
  labelClassName = "",
  style,
  children,
}: {
  label: string;
  variant?: StripeVariant;
  stripe?: number;
  className?: string;
  labelClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const [c1, c2] = STRIPES[variant];
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: `repeating-linear-gradient(135deg, ${c1} 0 ${stripe}px, ${c2} ${stripe}px ${stripe * 2}px)`,
        ...style,
      }}
    >
      <span
        className={`inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-mono text-[11px] tracking-[0.08em] text-[#6A716B] ${labelClassName}`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
