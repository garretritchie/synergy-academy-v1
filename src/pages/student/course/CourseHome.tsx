import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Mail,
  Megaphone,
  Pin,
  TrendingUp,
  Video,
  X,
} from "lucide-react";
import { useLearningPath } from "@/hooks/useLearningPath";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, fullName } from "@/lib/format";
import type {
  Announcement,
  Assignment,
  Grade,
  LiveSession,
  Profile,
  ProgressRecord,
} from "@/types";

type InstructorRow = {
  id: string;
  is_lead: boolean;
  instructor: Profile;
};

export function CourseHome() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const path=useLearningPath(cohortId);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [selectedInstructor, setSelectedInstructor] =
    useState<InstructorRow | null>(null);
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
        instructorResult,
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
          .neq("assignment_type", "activity")
          .gte("due_date", now)
          .order("due_date"),
        supabase.from("grades").select("*").eq("enrolment_id", enrolment.id),
        supabase
          .from("announcements")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
        supabase
          .from("cohort_instructors")
          .select(
            "id,is_lead,instructor:profiles!cohort_instructors_instructor_id_fkey(*)",
          )
          .eq("cohort_id", cohortId)
          .order("is_lead", { ascending: false }),
      ]);
      const queryError =
        progressResult.error ||
        sessionResult.error ||
        assignmentResult.error ||
        gradeResult.error ||
        announcementResult.error ||
        releaseResult.error ||
        instructorResult.error;
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
        setInstructors(
          (instructorResult.data ?? []) as unknown as InstructorRow[],
        );
      }
      setLoading(false);
    })();
  }, [cohortId, user]);
  useEffect(() => {
    if (!selectedInstructor) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedInstructor(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedInstructor]);
  const completion = path.percentage;
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
            {announcement && (
              <section className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5 shadow-soft">
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-soft">
                    <Megaphone size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
                        Latest announcement
                      </p>
                      {announcement.is_pinned && (
                        <span className="badge-warning">
                          <Pin size={11} />
                          Pinned
                        </span>
                      )}
                      <span className="text-xs text-ink-500">
                        {formatDateTime(announcement.published_at)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-ink-950">
                      {announcement.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-ink-700">
                      {announcement.body}
                    </p>
                  </div>
                </div>
              </section>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                icon={TrendingUp}
                label="Learning progress"
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
            <section>
              <h2 className="text-xl font-semibold text-ink-950">
                Course workspace
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Everything for this course is organized into three clear areas.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <CourseArea
                  icon={BookOpen}
                  title="Learning"
                  description="Move naturally through Learn, Do, and Assess in one guided experience."
                  to={path.next?.href ?? `/student/courses/${cohortId}/learn`}
                />
                <CourseArea
                  icon={BrainCircuit}
                  title="Assessments"
                  description="Take graded checkpoints, the midterm, and the final exam."
                  to={`/student/courses/${cohortId}/assessments`}
                />
                <CourseArea
                  icon={ClipboardList}
                  title="Assignments"
                  description="Submit homework and build your capstone project."
                  to={`/student/courses/${cohortId}/assignments`}
                />
              </div>
            </section>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <section className="rounded-xl bg-white p-5 shadow-soft">
                <h2 className="font-semibold text-ink-900">Course progress</h2>
                <div className="mt-4">
                  <ProgressBar
                    value={completion}
                    showPercent
                    label={`${progress.filter((item) => item.status === "completed" && releasedLessonIds.includes(item.lesson_id)).length} of ${releasedLessonIds.length} learning modules completed`}
                  />
                </div>
                <Link
                  to={`/student/courses/${cohortId}/learn`}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-700"
                >
                  Continue learning <ArrowRight size={15} />
                </Link>
              </section>
              <section className="rounded-xl border border-ink-200/80 bg-white p-5 shadow-soft">
                <div className="flex items-center gap-2">
                  <GraduationCap size={18} className="text-brand-700" />
                  <h2 className="font-semibold text-ink-900">
                    Your instructors
                  </h2>
                </div>
                {instructors.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-500">
                    The teaching team will appear here.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {instructors.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl bg-ink-50 p-3 text-left outline-none transition-colors hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500"
                        onClick={() => setSelectedInstructor(row)}
                      >
                        <UserAvatar profile={row.instructor} decorative />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-900">
                            {fullName(row.instructor)}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-500">
                            {row.is_lead
                              ? "Lead instructor"
                              : "Course instructor"}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-brand-700">
                          Profile
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
            {selectedInstructor && (
              <div
                className="fixed inset-0 z-[90] flex items-center justify-center p-4"
                role="presentation"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-navy/45 backdrop-blur-sm"
                  aria-label="Close instructor profile"
                  onClick={() => setSelectedInstructor(null)}
                />
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="instructor-profile-title"
                  className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-elevated"
                >
                  <button
                    type="button"
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
                    aria-label="Close instructor profile"
                    onClick={() => setSelectedInstructor(null)}
                  >
                    <X size={18} />
                  </button>
                  <UserAvatar profile={selectedInstructor.instructor} size="lg" />
                  <p className="mt-4 text-xs font-semibold text-brand-700">
                    {selectedInstructor.is_lead
                      ? "Lead instructor"
                      : "Course instructor"}
                  </p>
                  <h2
                    id="instructor-profile-title"
                    className="mt-1 text-xl font-semibold text-ink-950"
                  >
                    {fullName(selectedInstructor.instructor)}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ink-600">
                    {selectedInstructor.instructor.bio ||
                      "This instructor supports students throughout the course."}
                  </p>
                  <a
                    href={`mailto:${selectedInstructor.instructor.email}`}
                    className="btn-secondary mt-5"
                  >
                    <Mail size={16} /> Email instructor
                  </a>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </CourseLayout>
  );
}
function CourseArea({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-ink-200/80 bg-white p-5 shadow-soft transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon size={20} />
      </span>
      <h3 className="mt-4 font-semibold text-ink-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        Open {title.toLowerCase()}{" "}
        <ArrowRight
          size={15}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
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
