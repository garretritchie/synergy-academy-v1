import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, CheckCircle2, ClipboardList, Mail, Megaphone, UserCheck, Video } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { supabase } from "@/lib/supabase";
import { formatDateTime, fullName } from "@/lib/format";
import type { Announcement, Assignment, AttendanceRecord, Cohort, Course, DirectMessage, Enrolment, Grade, LiveSession, Notification, Profile, ProgressRecord } from "@/types";

type EnrolmentRow = Enrolment & { cohort: Cohort & { course: Course } };
type CourseMetric = { enrolment: EnrolmentRow; progress: number; grade: number | null; attendance: number | null };
type MessageRow = DirectMessage & { sender: Profile };

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<CourseMetric[]>([]);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
        .eq("status", "active");
      if (enrolmentResult.error) {
        setError(enrolmentResult.error.message);
        setLoading(false);
        return;
      }
      const enrolments = (enrolmentResult.data ?? []) as unknown as EnrolmentRow[];
      if (!enrolments.length) {
        setCourses([]);
        setLoading(false);
        return;
      }

      const enrolmentIds = enrolments.map((row) => row.id);
      const cohortIds = enrolments.map((row) => row.cohort_id);
      const courseIds = Array.from(new Set(enrolments.map((row) => row.cohort.course_id)));
      const now = new Date().toISOString();
      const [moduleResult, progressResult, gradeResult, attendanceResult, sessionResult, assignmentResult, announcementResult, messageResult, notificationResult] = await Promise.all([
        supabase.from("modules").select("id,course_id").in("course_id", courseIds).eq("is_published", true),
        supabase.from("progress_records").select("*").in("enrolment_id", enrolmentIds),
        supabase.from("grades").select("*").in("enrolment_id", enrolmentIds).eq("is_excused", false),
        supabase.from("attendance_records").select("*").in("enrolment_id", enrolmentIds),
        supabase.from("live_sessions").select("*").in("cohort_id", cohortIds).eq("is_cancelled", false).gte("scheduled_start", now).order("scheduled_start").limit(1).maybeSingle(),
        supabase.from("assignments").select("*").in("cohort_id", cohortIds).eq("is_published", true).or(`due_date.is.null,due_date.gte.${now}`).order("due_date", { ascending: true, nullsFirst: false }).limit(1).maybeSingle(),
        supabase.from("announcements").select("*").in("cohort_id", cohortIds).eq("is_published", true).order("published_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("direct_messages").select("*,sender:profiles!direct_messages_sender_id_fkey(*)").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      ]);
      const firstError = moduleResult.error || progressResult.error || gradeResult.error || attendanceResult.error || sessionResult.error || assignmentResult.error || announcementResult.error || notificationResult.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const modules = moduleResult.data ?? [];
      const lessonResult = modules.length
        ? await supabase.from("lessons").select("id,module_id").in("module_id", modules.map((module) => module.id)).eq("is_published", true)
        : { data: [], error: null };
      if (lessonResult.error) {
        setError(lessonResult.error.message);
        setLoading(false);
        return;
      }
      const moduleCourse = new Map(modules.map((module) => [module.id, module.course_id]));
      const lessonCounts = new Map<string, number>();
      for (const lesson of lessonResult.data ?? []) {
        const courseId = moduleCourse.get(lesson.module_id);
        if (courseId) lessonCounts.set(courseId, (lessonCounts.get(courseId) ?? 0) + 1);
      }
      const progress = (progressResult.data ?? []) as ProgressRecord[];
      const grades = (gradeResult.data ?? []) as Grade[];
      const attendance = (attendanceResult.data ?? []) as AttendanceRecord[];
      setCourses(enrolments.map((enrolment) => {
        const courseProgress = progress.filter((record) => record.enrolment_id === enrolment.id);
        const totalLessons = lessonCounts.get(enrolment.cohort.course_id) ?? 0;
        const learnerGrades = grades.filter((grade) => grade.enrolment_id === enrolment.id && grade.percentage !== null);
        const learnerAttendance = attendance.filter((record) => record.enrolment_id === enrolment.id && record.status !== "excused");
        return {
          enrolment,
          progress: totalLessons ? Math.min(100, Math.round(courseProgress.reduce((sum, record) => sum + Number(record.progress_percent ?? 0), 0) / totalLessons)) : 0,
          grade: learnerGrades.length ? Math.round(learnerGrades.reduce((sum, grade) => sum + Number(grade.percentage), 0) / learnerGrades.length) : null,
          attendance: learnerAttendance.length ? Math.round((learnerAttendance.filter((record) => ["present", "late", "left_early"].includes(record.status)).length / learnerAttendance.length) * 100) : null,
        };
      }).sort((left, right) => {
        const leftActive = left.progress > 0 && left.progress < 100 ? 1 : 0;
        const rightActive = right.progress > 0 && right.progress < 100 ? 1 : 0;
        return rightActive - leftActive || right.progress - left.progress;
      }));
      setSession(sessionResult.data as LiveSession | null);
      setAssignment(assignmentResult.data as Assignment | null);
      setAnnouncement(announcementResult.data as Announcement | null);
      setNotifications((notificationResult.data ?? []) as Notification[]);
      if (!messageResult.error) setMessages((messageResult.data ?? []) as unknown as MessageRow[]);
      setLoading(false);
    })();
  }, [user]);

  const overview = useMemo(() => {
    const gradeValues = courses.flatMap((course) => course.grade === null ? [] : [course.grade]);
    const attendanceValues = courses.flatMap((course) => course.attendance === null ? [] : [course.attendance]);
    return {
      progress: courses.length ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length) : 0,
      grade: gradeValues.length ? Math.round(gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length) : null,
      attendance: attendanceValues.length ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length) : null,
      unread: messages.filter((message) => !message.is_read).length + notifications.filter((item) => !item.is_read).length,
    };
  }, [courses, messages, notifications]);
  const current = courses[0];

  return (
    <AppLayout>
      <PageHeader title={`Welcome back, ${profile?.first_name || "there"}`} subtitle="Your learning progress, academic standing, attendance, and messages at a glance." />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        {loading ? <div className="page-section"><TableSkeleton /></div> : courses.length === 0 ? (
          <div className="page-section"><EmptyState icon={<BookOpen size={30} />} title="No active courses" description="An administrator will enrol you into your first course or cohort." /></div>
        ) : (
          <>
            <section aria-label="Learning overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Overall progress" value={`${overview.progress}%`} icon={<BarChart3 size={19} />} hint={`${courses.length} active ${courses.length === 1 ? "course" : "courses"}`} />
              <StatCard label="Current grade" value={overview.grade === null ? "Not graded" : `${overview.grade}%`} icon={<CheckCircle2 size={19} />} accent="success" />
              <StatCard label="Attendance" value={overview.attendance === null ? "Not recorded" : `${overview.attendance}%`} icon={<UserCheck size={19} />} accent="warning" />
              <StatCard label="Unread updates" value={String(overview.unread)} icon={<Mail size={19} />} accent={overview.unread ? "brand" : "success"} />
            </section>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,.5fr)]">
              <div className="space-y-5">
                <section className="overflow-hidden rounded-xl bg-ink-950 p-6 text-white shadow-elevated">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-200">Continue learning</p>
                  <h2 className="mt-3 font-display text-2xl font-semibold">{current.enrolment.cohort.course.title}</h2>
                  <p className="mt-1 text-sm text-ink-300">{current.enrolment.cohort.name}</p>
                  <div className="mt-5 max-w-xl">
                    <div className="mb-2 flex justify-between text-xs text-ink-300"><span>Course progress</span><span>{current.progress}%</span></div>
                    <ProgressBar value={current.progress} />
                  </div>
                  <Link to={`/student/courses/${current.enrolment.cohort_id}/learn`} className="btn-primary mt-6">{current.progress ? "Continue course" : "Start course"} <ArrowRight size={16} /></Link>
                </section>
                <section className="page-section overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
                    <div><h2 className="font-display text-sm font-semibold text-ink-950">My courses</h2><p className="mt-1 text-xs text-ink-500">A focused view of your active enrolments.</p></div>
                    <Link to="/student/courses" className="text-xs font-semibold text-brand-700">View all</Link>
                  </div>
                  <div className="divide-y divide-ink-100">
                    {courses.slice(0, 5).map((course) => (
                      <article key={course.enrolment.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] md:items-center">
                        <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-ink-900">{course.enrolment.cohort.course.title}</h3><p className="mt-0.5 truncate text-xs text-ink-500">{course.enrolment.cohort.name}</p></div>
                        <Metric label="Progress" value={`${course.progress}%`} />
                        <Metric label="Grade" value={course.grade === null ? "Not graded" : `${course.grade}%`} />
                        <Link to={`/student/courses/${course.enrolment.cohort_id}/home`} className="btn-secondary">Open</Link>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
              <aside className="space-y-5">
                <section className="page-section overflow-hidden">
                  <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                    <div className="flex items-center gap-2"><Mail size={17} className="text-brand-600" /><h2 className="font-display text-sm font-semibold text-ink-950">Messages & updates</h2></div>
                    <Link to="/student/messages" className="text-xs font-semibold text-brand-700">Open inbox</Link>
                  </div>
                  <div className="divide-y divide-ink-100">
                    {messages.length === 0 && notifications.length === 0 ? <p className="px-5 py-6 text-xs leading-5 text-ink-500">Messages from your administrators and instructors will appear here.</p> : (
                      <>
                        {messages.map((message) => <article key={message.id} className="px-5 py-4"><div className="flex items-center gap-2">{!message.is_read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}<p className="text-xs font-semibold text-ink-900">{fullName(message.sender)}</p></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-600">{message.body}</p><p className="mt-2 text-[11px] text-ink-400">{formatDateTime(message.created_at)}</p></article>)}
                        {notifications.slice(0, Math.max(0, 3 - messages.length)).map((item) => <article key={item.id} className="px-5 py-4"><div className="flex items-center gap-2">{!item.is_read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}<p className="text-xs font-semibold text-ink-900">{item.title}</p></div>{item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-600">{item.body}</p>}</article>)}
                      </>
                    )}
                  </div>
                </section>
                <DashboardItem icon={Video} title="Next live class" primary={session?.title || "Nothing scheduled"} secondary={session ? formatDateTime(session.scheduled_start) : "Your instructor will publish sessions here."} />
                <DashboardItem icon={ClipboardList} title="Next assignment" primary={assignment?.title || "No work due"} secondary={assignment?.due_date ? `Due ${formatDateTime(assignment.due_date)}` : assignment ? "No due date" : "You are all caught up."} />
                <DashboardItem icon={Megaphone} title="Latest announcement" primary={announcement?.title || "No updates"} secondary={announcement?.body || "Course updates will appear here."} />
              </aside>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-ink-900">{value}</p></div>;
}

function DashboardItem({ icon: Icon, title, primary, secondary }: { icon: typeof Video; title: string; primary: string; secondary: string }) {
  return <section className="page-section p-5"><div className="flex items-center gap-2 text-brand-700"><Icon size={17} /><h2 className="text-xs font-semibold text-ink-900">{title}</h2></div><p className="mt-3 text-sm font-semibold text-ink-900">{primary}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-ink-500">{secondary}</p></section>;
}
