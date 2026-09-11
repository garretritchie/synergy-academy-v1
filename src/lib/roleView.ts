import type { UserRole } from "@/types";

export const roleViewOrder: UserRole[] = ["administrator", "instructor", "student"];
export const roleViewLabels: Record<UserRole, string> = {
  administrator: "Administrator", instructor: "Instructor", student: "Student",
};

export function roleFromPath(path: string): UserRole | null {
  const prefix = path.split("/")[1];
  return prefix === "admin" ? "administrator" : prefix === "instructor" || prefix === "student" ? prefix : null;
}

export function resolveRoleView(roles: UserRole[], path: string, preferred: string | null): UserRole | null {
  const routeRole = roleFromPath(path);
  if (routeRole && roles.includes(routeRole)) return routeRole;
  return roleViewOrder.find(role => role === preferred && roles.includes(role))
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
