import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  accent?: "brand" | "success" | "warning" | "danger" | "neutral";
}

const accentStyles: Record<string, { bg: string; text: string; line: string }> = {
  brand: { bg: "bg-brand-50", text: "text-brand-600", line: "via-brand-500" },
  success: { bg: "bg-success-50", text: "text-success-600", line: "via-success-500" },
  warning: { bg: "bg-warning-50", text: "text-warning-600", line: "via-warning-500" },
  danger: { bg: "bg-danger-50", text: "text-danger-600", line: "via-danger-500" },
  neutral: { bg: "bg-ink-100", text: "text-ink-600", line: "via-ink-400" },
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  accent = "brand",
}: StatCardProps) {
  const styles = accentStyles[accent];
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-ink-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink-950">{value}</p>
          {hint && <p className="mt-2 text-xs text-ink-500">{hint}</p>}
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.bg} ${styles.text}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
