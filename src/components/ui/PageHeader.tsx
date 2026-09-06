import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-ink-950">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-5 text-ink-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
