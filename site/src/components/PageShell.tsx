import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[1320px] max-w-full bg-(--color-surface) text-(--color-ink)">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
