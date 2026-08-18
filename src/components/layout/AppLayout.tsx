import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, ChevronDown, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNavForRole, getHomePathForRole, type NavSection } from '@/config/navigation';
import type { UserRole } from '@/types';

interface AppLayoutProps {
  children: ReactNode;
  courseNav?: NavSection[];
}

export function AppLayout({ children, courseNav }: AppLayoutProps) {
  const { profile, roles, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const primaryRole: UserRole = roles.includes('administrator')
    ? 'administrator'
    : roles.includes('instructor')
      ? 'instructor'
      : 'student';

  const navSections = courseNav ?? getNavForRole(primaryRole);
  const homePath = getHomePathForRole(primaryRole);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const isCourseContext = !!courseNav;

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-ink-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2.5 border-b border-ink-200 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink-900">Synergy Academy</p>
              <p className="text-xs text-ink-500">by Synergy Bahamas</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
            {navSections.map((section, i) => (
              <div key={i} className="mb-4">
                <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const to = isCourseContext
                      ? item.path
                      : item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={to}
                        end={item.path === homePath || (isCourseContext && item.path === 'home')}
                        className={({ isActive }) =>
                          `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                        }
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User card at bottom */}
          <div className="border-t border-ink-200 p-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-ink-100"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {initials}
                </div>
                <div className="flex-1 text-left">
                  <p className="truncate text-sm font-medium text-ink-900">{fullName}</p>
                  <p className="text-xs capitalize text-ink-500">{primaryRole}</p>
                </div>
                <ChevronDown size={16} className="text-ink-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-ink-200 bg-white py-1 shadow-elevated">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-600 hover:bg-danger-50"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
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
        <header className="flex h-16 items-center justify-between border-b border-ink-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <GraduationCap size={18} />
            </div>
            <span className="text-sm font-bold text-ink-900">Synergy Academy</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
