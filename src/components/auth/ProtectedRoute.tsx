import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { FullPageSpinner } from "@/components/ui/Spinner";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, profile, roles, loading } = useAuth();

  if (loading) return <FullPageSpinner message="Loading your workspace..." />;

  if (!user) return <Navigate to="/signin" replace />;

  if (user.user_metadata?.must_change_password) {
    return <Navigate to="/reset-password?temporary=1" replace />;
  }

  if (profile && !profile.is_active) return <Navigate to="/pending" replace />;

  if (!roles.length) return <Navigate to="/pending" replace />;

  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r))) {
    const homePath = roles.includes("administrator")
      ? "/admin"
      : roles.includes("instructor")
        ? "/instructor"
        : "/student";
    return <Navigate to={homePath} replace />;
  }

  return <>{children}</>;
}
