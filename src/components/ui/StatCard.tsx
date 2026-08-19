import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  accent?: "brand" | "success" | "warning" | "danger" | "neutral";
}

const accentStyles: Record<string, { bg: string; text: string }> = {
  brand: { bg: "bg-brand-50", text: "text-brand-600" },
  success: { bg: "bg-success-50", text: "text-success-600" },
  warning: { bg: "bg-warning-50", text: "text-warning-600" },
  danger: { bg: "bg-danger-50", text: "text-danger-600" },
  neutral: { bg: "bg-ink-100", text: "text-ink-600" },
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
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-ink-500">{label}</p>
          <p className="mt-1.5 font-display text-xl font-semibold tabular-nums text-ink-950">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        {icon && (
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.bg} ${styles.text}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
