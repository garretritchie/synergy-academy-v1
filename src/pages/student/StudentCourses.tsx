import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import type { Cohort, Course, Enrolment } from "@/types";

type CourseRow = Enrolment & {
  cohort: Cohort & { course: Course };
  progress_records: Array<{ progress_percent: number; status: string }>;
};
export function StudentCourses() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [releasedCounts, setReleasedCounts] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("enrolments")
        .select(
          "*,cohort:cohorts(*,course:courses(*)),progress_records(progress_percent,status)",
        )
        .eq("student_id", user.id)
        .order("enrolled_at", { ascending: false });
      if (queryError) setError(queryError.message);
      else {
        const courseRows = (data ?? []) as unknown as CourseRow[];
        setRows(courseRows);
        const releases = await Promise.all(
          courseRows.map((row) =>
            supabase.rpc("get_released_lesson_ids", {
              cohort_uuid: row.cohort_id,
            }),
          ),
        );
        setReleasedCounts(
          Object.fromEntries(
            courseRows.map((row, index) => [
              row.cohort_id,
              Array.isArray(releases[index].data)
                ? releases[index].data.length
                : 0,
            ]),
          ),
        );
      }
      setLoading(false);
    })();
  }, [user]);
  return (
    <AppLayout>
      <PageHeader
        title="My courses"
        subtitle="Your active learning, past cohorts, and completion status."
      />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<BookOpen size={30} />}
              title="No courses yet"
              description="Your courses will appear after an administrator enrols you into a cohort."
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => {
              const records = row.progress_records ?? [];
              const releasedCount = releasedCounts[row.cohort_id] ?? 0;
              const progress = releasedCount
                ? Math.min(
                    100,
                    Math.round(
                      records.reduce(
                        (sum, item) => sum + Number(item.progress_percent),
                        0,
                      ) / releasedCount,
                    ),
                  )
                : 0;
              return (
                <Link
                  key={row.id}
                  to={`/student/courses/${row.cohort_id}/home`}
                  className="group rounded-xl bg-white p-5 shadow-soft transition-shadow hover:shadow-elevated"
                >
                  <div className="flex gap-4">
                    {row.cohort.course.cover_image_url ? (
                      <img
                        src={row.cohort.course.cover_image_url}
                        alt=""
                        className="h-16 w-20 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <BookOpen size={22} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold text-ink-900 group-hover:text-brand-700">
                            {row.cohort.course.title}
                          </h2>
                          <p className="mt-0.5 text-sm text-ink-500">
                            {row.cohort.name}
                          </p>
                        </div>
                        <span
                          className={
                            row.status === "active"
                              ? "badge-success"
                              : "badge-neutral"
                          }
                        >
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-5">
                        <div className="mb-1.5 flex justify-between text-xs text-ink-500">
                          <span>{progress}% complete</span>
                          <span className="flex items-center gap-1">
                            <CalendarDays size={13} />
                            {formatDate(row.cohort.end_date)}
                          </span>
                        </div>
                        <ProgressBar value={progress} />
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-1 text-sm font-medium text-brand-700">
                        Open course <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
