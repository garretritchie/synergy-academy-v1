import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getHomePathForRole } from "@/config/navigation";
import { readRoleView, resolveRoleView, roleFromPath, saveRoleView } from "@/lib/roleView";
import type { UserRole } from "@/types";

type RoleView = { activeRole: UserRole | null; switchRole: (role: UserRole) => void };
const RoleViewContext = createContext<RoleView | undefined>(undefined);

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const { user, profile, roles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [preference, setPreference] = useState<{ userId: string; role: UserRole } | null>(null);
  const preferred = user ? preference?.userId === user.id ? preference.role : readRoleView(user.id) : null;
  const activeRole = user && profile?.is_active ? resolveRoleView(roles, location.pathname, preferred) : null;

  useEffect(() => {
    if (user && activeRole && roleFromPath(location.pathname) === activeRole) {
      // Route wins on deep links and browser Back/Forward; retain it on shared pages.
      saveRoleView(user.id, activeRole);
      setPreference(current => current?.userId === user.id && current.role === activeRole ? current : { userId: user.id, role: activeRole });
    }
  }, [user, activeRole, location.pathname]);

  const switchRole = useCallback((role: UserRole) => {
    if (!user || !profile?.is_active || user.user_metadata?.must_change_password || !roles.includes(role)) return;
    saveRoleView(user.id, role);
    setPreference({ userId: user.id, role });
    navigate(getHomePathForRole(role));
  }, [user, profile?.is_active, roles, navigate]);
  const value = useMemo(() => ({ activeRole, switchRole }), [activeRole, switchRole]);
  return <RoleViewContext.Provider value={value}>{children}</RoleViewContext.Provider>;
}

// The hook intentionally shares its provider module.
// eslint-disable-next-line react-refresh/only-export-components
export function useRoleView() {
  const value = useContext(RoleViewContext);
  if (!value) throw new Error("useRoleView must be used within RoleViewProvider");
  return value;
}
