import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";

export function FormPanel({
  title,
  description,
  open,
  onToggle,
  children,
  actionLabel = "Add new",
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-xl bg-white shadow-soft">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-500">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={open ? "btn-ghost" : "btn-primary"}
        >
          {open ? <X size={16} /> : <Plus size={16} />}
          {open ? "Close" : actionLabel}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink-100 px-5 py-5">{children}</div>
      )}
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
