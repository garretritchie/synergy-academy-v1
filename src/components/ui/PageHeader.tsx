import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="relative flex flex-col gap-4 border-b border-ink-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="relative pl-4">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-gradient-to-b from-brand-400 via-brand-600 to-brand-800 shadow-[0_0_14px_rgba(45,138,228,0.28)]"
        />
        <h1 className="font-display text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] text-ink-950">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-[13px] leading-5 text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
