export function PhotoPlaceholder({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`photo-placeholder flex items-end rounded-[6px] p-5 ${className}`}
    >
      <span className="rounded-[4px] bg-(--color-surface) px-3 py-2 font-mono text-[11px] leading-none tracking-[0.08em] text-(--color-label)">
        {label}
      </span>
    </div>
  );
}
