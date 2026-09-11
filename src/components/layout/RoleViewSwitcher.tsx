import { ArrowLeftRight } from "lucide-react";
import { roleViewLabels, roleViewOrder } from "@/lib/roleView";
import type { UserRole } from "@/types";

export function RoleViewSwitcher({ roles, activeRole, onChange }: {
  roles: UserRole[]; activeRole: UserRole | null; onChange: (role: UserRole) => void;
}) {
  const available = roleViewOrder.filter(role => roles.includes(role));
  if (available.length < 2 || !activeRole || !available.includes(activeRole)) return null;
  return <label className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-brand-800">
    <ArrowLeftRight size={15} aria-hidden="true" className="hidden sm:block" />
    <span className="hidden text-xs font-medium xl:block">View</span>
    <select aria-label="Switch role view" title="Switch between your assigned role views" value={activeRole}
      onChange={event => { const role = available.find(item => item === event.target.value); if (role) onChange(role); }}
      className="min-h-11 max-w-40 cursor-pointer rounded bg-transparent py-1 text-sm font-semibold text-brand-800 outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      {available.map(role => <option key={role} value={role}>{roleViewLabels[role]}</option>)}
    </select>
  </label>;
}
