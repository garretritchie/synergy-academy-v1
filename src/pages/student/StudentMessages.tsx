/* The loader is scoped to the authenticated user and reused by mark-all-read. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  HelpCircle,
  Mail,
  Megaphone,
  MessageCircle,
  Send,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import { fullName } from "@/lib/format";
import type { Announcement, Discussion, Notification, Profile } from "@/types";
import { DirectMessagesPanel } from "@/components/communication/DirectMessagesPanel";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { QuestionReplies } from '@/components/communication/QuestionReplies';

type CourseContext = {
  id: string;
  name: string;
  course: { title: string };
};
type QuestionRow = Discussion & {
  author: Profile;
  cohort: CourseContext;
};
type AnnouncementRow = Announcement & {
  author: Profile;
  cohort: CourseContext;
};
type MessageTab = "inbox" | "questions" | "announcements";
const messageTabs = [
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "inbox", label: "Private messages", icon: MessageCircle },
  { id: "questions", label: "Course Q&A", icon: HelpCircle },
] satisfies Array<{
  id: MessageTab;
  label: string;
  icon: typeof MessageCircle;
}>;

export function StudentMessages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Notification[]>([]);
  const [courses, setCourses] = useState<CourseContext[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [questionCourseId, setQuestionCourseId] = useState("");
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestedTab = searchParams.get("tab");
  const activeTab: MessageTab =
    requestedTab === "inbox" || requestedTab === "questions"
      ? requestedTab
      : "announcements";
  const load = async () => {
    if (!user) return;
    const enrolmentResult = await supabase
      .from("enrolments")
      .select("cohort:cohorts(id,name,course:courses(title))")
      .eq("student_id", user.id)
      .eq("status", "active");
    if (enrolmentResult.error) {
      setError(enrolmentResult.error.message);
      setLoading(false);
      return;
    }
    const courseRows = (enrolmentResult.data ?? []).map(
      (item) => item.cohort,
    ) as unknown as CourseContext[];
    const cohortIds = courseRows.map((cohort) => cohort.id);
    const [notificationResult, questionResult, announcementResult] =
      await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        cohortIds.length
          ? supabase
              .from("discussions")
              .select(
                "*,author:profiles(*),cohort:cohorts(id,name,course:courses(title))",
              )
              .in("cohort_id", cohortIds)
              .eq("is_question", true)
              .is("parent_id", null)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        cohortIds.length
          ? supabase
              .from("announcements")
              .select(
                "*,author:profiles(*),cohort:cohorts(id,name,course:courses(title))",
              )
              .in("cohort_id", cohortIds)
              .eq("is_published", true)
              .order("published_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
    const queryError =
      notificationResult.error ||
      questionResult.error ||
      announcementResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((notificationResult.data ?? []) as Notification[]);
      setCourses(courseRows);
      setQuestions((questionResult.data ?? []) as unknown as QuestionRow[]);
      setAnnouncements(
        (announcementResult.data ?? []) as unknown as AnnouncementRow[],
      );
      setQuestionCourseId((current) => current || courseRows[0]?.id || "");
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [user]);
  const markAll = async () => {
    if (!user) return;
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (updateError) setError(updateError.message);
    else await load();
  };
  const askQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !user ||
      !questionCourseId ||
      !courses.some((course) => course.id === questionCourseId) ||
      !questionTitle.trim()
    )
      return;
    setSavingQuestion(true);
    const { error: insertError } = await supabase.from("discussions").insert({
      cohort_id: questionCourseId,
      title: questionTitle.trim(),
      body: questionBody.trim(),
      author_id: user.id,
      is_question: true,
    });
    if (insertError) setError(insertError.message);
    else {
      setQuestionTitle("");
      setQuestionBody("");
      await load();
    }
    setSavingQuestion(false);
  };
  return (
    <AppLayout>
      <PageHeader
        title="Messages"
        subtitle="Keep private conversations and course updates together in one place."
        actions={
          activeTab === "inbox" && rows.some((row) => !row.is_read) ? (
            <button className="btn-secondary" onClick={() => void markAll()}>
              <CheckCheck size={16} />
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="mt-6 space-y-5">
        <section className="overflow-hidden rounded-2xl border border-brand-100 bg-[linear-gradient(120deg,rgba(232,243,252,0.96),rgba(255,255,255,0.98))] px-5 py-4 shadow-soft sm:px-6">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_6px_18px_rgba(26,108,176,0.18)]">
              <MessageCircle size={21} />
            </span>
            <div>
              <h2 className="font-semibold text-ink-950">
                Your communication center
              </h2>
              <p className="mt-0.5 text-sm text-ink-600">
                Send a private message or review updates from your courses.
              </p>
            </div>
          </div>
        </section>
        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border border-ink-200 bg-white p-1 shadow-soft"
          aria-label="Message sections"
        >
          {messageTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeTab === id}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${activeTab === id ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"}`}
              onClick={() =>
                setSearchParams(id === "announcements" ? {} : { tab: id })
              }
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        {error && <Alert>{error}</Alert>}
        {activeTab === "inbox" && <DirectMessagesPanel role="student" />}
        {activeTab === "inbox" && (
          <section className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink-950">Course updates</h2>
                <p className="mt-0.5 text-sm text-ink-500">
                  Reminders and activity from your enrolled courses.
                </p>
              </div>
              <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                {rows.filter((row) => !row.is_read).length} unread
              </span>
            </div>
            {loading ? (
              <div className="rounded-xl bg-ink-50">
                <TableSkeleton />
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-xl bg-white shadow-soft">
                <EmptyState
                  icon={<Mail size={30} />}
                  title="No course updates"
                  description="Course reminders and academic updates will appear here."
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((row) => (
                  <article
                    key={row.id}
                    className={`flex gap-4 rounded-xl border px-4 py-4 ${row.is_read ? "border-ink-200 bg-ink-50/70" : "border-brand-200 bg-brand-50/60"}`}
                  >
                    <Bell
                      size={18}
                      className={
                        row.is_read ? "text-ink-400" : "text-brand-600"
                      }
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium text-ink-900">
                          {row.title}
                        </h2>
                        {!row.is_read && (
                          <span className="sr-only">Unread</span>
                        )}
                      </div>
                      {row.body && (
                        <p className="mt-1 text-sm text-ink-600">{row.body}</p>
                      )}
                      <p className="mt-2 text-xs text-ink-500">
                        {formatDateTime(row.created_at)}
                      </p>
                      {row.link_url && (
                        <Link
                          to={row.link_url}
                          className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800"
                        >
                          Open update
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {activeTab === "questions" && (
          <section className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <form
              onSubmit={askQuestion}
              className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft"
            >
              <h2 className="font-semibold text-ink-950">
                Ask your teaching team
              </h2>
              <p className="mt-1 text-sm leading-6 text-ink-500">
                Select the course so your question reaches the right
                instructors.
              </p>
              <label className="label mt-5" htmlFor="question-course">
                Course
              </label>
              <select
                id="question-course"
                className="input"
                required
                value={questionCourseId}
                onChange={(event) => setQuestionCourseId(event.target.value)}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course.title}
                  </option>
                ))}
              </select>
              <label className="label mt-4" htmlFor="question-title">
                Question
              </label>
              <input
                id="question-title"
                className="input"
                required
                value={questionTitle}
                onChange={(event) => setQuestionTitle(event.target.value)}
                placeholder="What do you need help with?"
              />
              <label className="label mt-4" htmlFor="question-details">
                Details
              </label>
              <textarea
                id="question-details"
                className="input min-h-24"
                value={questionBody}
                onChange={(event) => setQuestionBody(event.target.value)}
                placeholder="Add helpful context"
              />
              <button
                type="submit"
                className="btn-primary mt-4 w-full"
                disabled={savingQuestion || !courses.length}
              >
                <Send size={16} />{" "}
                {savingQuestion ? "Posting..." : "Post question"}
              </button>
            </form>
            <div className="space-y-3">
              {loading ? (
                <TableSkeleton />
              ) : questions.length === 0 ? (
                <div className="rounded-2xl border border-ink-200 bg-white shadow-soft">
                  <EmptyState
                    icon={<HelpCircle size={28} />}
                    title="No questions yet"
                    description="Your course questions and instructor responses will appear here."
                  />
                </div>
              ) : (
                questions.map((question) => (
                  <article
                    key={question.id}
                    className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                        {question.cohort.course.title} · {question.cohort.name}
                      </span>
                      {question.is_resolved && (
                        <span className="badge-success">Resolved</span>
                      )}
                    </div>
                    <h2 className="mt-3 font-semibold text-ink-950">
                      {question.title}
                    </h2>
                    {question.body && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">
                        {question.body}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
                      <UserAvatar profile={question.author} size="xs" decorative />
                      <span>{fullName(question.author)}, {formatDateTime(question.created_at)}</span>
                    </div>
                    <QuestionReplies questionId={question.id} cohortId={question.cohort.id}/>
                  </article>
                ))
              )}
            </div>
          </section>
        )}
        {activeTab === "announcements" && (
          <section className="grid gap-4 md:grid-cols-2">
            {loading ? (
              <TableSkeleton />
            ) : announcements.length === 0 ? (
              <div className="rounded-2xl border border-ink-200 bg-white shadow-soft md:col-span-2">
                <EmptyState
                  icon={<Megaphone size={28} />}
                  title="No announcements"
                  description="Updates from each teaching team will appear here with the course name."
                />
              </div>
            ) : (
              announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-soft"
                >
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    {announcement.cohort.course.title}
                  </span>
                  <h2 className="mt-3 font-semibold text-ink-950">
                    {announcement.title}
                  </h2>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-ink-600">
                    {announcement.body}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
                    <UserAvatar profile={announcement.author} size="xs" decorative />
                    <span>{fullName(announcement.author)}, {formatDateTime(announcement.published_at)}</span>
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
