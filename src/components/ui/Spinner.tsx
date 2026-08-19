import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className = "" }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-brand-500 ${className}`}
      aria-hidden="true"
    />
  );
}

export function FullPageSpinner({ message }: { message?: string }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-gradient-to-b from-brand-50/70 via-ink-50 to-white"
      role="status"
      aria-label={message ?? "Loading"}
      aria-live="polite"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 bg-white shadow-card"><Spinner size={30} /></div>
      {message && <p className="text-sm text-ink-500">{message}</p>}
    </div>
  );
}

export function CardSpinner() {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-label="Loading" aria-live="polite">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100"><Spinner size={24} /></div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_20%,rgba(220,236,255,0.45),transparent_13rem)] px-5 py-12 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-100 bg-gradient-to-br from-white to-brand-50 text-brand-600 shadow-soft">{icon}</div>}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-ink-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
