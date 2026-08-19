import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  RefreshCw,
  Building2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getNavForRole,
  getHomePathForRole,
  type NavSection,
} from "@/config/navigation";
import type { UserRole } from "@/types";
import { supabase } from "@/lib/supabase";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

interface AppLayoutProps {
  children: ReactNode;
  courseNav?: NavSection[];
}

export function AppLayout({ children, courseNav }: AppLayoutProps) {
  const { profile, roles, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [canManageSeats, setCanManageSeats] = useState(false);
  const navigate = useNavigate();

  const defaultRole: UserRole = roles.includes("administrator")
    ? "administrator"
    : roles.includes("instructor")
      ? "instructor"
      : "student";

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const saved = window.localStorage.getItem(
      "synergy-active-role",
    ) as UserRole | null;
    return saved ?? defaultRole;
  });

  useEffect(() => {
    if (!roles.includes(activeRole)) setActiveRole(defaultRole);
  }, [activeRole, defaultRole, roles]);

  useEffect(() => {
    if (!profile?.id) return;
    void supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .in("member_role", ["owner", "seat_manager"])
      .limit(1)
      .then(({ data }) => setCanManageSeats(Boolean(data?.length)));
  }, [profile?.id]);

  const navSections = courseNav ?? getNavForRole(activeRole);
  const homePath = getHomePathForRole(activeRole);

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "User";
  const initials =
    [profile?.first_name?.[0], profile?.last_name?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  const switchRole = (role: UserRole) => {
    window.localStorage.setItem("synergy-active-role", role);
    setActiveRole(role);
    setUserMenuOpen(false);
    navigate(getHomePathForRole(role));
  };

  const isCourseContext = !!courseNav;

  const accountMenu = (compact = false) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setUserMenuOpen((open) => !open)}
        className={`flex items-center rounded-lg border border-transparent transition-colors hover:border-ink-200 hover:bg-ink-50 ${
          compact ? "p-1" : "gap-3 px-2 py-1.5"
        }`}
        aria-expanded={userMenuOpen}
        aria-haspopup="menu"
        aria-label="Open account menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 ring-1 ring-brand-200">
          {initials}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 text-left">
              <span className="block max-w-40 truncate text-xs font-semibold text-ink-900">
                {fullName}
              </span>
              <span className="block text-[10px] capitalize text-ink-500">
                {activeRole}
              </span>
            </span>
            <ChevronDown size={14} className="text-ink-400" />
          </>
        )}
      </button>

      {userMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white py-1.5 shadow-elevated"
        >
          <div className="border-b border-ink-100 px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-ink-900">{fullName}</p>
            <p className="truncate text-[11px] text-ink-500">{profile?.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setUserMenuOpen(false);
              navigate("/account/profile");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink-700 hover:bg-ink-50"
          >
            <UserRound size={15} /> Profile and account
          </button>
          {canManageSeats && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setUserMenuOpen(false);
                navigate("/organization/seats");
              }}
              className="flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2 text-xs text-ink-700 hover:bg-ink-50"
            >
              <Building2 size={15} /> Company seats
            </button>
          )}
          {roles.length > 1 && (
            <div className="border-t border-ink-100 px-1.5 py-1">
              <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Switch workspace
              </p>
              {roles.map((role) => (
                <button
                  type="button"
                  role="menuitem"
                  key={role}
                  onClick={() => switchRole(role)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs capitalize ${role === activeRole ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50"}`}
                >
                  <RefreshCw size={14} /> {role}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2 text-xs text-danger-600 hover:bg-danger-50"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#f4f7fb]">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 transform border-r border-white/10 bg-[linear-gradient(160deg,#07162a_0%,#0b3f82_58%,#0066ff_135%)] text-white shadow-[8px_0_30px_rgba(7,22,42,0.12)] transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center border-b border-white/10 px-5">
            <img
              src="/brand/synergy-bahamas-logo-white.png"
              alt="Synergy Bahamas"
              className="h-auto w-32"
            />
          </div>

          {/* Nav */}
          <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
            {navSections.map((section, i) => (
              <div key={i} className="mb-4">
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const to = isCourseContext ? item.path : item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={to}
                        end={
                          item.path === homePath ||
                          (isCourseContext && item.path === "home")
                        }
                        className={({ isActive }) =>
                          `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon size={16} strokeWidth={1.8} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-ink-200/80 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <AcademyBrandMark compact />
          {accountMenu(true)}
        </header>

        {/* Desktop top bar */}
        <header className="hidden h-14 shrink-0 items-center justify-between border-b border-ink-200/80 bg-white px-7 lg:flex">
          <AcademyBrandMark />
          {accountMenu()}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
