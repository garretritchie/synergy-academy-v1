import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  UserCheck,
  Video,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import type {
  Announcement,
  Assignment,
  Cohort,
  Course,
  Enrolment,
  LiveSession,
} from "@/types";

type EnrolmentRow = Enrolment & { cohort: Cohort & { course: Course } };
export function StudentDashboard() {
  const { user, profile } = useAuth();
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [metrics, setMetrics] = useState({
    progress: 0,
    grade: null as number | null,
    attendance: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: enrolmentError } = await supabase
        .from("enrolments")
        .select("*,cohort:cohorts(*,course:courses(*))")
        .eq("student_id", user.id)
        .eq("status", "active");
      if (enrolmentError) {
        setError(enrolmentError.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as unknown as EnrolmentRow[];
      setEnrolments(rows);
      const ids = rows.map((row) => row.cohort_id);
      if (ids.length) {
        const now = new Date().toISOString();
        const [sessionResult, assignmentResult, announcementResult] =
          await Promise.all([
            supabase
              .from("live_sessions")
              .select("*")
              .in("cohort_id", ids)
              .eq("is_cancelled", false)
              .gte("scheduled_start", now)
              .order("scheduled_start")
              .limit(1)
              .maybeSingle(),
            supabase
              .from("assignments")
              .select("*")
              .in("cohort_id", ids)
              .eq("is_published", true)
              .gte("due_date", now)
              .order("due_date")
              .limit(1)
              .maybeSingle(),
            supabase
              .from("announcements")
              .select("*")
              .in("cohort_id", ids)
              .eq("is_published", true)
              .order("published_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
        setSession(sessionResult.data as LiveSession | null);
        setAssignment(assignmentResult.data as Assignment | null);
        setAnnouncement(announcementResult.data as Announcement | null);

        const first = rows[0];
        const [releaseResult, progressResult, gradeResult, attendanceResult] =
          await Promise.all([
            supabase.rpc("get_released_lesson_ids", {
              cohort_uuid: first.cohort_id,
            }),
            supabase
              .from("progress_records")
              .select("lesson_id,progress_percent")
              .eq("enrolment_id", first.id),
            supabase
              .from("grades")
              .select("percentage")
              .eq("enrolment_id", first.id)
              .eq("is_excused", false),
            supabase
              .from("attendance_records")
              .select("status")
              .eq("student_id", user.id)
              .eq("cohort_id", first.cohort_id),
          ]);
        const released = (releaseResult.data ?? []) as string[];
        const progressRows = progressResult.data ?? [];
        const gradeRows = (gradeResult.data ?? []).filter(
          (grade) => grade.percentage !== null,
        );
        const attendanceRows = (attendanceResult.data ?? []).filter(
          (record) => record.status !== "excused",
        );
        setMetrics({
          progress: released.length
            ? Math.round(
                progressRows
                  .filter((record) => released.includes(record.lesson_id))
                  .reduce(
                    (sum, record) => sum + Number(record.progress_percent ?? 0),
                    0,
                  ) / released.length,
              )
            : 0,
          grade: gradeRows.length
            ? Math.round(
                gradeRows.reduce(
                  (sum, grade) => sum + Number(grade.percentage),
                  0,
                ) / gradeRows.length,
              )
            : null,
          attendance: attendanceRows.length
            ? Math.round(
                (attendanceRows.filter((record) =>
                  ["present", "late", "left_early"].includes(record.status),
                ).length /
                  attendanceRows.length) *
                  100,
              )
            : null,
        });
      }
      setLoading(false);
    })();
  }, [user]);
  return (
    <AppLayout>
      <PageHeader
        title={`Welcome back, ${profile?.first_name || "there"}`}
        subtitle="Pick up where you left off."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : enrolments.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<BookOpen size={30} />}
              title="No active courses"
              description="An administrator will enrol you into your first cohort."
            />
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-xl bg-ink-950 p-6 text-white shadow-elevated">
              <p className="text-sm text-brand-200">Continue learning</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {enrolments[0].cohort.course.title}
              </h2>
              <p className="mt-1 text-sm text-ink-300">
                {enrolments[0].cohort.name}
              </p>
              <Link
                to={`/student/courses/${enrolments[0].cohort_id}/learn`}
                className="btn-primary mt-6"
              >
                Open curriculum <ArrowRight size={16} />
              </Link>
            </section>
            <section
              aria-label="Current course status"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              <StatCard
                label="Released progress"
                value={`${metrics.progress}%`}
                icon={<BarChart3 size={19} />}
                hint="Current course"
              />
              <StatCard
                label="Grade average"
                value={metrics.grade === null ? "Not available" : `${metrics.grade}%`}
                icon={<CheckCircle2 size={19} />}
                accent="success"
              />
              <StatCard
                label="Attendance"
                value={
                  metrics.attendance === null ? "Not available" : `${metrics.attendance}%`
                }
                icon={<UserCheck size={19} />}
                accent="warning"
              />
              <StatCard
                label="Status"
                value={metrics.progress >= 100 ? "Caught up" : "In progress"}
                icon={<BookOpen size={19} />}
                accent={metrics.progress >= 100 ? "success" : "brand"}
              />
            </section>
            <div className="grid gap-5 lg:grid-cols-3">
              <DashboardItem
                icon={Video}
                title="Next live class"
                primary={session?.title || "Nothing scheduled"}
                secondary={
                  session
                    ? formatDateTime(session.scheduled_start)
                    : "Your instructor will publish sessions here."
                }
              />
              <DashboardItem
                icon={ClipboardList}
                title="Upcoming assignment"
                primary={assignment?.title || "No work due"}
                secondary={
                  assignment
                    ? `Due ${formatDateTime(assignment.due_date)}`
                    : "You are all caught up."
                }
              />
              <DashboardItem
                icon={Megaphone}
                title="Latest announcement"
                primary={announcement?.title || "No updates"}
                secondary={
                  announcement?.body || "Course updates will appear here."
                }
              />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
function DashboardItem({
  icon: Icon,
  title,
  primary,
  secondary,
}: {
  icon: typeof Video;
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2 text-brand-700">
        <Icon size={18} />
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      </div>
      <p className="mt-4 font-medium text-ink-900">{primary}</p>
      <p className="mt-1 text-sm leading-6 text-ink-500">{secondary}</p>
    </section>
  );
}
