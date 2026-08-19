import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useParams,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronDown, MoreHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { studentCourseNav } from "@/config/navigation";
import { FullPageSpinner } from "@/components/ui/Spinner";
import type { Cohort, Course } from "@/types";

export function CourseLayout({ children }: { children: ReactNode }) {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const primaryNavItems = studentCourseNav.slice(0, 4);
  const mediumNavItems = studentCourseNav.slice(4, 6);
  const overflowNavItems = [studentCourseNav[2], ...studentCourseNav.slice(4)];
  const moreMenuActive = studentCourseNav.slice(4).some((item) =>
    location.pathname.includes(`/${item.path}`),
  );

  useEffect(() => {
    if (!cohortId || !user) return;
    (async () => {
      const { data } = await supabase
        .from("cohorts")
        .select("*, course:courses(*)")
        .eq("id", cohortId)
        .maybeSingle();

      if (data) {
        setCohort(data as unknown as Cohort);
        setCourse((data as unknown as { course: Course }).course);
      }
      setLoading(false);
    })();
  }, [cohortId, user]);

  useEffect(() => {
    setMoreMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreMenuOpen]);

  if (loading) return <FullPageSpinner message="Loading course..." />;

  if (!cohort) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink-50">
        <div className="text-center">
          <BookOpen size={32} className="mx-auto text-ink-300" />
          <p className="mt-2 text-sm text-ink-500">Course not found.</p>
          <button
            onClick={() => navigate("/student/courses")}
            className="btn-secondary mt-4"
          >
            <ArrowLeft size={16} /> Back to My Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-ink-50">
      {/* Course header */}
      <div className="border-b border-ink-200 bg-white px-4 py-3 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            onClick={() => navigate("/student/courses")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
            aria-label="Back to My Courses"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {course?.title ?? "Course"}
            </p>
            <p className="text-xs text-ink-500">{cohort.name}</p>
          </div>
        </div>
      </div>

      {/* Responsive course navigation */}
      <div className="border-b border-ink-200 bg-white px-4 lg:px-8">
        <nav
          className="mx-auto flex max-w-7xl items-center gap-1 py-1"
          aria-label="Course sections"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const mobileLabel =
                item.path === "live"
                  ? "Live"
                  : item.path === "assignments"
                    ? "Work"
                    : item.label;
              return (
                <NavLink
                  key={item.path}
                  to={`/student/courses/${cohortId}/${item.path}`}
                  end={item.path === "home"}
                  className={({ isActive }) =>
                    `${item.path === "live" ? "hidden sm:flex" : "flex"} min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors sm:flex-none sm:px-3 sm:text-sm ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="truncate sm:hidden">{mobileLabel}</span>
                  <span className="hidden whitespace-nowrap sm:inline">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}

            {mediumNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`/student/courses/${cohortId}/${item.path}`}
                  className={({ isActive }) =>
                    `hidden min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors md:flex ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div ref={moreMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((open) => !open)}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 sm:px-3 sm:text-sm ${
                moreMenuActive || moreMenuOpen
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
              }`}
              aria-expanded={moreMenuOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
              <span>More</span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`hidden transition-transform sm:block ${moreMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {moreMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-elevated"
              >
                {overflowNavItems.map((item) => {
                  const Icon = item.icon;
                  const visibilityClass =
                    item.path === "live"
                      ? "flex sm:hidden"
                      : ["calendar", "performance"].includes(item.path)
                        ? "flex md:hidden"
                        : "flex";
                  return (
                    <NavLink
                      key={item.path}
                      to={`/student/courses/${cohortId}/${item.path}`}
                      role="menuitem"
                      className={({ isActive }) =>
                        `${visibilityClass} min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                        }`
                      }
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
