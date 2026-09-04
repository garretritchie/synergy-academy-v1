import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronDown, MoreHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { studentCourseNav } from "@/config/navigation";
import { FullPageSpinner } from "@/components/ui/Spinner";
import type { Cohort, Course } from "@/types";

const COURSE_PRIMARY_PATHS = new Set([
  "home",
  "learn",
  "assessments",
  "assignments",
]);

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

  const primaryNavItems = studentCourseNav.filter((item) =>
    COURSE_PRIMARY_PATHS.has(item.path),
  );
  const overflowNavItems = studentCourseNav.filter(
    (item) => !COURSE_PRIMARY_PATHS.has(item.path),
  );
  const moreMenuActive = overflowNavItems.some((item) =>
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
      <div className="border-b border-ink-200 bg-white/95 px-4 py-2.5 shadow-[0_1px_0_rgba(15,39,67,0.03)] backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            onClick={() => navigate("/student/courses")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-500 outline-none transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Back to My Courses"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-700 shadow-[0_1px_2px_rgba(19,56,92,0.08)]">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-950">
              {course?.title ?? "Course"}
            </p>
            <p className="text-xs text-ink-500">{cohort.name}</p>
          </div>
        </div>
      </div>

      {/* Responsive course navigation */}
      <div className="relative z-50 overflow-visible border-b border-ink-200 bg-white/95 px-4 lg:px-8">
        <nav
          className="mx-auto flex max-w-7xl items-center gap-1 overflow-visible py-1"
          aria-label="Course sections"
        >
          <div className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
            {studentCourseNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`/student/courses/${cohortId}/${item.path}`}
                  end={item.path === "home"}
                  className={({ isActive }) =>
                    `flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:hidden">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`/student/courses/${cohortId}/${item.path}`}
                  end={item.path === "home"}
                  className={({ isActive }) =>
                    `flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:text-sm ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-500 hover:bg-ink-100 hover:text-ink-700"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div ref={moreMenuRef} className="relative shrink-0 xl:hidden">
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
                className="absolute right-0 top-full z-[80] mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-elevated"
              >
                {overflowNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={`/student/courses/${cohortId}/${item.path}`}
                      role="menuitem"
                      className={({ isActive }) =>
                        `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
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
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(41,128,204,0.18),transparent_28rem),radial-gradient(circle_at_bottom_left,rgba(139,197,255,0.16),transparent_24rem),linear-gradient(180deg,#f5f9fd,#edf4fa)] scrollbar-thin">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
