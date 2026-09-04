import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Library,
  Mail,
  Megaphone,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import type { Announcement, Cohort, Course, Enrolment } from "@/types";

type EnrolmentRow = Enrolment & { cohort: Cohort & { course: Course } };
type CourseChoice = {
  enrolment: EnrolmentRow;
  progress: number;
  gradeAverage: number | null;
  nextEvent: { title: string; date: string; type: string } | null;
  latestAnnouncement: Announcement | null;
};

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const firstName =
    profile?.first_name ||
    String(user?.user_metadata?.first_name || "").trim() ||
    "Student";
  const [courses, setCourses] = useState<CourseChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      setError("");
      const enrolmentResult = await supabase
        .from("enrolments")
        .select("*,cohort:cohorts(*,course:courses(*))")
        .eq("student_id", user.id)
        .eq("status", "active")
        .order("enrolled_at", { ascending: false });
      if (enrolmentResult.error) {
        setError(enrolmentResult.error.message);
        setLoading(false);
        return;
      }

      const enrolments = (enrolmentResult.data ??
        []) as unknown as EnrolmentRow[];
      if (!enrolments.length) {
        setCourses([]);
        setLoading(false);
        return;
      }
      const now = new Date().toISOString();
      const cohortIds = enrolments.map((item) => item.cohort_id);
      const enrolmentIds = enrolments.map((item) => item.id);
      const courseIds = enrolments.map((item) => item.cohort.course_id);
      const [
        lessonResult,
        progressResult,
        gradeResult,
        sessionResult,
        assignmentResult,
        announcementResult,
      ] = await Promise.all([
        supabase
          .from("lessons")
          .select("id,module:modules!inner(course_id)")
          .in("module.course_id", courseIds)
          .eq("is_published", true),
        supabase
          .from("progress_records")
          .select("enrolment_id,lesson_id,progress_percent")
          .in("enrolment_id", enrolmentIds),
        supabase
          .from("grades")
          .select("enrolment_id,percentage")
          .in("enrolment_id", enrolmentIds)
          .not("percentage", "is", null),
        supabase
          .from("live_sessions")
          .select("cohort_id,title,scheduled_start")
          .in("cohort_id", cohortIds)
          .eq("is_cancelled", false)
          .gte("scheduled_start", now)
          .order("scheduled_start"),
        supabase
          .from("assignments")
          .select("cohort_id,title,due_date")
          .in("cohort_id", cohortIds)
          .eq("is_published", true)
          .not("due_date", "is", null)
          .gte("due_date", now)
          .order("due_date"),
        supabase
          .from("announcements")
          .select("*")
          .in("cohort_id", cohortIds)
          .eq("is_published", true)
          .order("published_at", { ascending: false }),
      ]);
      const dashboardError =
        lessonResult.error ||
        progressResult.error ||
        gradeResult.error ||
        sessionResult.error ||
        assignmentResult.error ||
        announcementResult.error;
      if (dashboardError) {
        setError(dashboardError.message);
        setLoading(false);
        return;
      }
      const lessonRows = (lessonResult.data ?? []) as unknown as Array<{
        id: string;
        module: { course_id: string };
      }>;
      const progressResults = enrolments.map((enrolment) => {
        const courseLessonIds = lessonRows
          .filter(
            (lesson) => lesson.module.course_id === enrolment.cohort.course_id,
          )
          .map((lesson) => lesson.id);
        const records = (progressResult.data ?? []).filter(
          (record) => record.enrolment_id === enrolment.id,
        );
        const total = courseLessonIds.length || 1;
        const earned = records
          .filter((record) => courseLessonIds.includes(record.lesson_id))
          .reduce(
            (sum, record) => sum + Number(record.progress_percent ?? 0),
            0,
          );
        const scored = (gradeResult.data ?? []).filter(
          (grade) => grade.enrolment_id === enrolment.id,
        );
        const gradeAverage = scored.length
          ? Math.round(
              scored.reduce(
                (sum, grade) => sum + Number(grade.percentage ?? 0),
                0,
              ) / scored.length,
            )
          : null;
        const events = [
          ...(sessionResult.data ?? [])
            .filter((session) => session.cohort_id === enrolment.cohort_id)
            .map((session) => ({
              title: session.title,
              date: session.scheduled_start,
              type: "Live meeting",
            })),
          ...(assignmentResult.data ?? [])
            .filter(
              (assignment) => assignment.cohort_id === enrolment.cohort_id,
            )
            .map((assignment) => ({
              title: assignment.title,
              date: assignment.due_date || "",
              type: "Assignment due",
            })),
        ].sort(
          (left, right) =>
            new Date(left.date).getTime() - new Date(right.date).getTime(),
        );
        return {
          enrolment,
          progress: Math.min(100, Math.round(earned / total)),
          gradeAverage,
          nextEvent: events[0] ?? null,
          latestAnnouncement:
            ((announcementResult.data ?? []).find(
              (announcement) => announcement.cohort_id === enrolment.cohort_id,
            ) as Announcement | undefined) ?? null,
        };
      });
      setCourses(progressResults);
      setLoading(false);
    })();
  }, [user]);

  return (
    <AppLayout>
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 border-b border-ink-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl">
              Welcome, {firstName}.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-600">
              Choose a course to begin learning or continue where you stopped.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/student/messages" className="btn-secondary">
              <Mail size={16} /> Messages
            </Link>
            <Link to="/student/certificates" className="btn-secondary">
              <Award size={16} /> Certificates
            </Link>
          </div>
        </div>

        {!loading && courses.length > 0 && (
          <LearningAtGlance courses={courses} />
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink-950">
              Choose a course
            </h2>
            <Link
              to="/student/courses"
              className="text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              View course library
            </Link>
          </div>
          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}
          {loading ? (
            <div className="mt-5 rounded-xl bg-white shadow-soft">
              <TableSkeleton />
            </div>
          ) : courses.length === 0 ? (
            <div className="mt-5 rounded-xl bg-white shadow-soft">
              <EmptyState
                icon={<BookOpen size={30} />}
                title="No active courses"
                description="An administrator will enrol you in your first course."
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {courses.map(({ enrolment, progress }) => {
                const course = enrolment.cohort.course;
                return (
                  <article
                    key={enrolment.id}
                    className="group flex min-h-[25rem] flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-elevated"
                  >
                    <div className="relative aspect-[16/8] overflow-hidden bg-navy">
                      {course.cover_image_url ? (
                        <img
                          src={course.cover_image_url}
                          alt=""
                          className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-brand-200">
                          <Library size={42} />
                        </div>
                      )}
                      <span className="absolute left-4 top-4 rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-soft">
                        {String(course.metadata?.course_id || "Course")}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-lg font-semibold leading-6 text-ink-950">
                        {course.title}
                      </h3>
                      <p className="mt-2 text-sm text-ink-500">
                        {enrolment.cohort.name}
                      </p>
                      <div className="mt-auto pt-6">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-600">
                          <span>Course progress</span>
                          <span className="tabular-nums text-brand-700">
                            {progress}% complete
                          </span>
                        </div>
                        <ProgressBar value={progress} />
                        <Link
                          to={`/student/courses/${enrolment.cohort_id}/learn`}
                          className="btn-primary mt-5 w-full"
                        >
                          {progress > 0 ? "Continue course" : "Start course"}{" "}
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

function LearningAtGlance({ courses }: { courses: CourseChoice[] }) {
  return (
    <section className="mt-7 rounded-2xl border border-brand-100 bg-[linear-gradient(120deg,rgba(230,242,253,0.92),rgba(255,255,255,0.88))] p-5 shadow-soft sm:p-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-950">
          Your learning at a glance
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Performance, upcoming dates, and announcements stay labeled by course.
        </p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DashboardPanel icon={BarChart3} title="Performance">
          {courses.map((item) => (
            <DashboardRow
              key={item.enrolment.id}
              course={item.enrolment.cohort.course.title}
              primary={`${item.progress}% learning complete`}
              secondary={item.gradeAverage === null ? "Grade not available" : `${item.gradeAverage}% grade average`}
            />
          ))}
        </DashboardPanel>
        <DashboardPanel icon={CalendarDays} title="Upcoming">
          {courses.map((item) => (
            <DashboardRow
              key={item.enrolment.id}
              course={item.enrolment.cohort.course.title}
              primary={item.nextEvent?.title || "Nothing scheduled"}
              secondary={item.nextEvent ? `${item.nextEvent.type}, ${formatDateTime(item.nextEvent.date)}` : "Check back for course dates"}
            />
          ))}
        </DashboardPanel>
        <DashboardPanel icon={Megaphone} title="Announcements">
          {courses.map((item) => (
            <DashboardRow
              key={item.enrolment.id}
              course={item.enrolment.cohort.course.title}
              primary={item.latestAnnouncement?.title || "No announcements"}
              secondary={item.latestAnnouncement ? formatDateTime(item.latestAnnouncement.published_at) : "Your course is up to date"}
            />
          ))}
          <Link
            to="/student/messages?tab=announcements"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            View all in Messages <ArrowRight size={15} />
          </Link>
        </DashboardPanel>
      </div>
    </section>
  );
}

function DashboardPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BarChart3;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon size={18} />
        </span>
        <h3 className="font-semibold text-ink-950">{title}</h3>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function DashboardRow({
  course,
  primary,
  secondary,
}: {
  course: string;
  primary: string;
  secondary: string;
}) {
  return (
    <article className="rounded-xl bg-ink-50 px-3.5 py-3">
      <p className="line-clamp-1 text-xs font-semibold text-brand-700">
        {course}
      </p>
      <p className="mt-1 line-clamp-1 text-sm font-medium text-ink-900">
        {primary}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-500">
        {secondary}
      </p>
    </article>
  );
}
