/* Discussion loaders are page-local and rerun when the cohort or discussion mode changes. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  Download,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Megaphone,
  MessageSquare,
  LockKeyhole,
  Pin,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { formatDateTime, fullName } from "@/lib/format";
import type {
  Announcement,
  Assignment,
  Discussion,
  LiveSession,
  Profile,
  Resource,
} from "@/types";

export function CourseAnnouncements() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("announcements")
        .select("*,author:profiles(*)")
        .eq("cohort_id", cohortId)
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });
      if (queryError) setError(queryError.message);
      else setRows((data ?? []) as Announcement[]);
      setLoading(false);
    })();
  }, [cohortId]);
  return (
    <CourseLayout>
      <PageHeader
        title="Announcements"
        subtitle="Important updates from your teaching team."
      />
      <SupportList
        loading={loading}
        error={error}
        emptyIcon={<Megaphone />}
        empty="No announcements yet."
      >
        {rows.map((row) => (
          <article key={row.id} className="px-5 py-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-ink-900">{row.title}</h2>
              {row.is_pinned && (
                <span className="badge-warning">
                  <Pin size={12} />
                  Pinned
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">
              {row.body}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              {fullName(row.author)} · {formatDateTime(row.published_at)}
            </p>
          </article>
        ))}
      </SupportList>
    </CourseLayout>
  );
}

function DiscussionPage({ questions }: { questions: boolean }) {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [rows, setRows] = useState<Discussion[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    if (!cohortId) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("discussions")
      .select("*,author:profiles(*)")
      .eq("cohort_id", cohortId)
      .eq("is_question", questions)
      .is("parent_id", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as Discussion[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortId, questions]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!cohortId || !user) return;
    setSaving(true);
    const { error: insertError } = await supabase
      .from("discussions")
      .insert({
        cohort_id: cohortId,
        title,
        body,
        author_id: user.id,
        is_question: questions,
      });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
      setTitle("");
      setBody("");
      await load();
    }
    setSaving(false);
  };
  const Icon = questions ? HelpCircle : MessageSquare;
  return (
    <CourseLayout>
      <PageHeader
        title={questions ? "Q&A" : "Discussion Board"}
        subtitle={
          questions
            ? "Ask your teaching team and follow resolved answers."
            : "Connect with your cohort around the course."
        }
      />
      <div className="mt-6 space-y-4">
        <FormPanel
          title={questions ? "Ask a question" : "Start a discussion"}
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel={questions ? "Ask question" : "New discussion"}
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Title">
              <input
                required
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Details">
              <textarea
                className="input min-h-24"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </Field>
            <div className="flex justify-end">
              <SubmitButton loading={saving}>Post</SubmitButton>
            </div>
          </form>
        </FormPanel>
        <SupportList
          loading={loading}
          error={error}
          emptyIcon={<Icon />}
          empty={questions ? "No questions yet." : "No discussions yet."}
        >
          {rows.map((row) => (
            <article key={row.id} className="px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-ink-900">{row.title}</h2>
                {row.is_resolved && (
                  <span className="badge-success">Resolved</span>
                )}
              </div>
              {row.body && (
                <p className="mt-2 text-sm leading-6 text-ink-700">
                  {row.body}
                </p>
              )}
              <p className="mt-3 text-xs text-ink-500">
                {fullName(row.author)} · {formatDateTime(row.created_at)}
              </p>
            </article>
          ))}
        </SupportList>
      </div>
    </CourseLayout>
  );
}
export function CourseDiscussions() {
  return <DiscussionPage questions={false} />;
}
export function CourseQA() {
  return <DiscussionPage questions />;
}

export function CourseResources() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [rows, setRows] = useState<Resource[]>([]);
  const [upcoming, setUpcoming] = useState<Array<{
    id: string;
    title: string;
    description: string | null;
    resource_type: string;
    release_mode: string;
    release_at: string | null;
    release_checkpoint_type: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) return;
    void (async () => {
      const { data: cohort, error: cohortError } = await supabase
        .from("cohorts")
        .select("course_id")
        .eq("id", cohortId)
        .single();
      if (cohortError) {
        setError(cohortError.message);
        setLoading(false);
        return;
      }
      const [resourceResult, upcomingResult] = await Promise.all([
        supabase.from("resources").select("*").eq("course_id", cohort.course_id).order("display_order"),
        supabase.rpc("get_upcoming_course_resources", { cohort_uuid: cohortId }),
      ]);
      const { data, error: queryError } = resourceResult;
      if (queryError) setError(queryError.message);
      else {
        setRows((data ?? []) as Resource[]);
        if (!upcomingResult.error) setUpcoming(upcomingResult.data ?? []);
      }
      setLoading(false);
    })();
  }, [cohortId]);
  const openResource=async(resource:Resource)=>{if(!resource.url)return;const win=window.open('about:blank','_blank');if(win)win.opener=null;let url=resource.url;if(url.startsWith('storage:')){const result=await supabase.storage.from('course-assets').createSignedUrl(url.slice(8),300);if(result.error){win?.close();setError(result.error.message);return;}url=result.data.signedUrl;}if(!/^https?:\/\//i.test(url)){win?.close();setError('This resource needs a valid web address.');return;}if(win)win.location.href=url;else setError('Allow pop-ups to open this resource.');};
  return (
    <CourseLayout>
      <PageHeader
        title="Resources"
        subtitle="Course files, references, and supporting links."
      />
      <SupportList
        loading={loading}
        error={error}
        emptyIcon={<FolderOpen />}
        empty="No resources have been added."
      >
        {rows.map((row) => (
          <article key={row.id} className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <FolderOpen size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-ink-900">{row.title}</h2>
              <p className="mt-0.5 text-sm text-ink-500">
                {row.description || row.resource_type}
              </p>
            </div>
            {row.url && (
              <button
                type="button"
                onClick={()=>void openResource(row)}
                className="btn-secondary"
              >
                {row.is_downloadable ? (
                  <Download size={15} />
                ) : (
                  <ExternalLink size={15} />
                )}
                Open
              </button>
            )}
          </article>
        ))}
      </SupportList>
      {upcoming.length > 0 && (
        <section className="mt-5 rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-800"><LockKeyhole size={18} /></span>
            <div><h2 className="font-semibold text-ink-950">Coming later</h2><p className="text-xs text-ink-500">These files will open when you reach their release point.</p></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {upcoming.map((row) => (
              <article key={row.id} className="rounded-xl border border-white bg-white/80 p-4">
                <div className="flex items-start gap-3">
                  <Clock3 size={16} className="mt-0.5 shrink-0 text-accent-700" />
                  <div><h3 className="text-sm font-semibold text-ink-900">{row.title}</h3><p className="mt-1 text-xs leading-5 text-ink-500">{row.description || row.resource_type}</p><p className="mt-2 text-[11px] font-medium text-accent-800">{row.release_mode === "scheduled" && row.release_at ? `Opens ${formatDateTime(row.release_at)}` : row.release_checkpoint_type === "lesson" ? "Opens after learning completion" : row.release_checkpoint_type === "activity" ? "Opens after an activity" : "Opens after an assessment"}</p></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </CourseLayout>
  );
}

export function CourseInstructor() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [rows, setRows] = useState<
    Array<{ id: string; is_lead: boolean; instructor: Profile }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("cohort_instructors")
        .select(
          "id,is_lead,instructor:profiles!cohort_instructors_instructor_id_fkey(*)",
        )
        .eq("cohort_id", cohortId)
        .order("is_lead", { ascending: false });
      if (queryError) setError(queryError.message);
      else
        setRows(
          (data ?? []) as unknown as Array<{
            id: string;
            is_lead: boolean;
            instructor: Profile;
          }>,
        );
      setLoading(false);
    })();
  }, [cohortId]);
  return (
    <CourseLayout>
      <PageHeader
        title="Teaching team"
        subtitle="The instructors supporting this cohort."
      />
      <SupportList
        loading={loading}
        error={error}
        emptyIcon={<GraduationCap />}
        empty="No instructors have been assigned."
      >
        {rows.map((row) => (
          <article key={row.id} className="flex items-center gap-4 px-5 py-5">
            <UserAvatar profile={row.instructor} size="lg" decorative />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-ink-900">
                  {fullName(row.instructor)}
                </h2>
                {row.is_lead && (
                  <span className="badge-brand">Lead instructor</span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-500">
                {row.instructor.bio || row.instructor.email}
              </p>
            </div>
          </article>
        ))}
      </SupportList>
    </CourseLayout>
  );
}

export function CourseCalendar() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) return;
    void (async () => {
      const [sessionResult, assignmentResult] = await Promise.all([
        supabase
          .from("live_sessions")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("is_cancelled", false)
          .order("scheduled_start"),
        supabase
          .from("assignments")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("is_published", true)
          .order("due_date"),
      ]);
      const queryError = sessionResult.error || assignmentResult.error;
      if (queryError) setError(queryError.message);
      else {
        setSessions((sessionResult.data ?? []) as LiveSession[]);
        setAssignments((assignmentResult.data ?? []) as Assignment[]);
      }
      setLoading(false);
    })();
  }, [cohortId]);
  const events = [
    ...sessions.map((item) => ({
      id: item.id,
      date: item.scheduled_start,
      title: item.title,
      type: "Live session",
    })),
    ...assignments
      .filter((item) => item.due_date)
      .map((item) => ({
        id: item.id,
        date: item.due_date!,
        title: item.title,
        type: "Assignment due",
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return (
    <CourseLayout>
      <PageHeader
        title="Calendar"
        subtitle="Live classes and coursework deadlines in date order."
      />
      <SupportList
        loading={loading}
        error={error}
        emptyIcon={<CalendarDays />}
        empty="Nothing is scheduled."
      >
        {events.map((event) => (
          <article
            key={`${event.type}-${event.id}`}
            className="flex items-center gap-4 px-5 py-4"
          >
            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-800">
              <span className="text-xs font-semibold uppercase">
                {new Intl.DateTimeFormat("en-BS", { month: "short" }).format(
                  new Date(event.date),
                )}
              </span>
              <span className="text-lg font-semibold leading-none">
                {new Date(event.date).getDate()}
              </span>
            </div>
            <div>
              <span className="badge-neutral">{event.type}</span>
              <h2 className="mt-1 font-medium text-ink-900">{event.title}</h2>
              <p className="text-xs text-ink-500">
                {formatDateTime(event.date)}
              </p>
            </div>
          </article>
        ))}
      </SupportList>
    </CourseLayout>
  );
}

function SupportList({
  loading,
  error,
  emptyIcon,
  empty,
  children,
}: {
  loading: boolean;
  error: string;
  emptyIcon: React.ReactNode;
  empty: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-soft">
      {error && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {loading ? (
        <TableSkeleton />
      ) : count === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={empty}
          description="Check back after your instructor adds course activity."
        />
      ) : (
        <div className="divide-y divide-ink-100">{children}</div>
      )}
    </div>
  );
}
