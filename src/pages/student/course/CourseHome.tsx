import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  TrendingUp,
  Video,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import type {
  Announcement,
  Assignment,
  Grade,
  LiveSession,
  ProgressRecord,
} from "@/types";

export function CourseHome() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
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
      const now = new Date().toISOString();
      const [
        progressResult,
        sessionResult,
        assignmentResult,
        gradeResult,
        announcementResult,
        releaseResult,
      ] = await Promise.all([
        supabase
          .from("progress_records")
          .select("*")
          .eq("enrolment_id", enrolment.id),
        supabase
          .from("live_sessions")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("is_cancelled", false)
          .gte("scheduled_start", now)
          .order("scheduled_start")
          .limit(1),
        supabase
          .from("assignments")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("is_published", true)
          .gte("due_date", now)
          .order("due_date"),
        supabase.from("grades").select("*").eq("enrolment_id", enrolment.id),
        supabase
          .from("announcements")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("is_published", true)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
      ]);
      const queryError =
        progressResult.error ||
        sessionResult.error ||
        assignmentResult.error ||
        gradeResult.error ||
        announcementResult.error ||
        releaseResult.error;
      if (queryError) setError(queryError.message);
      else {
        setProgress((progressResult.data ?? []) as ProgressRecord[]);
        setSessions((sessionResult.data ?? []) as LiveSession[]);
        setAssignments((assignmentResult.data ?? []) as Assignment[]);
        setGrades((gradeResult.data ?? []) as Grade[]);
        setAnnouncement(
          (announcementResult.data as Announcement | null) ?? null,
        );
        setReleasedLessonIds((releaseResult.data ?? []) as string[]);
      }
      setLoading(false);
    })();
  }, [cohortId, user]);
  const completion = useMemo(
    () =>
      releasedLessonIds.length
        ? Math.round(
            progress
              .filter((item) => releasedLessonIds.includes(item.lesson_id))
              .reduce((sum, item) => sum + Number(item.progress_percent), 0) /
              releasedLessonIds.length,
          )
        : 0,
    [progress, releasedLessonIds],
  );
  const average = useMemo(
    () =>
      grades.length
        ? Math.round(
            grades.reduce(
              (sum, item) => sum + Number(item.percentage ?? 0),
              0,
            ) / grades.length,
          )
        : 0,
    [grades],
  );
  const next = sessions[0];
  return (
    <CourseLayout>
      <PageHeader
        title="Course home"
        subtitle="Your next actions and current standing."
      />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                icon={TrendingUp}
                label="Lesson progress"
                value={`${completion}%`}
              />
              <Metric
                icon={Video}
                label="Next session"
                value={
                  next ? formatDateTime(next.scheduled_start) : "Not scheduled"
                }
                compact
              />
              <Metric
                icon={ClipboardList}
                label="Assignments due"
                value={String(assignments.length)}
              />
              <Metric
                icon={CheckCircle2}
                label="Grade average"
                value={grades.length ? `${average}%` : "Not available"}
              />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl bg-white p-5 shadow-soft">
                <h2 className="font-semibold text-ink-900">Course progress</h2>
                <div className="mt-4">
                  <ProgressBar
                    value={completion}
                    showPercent
                    label={`${progress.filter((item) => item.status === "completed" && releasedLessonIds.includes(item.lesson_id)).length} of ${releasedLessonIds.length} released lessons completed`}
                  />
                </div>
                <Link
                  to={`/student/courses/${cohortId}/learn`}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-700"
                >
                  Continue learning <ArrowRight size={15} />
                </Link>
              </section>
              <section className="rounded-xl bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2">
                  <Megaphone size={18} className="text-brand-600" />
                  <h2 className="font-semibold text-ink-900">
                    Latest announcement
                  </h2>
                </div>
                {announcement ? (
                  <>
                    <h3 className="mt-4 font-medium text-ink-900">
                      {announcement.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-ink-600">
                      {announcement.body}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-ink-500">
                    No announcements have been posted.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </CourseLayout>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  compact,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{label}</p>
        <Icon size={18} className="text-brand-600" />
      </div>
      <p
        className={`mt-3 font-semibold text-ink-900 ${compact ? "text-sm leading-6" : "text-3xl tabular-nums"}`}
      >
        {value}
      </p>
    </div>
  );
}
