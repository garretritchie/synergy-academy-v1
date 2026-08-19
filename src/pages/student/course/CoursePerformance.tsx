import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { AttendanceRecord, Grade, ProgressRecord } from "@/types";

type GradeRow = Grade & {
  grade_item: {
    name: string;
    grade_category: { name: string; weight: number };
  };
};
export function CoursePerformance() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId || !user) return;
    void (async () => {
      const { data: enrolment, error: enrolmentError } = await supabase
        .from("enrolments")
        .select("id")
        .eq("cohort_id", cohortId)
        .eq("student_id", user.id)
        .single();
      if (enrolmentError) {
        setError(enrolmentError.message);
        setLoading(false);
        return;
      }
      const [gradeResult, attendanceResult, progressResult, releaseResult] =
        await Promise.all([
          supabase
            .from("grades")
            .select(
              "*,grade_item:grade_items(name,grade_category:grade_categories(name,weight))",
            )
            .eq("enrolment_id", enrolment.id),
          supabase
            .from("attendance_records")
            .select("*")
            .eq("enrolment_id", enrolment.id),
          supabase
            .from("progress_records")
            .select("*")
            .eq("enrolment_id", enrolment.id),
          supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
        ]);
      const queryError =
        gradeResult.error ||
        attendanceResult.error ||
        progressResult.error ||
        releaseResult.error;
      if (queryError) setError(queryError.message);
      else {
        setGrades((gradeResult.data ?? []) as unknown as GradeRow[]);
        setAttendance((attendanceResult.data ?? []) as AttendanceRecord[]);
        setProgress((progressResult.data ?? []) as ProgressRecord[]);
        setReleasedLessonIds((releaseResult.data ?? []) as string[]);
      }
      setLoading(false);
    })();
  }, [cohortId, user]);
  const average = useMemo(() => {
    const scored = grades.filter((item) => item.percentage != null);
    if (!scored.length) return 0;
    const grouped = new Map<
      string,
      { total: number; count: number; weight: number }
    >();
    scored.forEach((grade) => {
      const category = grade.grade_item.grade_category;
      const current = grouped.get(category.name) ?? {
        total: 0,
        count: 0,
        weight: Number(category.weight),
      };
      current.total += Number(grade.percentage);
      current.count += 1;
      grouped.set(category.name, current);
    });
    const categories = Array.from(grouped.values());
    const totalWeight = categories.reduce(
      (sum, category) => sum + Math.max(0, category.weight),
      0,
    );
    if (totalWeight > 0)
      return Math.round(
        categories.reduce(
          (sum, category) =>
            sum +
            (category.total / category.count) *
              (Math.max(0, category.weight) / totalWeight),
          0,
        ),
      );
    return Math.round(
      scored.reduce((sum, item) => sum + Number(item.percentage), 0) /
        scored.length,
    );
  }, [grades]);
  const completion = releasedLessonIds.length
    ? Math.round(
        progress
          .filter((item) => releasedLessonIds.includes(item.lesson_id))
          .reduce((sum, item) => sum + Number(item.progress_percent), 0) /
          releasedLessonIds.length,
      )
    : 0;
  const recordedAttendance = attendance.filter(
    (item) => item.status !== "excused",
  );
  const present = recordedAttendance.filter((item) =>
    ["present", "late", "left_early"].includes(item.status),
  ).length;
  const attendanceRate = recordedAttendance.length
    ? Math.round((present / recordedAttendance.length) * 100)
    : 0;
  return (
    <CourseLayout>
      <PageHeader
        title="Performance"
        subtitle="Your private progress, attendance, and grades."
      />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric
                icon={TrendingUp}
                label="Lesson progress"
                value={`${completion}%`}
              />
              <Metric
                icon={BarChart3}
                label="Grade average"
                value={grades.length ? `${average}%` : "Not available"}
              />
              <Metric
                icon={Clock3}
                label="Attendance"
                value={attendance.length ? `${attendanceRate}%` : "Not available"}
              />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl bg-white p-5 shadow-soft">
                <h2 className="font-semibold text-ink-900">Course progress</h2>
                <div className="mt-4">
                  <ProgressBar
                    value={completion}
                    label={`${progress.filter((item) => item.status === "completed" && releasedLessonIds.includes(item.lesson_id)).length} of ${releasedLessonIds.length} released lessons completed`}
                    showPercent
                  />
                </div>
              </section>
              <section className="rounded-xl bg-white p-5 shadow-soft">
                <h2 className="font-semibold text-ink-900">Gradebook</h2>
                {grades.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-500">
                    No grades have been posted.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-ink-100">
                    {grades.map((grade) => (
                      <div
                        key={grade.id}
                        className="flex items-center gap-3 py-3"
                      >
                        <CheckCircle2 size={17} className="text-success-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-900">
                            {grade.grade_item.name}
                          </p>
                          <p className="text-xs text-ink-500">
                            {grade.grade_item.grade_category.name}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-ink-900">
                          {grade.percentage === null ? "Not available" : `${grade.percentage}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </CourseLayout>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{label}</p>
        <Icon size={18} className="text-brand-600" />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-ink-900">
        {value}
      </p>
    </div>
  );
}
