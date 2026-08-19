import type { KeyboardEvent, ReactNode } from "react";

export interface PageTabOption<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function PageTabs<T extends string>({
  ariaLabel,
  baseId,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  baseId: string;
  value: T;
  options: PageTabOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex w-full flex-wrap gap-1 rounded-xl border border-ink-200 bg-ink-100/70 p-1 shadow-inner sm:w-fit"
    >
      {options.map((option, optionIndex) => {
        const active = option.id === value;
        const focusTab = (event: KeyboardEvent<HTMLButtonElement>, offset: number) => {
          event.preventDefault();
          const nextIndex = (optionIndex + offset + options.length) % options.length;
          const nextOption = options[nextIndex];
          onChange(nextOption.id);
          window.requestAnimationFrame(() => {
            document.getElementById(`${baseId}-${nextOption.id}-tab`)?.focus();
          });
        };
        return (
          <button
            key={option.id}
            id={`${baseId}-${option.id}-tab`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${baseId}-${option.id}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") focusTab(event, 1);
              if (event.key === "ArrowLeft") focusTab(event, -1);
              if (event.key === "Home") focusTab(event, -optionIndex);
              if (event.key === "End") focusTab(event, options.length - optionIndex - 1);
            }}
            className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-[background-color,color,box-shadow] sm:min-w-48 ${
              active
                ? "bg-white text-brand-800 shadow-sm ring-1 ring-ink-200/80"
                : "text-ink-500 hover:bg-white/60 hover:text-ink-800"
            }`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
            {typeof option.count === "number" && (
              <span className={active ? "badge-brand" : "badge-neutral"}>{option.count.toLocaleString()}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
