import type { UserRole } from "@/types";

export const roleViewOrder: UserRole[] = ["administrator", "instructor", "student"];
export const roleViewLabels: Record<UserRole, string> = {
  administrator: "Administrator", instructor: "Instructor", student: "Student",
};

export type RoleViewPreference = { userId: string; loginSequence: number; role: UserRole };

export function resolveRolePreference(userId: string, loginSequence: number, preference: RoleViewPreference | null, stored: string | null): string | null {
  if (preference?.userId === userId && preference.loginSequence === loginSequence) return preference.role;
  // A new login ignores the last session's saved view; restoration can reuse it.
  return loginSequence > 0 ? null : stored;
}

export function roleFromPath(path: string): UserRole | null {
  const prefix = path.split("/")[1];
  return prefix === "admin" ? "administrator" : prefix === "instructor" || prefix === "student" ? prefix : null;
}

export function resolveRoleView(roles: UserRole[], path: string, preferred: string | null): UserRole | null {
  const routeRole = roleFromPath(path);
  if (routeRole && roles.includes(routeRole)) return routeRole;
  return roleViewOrder.find(role => role === preferred && roles.includes(role))
    ?? (roles.includes("student") ? "student" : null)
    ?? roleViewOrder.find(role => roles.includes(role)) ?? null;
}

export function readRoleView(userId: string): string | null {
  try { return localStorage.getItem(`academy-role-view:v1:${userId}`); }
  catch { return null; }
}

export function saveRoleView(userId: string, role: UserRole): void {
  try { localStorage.setItem(`academy-role-view:v1:${userId}`, role); }
  catch { /* Switching still works when browser storage is unavailable. */ }
}
