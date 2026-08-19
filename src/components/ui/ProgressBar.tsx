interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent,
  size = "md",
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" };

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <span className="text-xs font-medium text-ink-600">{label}</span>
          )}
          {showPercent && (
            <span className="text-xs font-semibold text-ink-700">
              {percent}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full overflow-hidden rounded-full bg-ink-200/80 shadow-inner ring-1 ring-inset ring-ink-200 ${heights[size]}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
