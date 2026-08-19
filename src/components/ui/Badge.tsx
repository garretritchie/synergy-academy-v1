import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "brand" | "success" | "warning" | "danger" | "neutral";
  className?: string;
}

const variants: Record<string, string> = {
  brand: "bg-brand-100 text-brand-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
  neutral: "bg-ink-100 text-ink-600",
};

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
