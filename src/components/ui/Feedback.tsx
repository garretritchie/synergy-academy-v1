import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-danger-200 bg-danger-50 text-danger-800"
      : tone === "success"
        ? "border-success-200 bg-success-50 text-success-800"
        : "border-brand-200 bg-brand-50 text-brand-800";
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-5 shadow-sm ${styles}`}
    >
      <Icon className="mt-0.5 shrink-0" size={16} />
      {children}
    </div>
  );
}

export function SubmitButton({
  loading,
  disabled,
  children,
  className = "",
}: {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`btn-primary ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-label="Loading" aria-live="polite">
      <div className="h-4 w-40 animate-pulse rounded bg-gradient-to-r from-ink-100 via-brand-50 to-ink-100" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg border border-ink-100 bg-gradient-to-r from-ink-50 via-white to-brand-50/40" />
      ))}
    </div>
  );
}
