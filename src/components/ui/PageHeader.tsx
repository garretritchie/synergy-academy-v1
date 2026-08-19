import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="border-l-2 border-brand-600 pl-3">
        <h1 className="font-display text-xl font-semibold text-ink-950">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
