import { GraduationCap } from "lucide-react";

interface AcademyBrandMarkProps {
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
}

export function AcademyBrandMark({
  tone = "dark",
  compact = false,
  className = "",
}: AcademyBrandMarkProps) {
  const primary = tone === "light" ? "text-white" : "text-ink-950";
  const secondary = tone === "light" ? "text-brand-200" : "text-brand-700";
  const tagline = tone === "light" ? "text-white/80" : "text-ink-600";

  return (
    <span
      className={`group inline-flex shrink-0 items-center ${compact ? "gap-2" : "gap-2.5"} ${className}`}
      aria-label="Synergy Academy. Skills for What’s Next."
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800 text-white shadow-brand-soft ring-1 transition-transform duration-200 group-hover:-translate-y-px ${
          tone === "light" ? "ring-white/20" : "ring-brand-700/10"
        } ${compact ? "h-7 w-7" : "h-8 w-8"}`}
        aria-hidden="true"
      >
        <GraduationCap size={compact ? 16 : 18} strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center leading-none">
          <span
            className={`${primary} font-display font-bold leading-none ${compact ? "text-[11px] tracking-[0.12em]" : "text-[13px] tracking-[0.14em]"}`}
          >
            SYNERGY
          </span>
          <span
            className={`mx-2 w-px bg-accent-400 ${compact ? "h-3.5" : "h-4"}`}
            aria-hidden="true"
          />
          <span
            className={`${secondary} font-display font-semibold leading-none ${compact ? "text-[10px] tracking-[0.12em]" : "text-xs tracking-[0.14em]"}`}
          >
            ACADEMY
          </span>
        </span>
        <span
          className={`${tagline} mt-1 whitespace-nowrap font-sans font-semibold leading-tight tracking-[0.01em] ${compact ? "text-[10px]" : "text-[11px]"}`}
        >
          Skills for What’s Next.
        </span>
      </span>
    </span>
  );
}
