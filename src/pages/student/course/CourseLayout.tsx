import { useEffect, useState, type ReactNode } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { studentCourseNav } from "@/config/navigation";
import { FullPageSpinner } from "@/components/ui/Spinner";
import type { Cohort, Course } from "@/types";

export function CourseLayout({ children }: { children: ReactNode }) {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [course, setCourse] = useState<Course | null>(null);

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
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
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

      {/* Course nav tabs */}
      <div className="border-b border-ink-200 bg-white px-4 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
            {studentCourseNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={`/student/courses/${cohortId}/${item.path}`}
                  end={item.path === "home"}
                  className={({ isActive }) =>
                    `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
        </div>
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
