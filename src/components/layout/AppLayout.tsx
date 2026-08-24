import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
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
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [canManageSeats, setCanManageSeats] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    let cancelled = false;
    void supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .in("member_role", ["owner", "seat_manager"])
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setCanManageSeats(Boolean(data?.length));
      });
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) =>
        item.path.startsWith("/")
          ? item.path === homePath
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          : location.pathname.endsWith(`/${item.path}`),
      ),
    );
    setExpandedSection((current) => activeSection?.label ?? current ?? navSections[0]?.label ?? null);
  }, [homePath, location.pathname, navSections]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-account-menu]")) {
        setUserMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

  const accountMenu = (compact = false) => (
    <div className="relative" data-account-menu>
      <button
        type="button"
        onClick={() => setUserMenuOpen((open) => !open)}
        className={`account-trigger flex min-h-11 items-center rounded-lg ${
          compact ? "p-1" : "gap-3 px-2 py-1.5"
        }`}
        aria-expanded={userMenuOpen}
        aria-haspopup="menu"
        aria-label={userMenuOpen ? "Close account menu" : "Open account menu"}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200/70 text-xs font-bold text-brand-800 shadow-sm ring-1 ring-brand-200">
          {initials}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 text-left">
              <span className="block max-w-40 truncate text-xs font-semibold text-ink-900">
                {fullName}
              </span>
              <span className="block text-xs capitalize leading-4 text-ink-500">
                {activeRole}
              </span>
            </span>
            <ChevronDown size={14} className={`text-ink-400 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {userMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white/95 py-1.5 shadow-elevated backdrop-blur-xl motion-safe:animate-slide-up"
        >
          <div className="border-b border-ink-100 px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-ink-900">{fullName}</p>
            <p className="truncate text-xs leading-5 text-ink-500">{profile?.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setUserMenuOpen(false);
              navigate("/account/profile");
            }}
            className="menu-item"
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
              className="menu-item border-t border-ink-100"
            >
              <Building2 size={15} /> Company seats
            </button>
          )}
          {roles.length > 1 && (
            <div className="border-t border-ink-100 px-1.5 py-1">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink-400">
                Switch workspace
              </p>
              {roles.map((role) => (
                <button
                  type="button"
                  role="menuitem"
                  key={role}
                  onClick={() => switchRole(role)}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm capitalize transition-colors ${role === activeRole ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-700 hover:bg-brand-50 hover:text-brand-800"}`}
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
            className="flex min-h-10 w-full items-center gap-2.5 border-t border-ink-100 px-3 py-2 text-sm text-danger-600 transition-colors hover:bg-danger-50 hover:text-danger-700"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden bg-canvas">
      {/* Desktop Sidebar */}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 w-60 transform border-r border-white/[0.08] text-white shadow-[8px_0_30px_rgba(7,22,42,0.16)] transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="relative flex h-[4.5rem] items-center border-b border-white/[0.08] bg-white/[0.025] px-5 shadow-[0_1px_0_rgba(255,255,255,0.03)]">
            <img
              src="/brand/synergy-bahamas-logo-white.png"
              alt="Synergy Bahamas"
              width="2810"
              height="964"
              className="h-auto w-[7.75rem]"
            />
          </div>

          {/* Nav */}
          <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
            {navSections.map((section) => (
              <div key={section.label} className="mb-4">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSection((current) =>
                      current === section.label ? null : section.label,
                    )
                  }
                  className="mb-1 flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-expanded={expandedSection === section.label}
                >
                  {section.label}
                  {expandedSection === section.label ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <div className={`space-y-0.5 overflow-hidden ${expandedSection === section.label ? "block" : "hidden"}`}>
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
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="app-topbar flex h-[3.75rem] items-center justify-between px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <AcademyBrandMark compact />
          {accountMenu(true)}
        </header>

        {/* Desktop top bar */}
        <header className="app-topbar hidden h-[3.75rem] shrink-0 items-center justify-between px-7 lg:flex">
          <AcademyBrandMark />
          {accountMenu()}
        </header>

        {/* Page content */}
        <main className="app-main flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-[1400px] px-4 py-5 motion-safe:animate-fade-in sm:px-6 lg:px-7 lg:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
