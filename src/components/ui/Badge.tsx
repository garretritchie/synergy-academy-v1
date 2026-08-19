import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "brand" | "success" | "warning" | "danger" | "neutral";
  className?: string;
}

const variants: Record<string, string> = {
  brand: "border-brand-200/80 bg-brand-50 text-brand-700",
  success: "border-success-200/80 bg-success-50 text-success-700",
  warning: "border-warning-200/80 bg-warning-50 text-warning-700",
  danger: "border-danger-200/80 bg-danger-50 text-danger-700",
  neutral: "border-ink-200 bg-ink-50 text-ink-600",
};

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
