import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, Clock3 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert } from "@/components/ui/Feedback";
import { FullPageSpinner } from "@/components/ui/Spinner";
import type { useCompanion } from "./useCompanion";
import { statusLabels, type ComponentSummary } from "./model";

export function CompanionShell({
  data,
  title,
  children,
  back,
  moduleContext,
}: {
  data: ReturnType<typeof useCompanion>;
  title: string;
  children: ReactNode;
  back?: string;
  moduleContext?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = `/student/courses/${data.cohortId}`;
  return (
    <AppLayout>
      <div className="companion-page">
        <div className="companion-heading">
          {back && (
            <Link className="btn-ghost" to={back}>
              <ArrowLeft size={16} />
              Back to module
            </Link>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1>{title}</h1>
              <p className="mt-2 text-ink-600">
                {data.course?.cohort.course.title ?? "Your course companion"}
              </p>
              {moduleContext && (
                <p className="mt-2 text-sm text-ink-600" role="status">
                  {moduleContext}
                </p>
              )}
            </div>
            {data.courses.length > 1 && (
              <label className="text-sm">
                Course
                <select
                  className="input mt-1"
                  value={data.cohortId}
                  onChange={(e) =>
                    navigate(
                      `${location.pathname.startsWith("/student/courses/") ? "/student" : location.pathname}?cohort=${e.target.value}`,
                    )
                  }
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.cohort_id}>
                      {c.cohort.course.title} · {c.cohort.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        {data.course && !back && (
          <nav className="companion-tabs" aria-label="Course sections">
            {[
              ["Overview", "home"],
              ["Modules", "modules"],
              ["Live Classes", "live"],
              ["Resources", "resources"],
            ].map(([label, path]) => (
              <NavLink key={path} className="course-tab" to={`${base}/${path}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        {data.loading ? (
          <FullPageSpinner message="Loading your course…" />
        ) : data.error ? (
          <div className="space-y-4">
            <Alert>{data.error}</Alert>
            <button
              className="btn-secondary"
              onClick={() => void data.refresh()}
            >
              Try again
            </button>
          </div>
        ) : !data.course ? (
          <div className="companion-empty">
            <h2>No course yet</h2>
            <p>Your course will appear here after enrolment.</p>
          </div>
        ) : !data.outline?.enabled ? (
          <div className="companion-empty">
            <h2>Your course is being prepared</h2>
            <p>
              Your instructor will make the new module companion available here.
            </p>
            <Link className="btn-secondary mt-4" to={`${base}/legacy-home`}>
              Open existing course
            </Link>
          </div>
        ) : (
          children
        )}
      </div>
    </AppLayout>
  );
}
export function ComponentState({ component }: { component: ComponentSummary }) {
  const Icon =
    component.status === "completed"
      ? CheckCircle2
      : component.status === "in_progress"
        ? Clock3
        : Circle;
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm ${component.status === "completed" ? "text-success-700" : "text-ink-500"}`}
    >
      <Icon size={17} />
      {statusLabels[component.status]}
    </span>
  );
}
