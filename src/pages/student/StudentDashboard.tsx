import { CourseProgress, CourseContinueButton } from "@/components/ui/CourseProgress";
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
        <div className="page-header">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-navy sm:text-3xl">
              Welcome, {firstName}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
              Choose a course to begin learning or continue where you stopped.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/student/messages" className="btn-secondary">
              <Mail size={16} /> Messages
            </Link>
            <Link to="/student/certificates" className="btn-ghost">
              <Award size={16} /> Certificates
            </Link>
          </div>
        </div>

        {!loading && courses.length > 0 && (
          <LearningAtGlance courses={courses} />
        )}

        <div className="mt-7">
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
            <div className={`mt-4 grid gap-5 ${courses.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
              {courses.map(({ enrolment }) => {
                const course = enrolment.cohort.course;
                return (
                  <article
                    key={enrolment.id}
                    className={`card group flex overflow-hidden ${courses.length === 1 ? "flex-col sm:flex-row" : "flex-col"}`}
                  >
                    <div className={`relative shrink-0 overflow-hidden bg-navy ${courses.length === 1 ? "h-44 sm:h-auto sm:w-64" : "h-36"}`}>
                      {course.cover_image_url ? (
                        <img
                          src={course.cover_image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center"
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
                    <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
                      <h3 className="font-display text-lg font-semibold leading-6 text-ink-950">
                        {course.title}
                      </h3>
                      <p className="mt-2 text-sm text-ink-500">
                        {enrolment.cohort.name}
                      </p>
                      <div className="mt-auto pt-5">
                        <CourseProgress cohortId={enrolment.cohort_id} compact/>
                        <div className="mt-4"><CourseContinueButton cohortId={enrolment.cohort_id}/></div>
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
    <section className="mt-6" aria-labelledby="learning-glance-heading">
      <div>
        <h2 id="learning-glance-heading" className="font-display text-lg font-semibold text-ink-950">
          Your learning at a glance
        </h2>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <DashboardPanel icon={BarChart3} title="Performance">
          {courses.map((item) => (
            <DashboardRow
              key={item.enrolment.id}
              course={item.enrolment.cohort.course.title}
              primary={<CourseProgress cohortId={item.enrolment.cohort_id} compact/>}
              secondary={item.gradeAverage === null ? "Grade not available" : `${item.gradeAverage}% grade average`}
            />
          ))}
        </DashboardPanel>
        <DashboardPanel icon={CalendarDays} title="Upcoming" tone="calendar">
          {courses.map((item) => (
            <DashboardRow
              key={item.enrolment.id}
              course={item.enrolment.cohort.course.title}
              primary={item.nextEvent?.title || "Nothing scheduled"}
              secondary={item.nextEvent ? `${item.nextEvent.type}, ${formatDateTime(item.nextEvent.date)}` : "Check back for course dates"}
            />
          ))}
        </DashboardPanel>
        <DashboardPanel icon={Megaphone} title="Announcements" tone="messages">
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
  tone,
}: {
  icon: typeof BarChart3;
  title: string;
  children: React.ReactNode;
  tone?: "calendar" | "messages";
}) {
  return (
    <section className="dashboard-panel" data-tone={tone}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone === 'calendar' ? 'bg-accent-100 text-accent-800' : tone === 'messages' ? 'bg-success-100 text-success-800' : 'bg-brand-100 text-brand-800'}`}>
          <Icon size={18} />
        </span>
        <h3 className="font-semibold text-ink-950">{title}</h3>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function DashboardRow({
  course,
  primary,
  secondary,
}: {
  course: string;
  primary: React.ReactNode;
  secondary: string;
}) {
  return (
    <article className="border-t border-ink-200/70 pt-3">
      <p className="line-clamp-1 text-xs font-semibold text-brand-700">
        {course}
      </p>
      <div className="mt-1 text-sm font-medium text-ink-900">
        {primary}
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-500">
        {secondary}
      </p>
    </article>
  );
}
