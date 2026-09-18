import { TeachingTeam } from "./InstructorIdentity";
/* Shared course queries are colocated with their student views. */
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  Video,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateTime, fullName } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Alert } from "@/components/ui/Feedback";
import { CompanionShell, ComponentState } from "./CompanionShell";
import { useCompanion } from "./useCompanion";
import { componentPath, nextModule, progressOf, safeWebUrl } from "./model";
import type { LiveSession, Profile, Resource } from "@/types";
import "./companion.css";

export interface Gradebook {
  current_grade: number | null;
  graded_count: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    category: string;
    module_title: string | null;
    percentage: number | null;
    status: string;
    feedback: string | null;
  }>;
}
export type Session = LiveSession & { instructor: Profile | null };
export function useCourseSummary(cohortId: string) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [grades, setGrades] = useState<Gradebook | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId || !user) return;
    let live = true;
    setError("");
    void Promise.all([
      supabase
        .from("live_sessions")
        .select("*,instructor:profiles!live_sessions_instructor_id_fkey(*)")
        .eq("cohort_id", cohortId)
        .order("scheduled_start"),
      supabase.rpc("companion_gradebook", { cohort_uuid: cohortId }),
    ]).then(([s, g]) => {
      if (!live) return;
      if (s.error || g.error)
        setError(s.error?.message ?? g.error?.message ?? "Summary unavailable");
      setSessions((s.data ?? []) as Session[]);
      setGrades(g.data as Gradebook | null);
    });
    return () => {
      live = false;
    };
  }, [cohortId, user]);
  return { sessions, grades, error };
}
export function StudentCompanion({ welcome = false }: { welcome?: boolean }) {
  const data = useCompanion();
  const { profile } = useAuth();
  const summary = useCourseSummary(data.cohortId);
  const modules = data.outline?.modules ?? [];
  const next = nextModule(modules);
  const overall = progressOf(modules.flatMap((m) => m.components));
  const session = summary.sessions.find(
    (s) => !s.is_cancelled && new Date(s.scheduled_end) >= new Date(),
  );
  const outstanding = modules
    .filter((m) => m.available)
    .flatMap((m) =>
      m.components
        .filter(
          (c) =>
            c.required &&
            c.status !== "completed" &&
            ["activity", "assessment"].includes(c.type),
        )
        .map((c) => ({ m, c })),
    );
  const base = `/student/courses/${data.cohortId}`;
  return (
    <CompanionShell
      data={data}
      title={
        welcome
          ? "Course overview"
          : `Welcome, ${profile?.first_name || "Student"}.`
      }
    >
      {summary.error && <Alert>{summary.error}</Alert>}
      <section className="companion-continue">
        <div>
          <h2>
            {next
              ? next.title
              : overall.total && overall.completed === overall.total
                ? "Your required work is complete"
                : "You’re caught up with released work"}
          </h2>
          <p className="mt-3">
            {next
              ? `${progressOf(next.components).completed} of ${progressOf(next.components).total} required items complete`
              : "Your next module or live class will appear here when available."}
          </p>
        </div>
        <Link
          className="btn-primary"
          to={`${base}/modules${next ? `/${next.id}` : ""}`}
        >
          {next ? "Continue Module" : "View Modules"}
          <ArrowRight size={18} />
        </Link>
      </section>
      <section className="mt-6" aria-label="Overall course progress">
        <div className="mb-2 flex justify-between gap-3">
          <strong>
            {overall.total
              ? `${overall.percent}% Complete`
              : "No required items published yet"}
          </strong>
          <span className="text-sm text-ink-600">
            {overall.completed} / {overall.total} required components
          </span>
        </div>
        <progress
          aria-label="Overall course progress"
          className="companion-progress"
          value={overall.completed}
          max={overall.total || 1}
        />
      </section>
      {welcome && (
        <section className="companion-surface mt-6">
          <h2>About your course</h2>
          <p className="mt-3 max-w-prose leading-7 text-ink-600">
            {data.course?.cohort.course.description ||
              "Prepare for live classes, practice what you learn, and keep track of your work."}
          </p>
          <p className="mt-3 text-sm text-ink-600">
            Your eBook is the primary learning resource. Use the module
            companion to review and apply it.
          </p>
          {safeWebUrl(data.course?.cohort.course.introduction_video_url) && (
            <a
              className="btn-secondary mt-4"
              href={safeWebUrl(
                data.course?.cohort.course.introduction_video_url,
              )}
              target="_blank"
              rel="noreferrer"
            >
              Watch the course welcome
            </a>
          )}
          <Link className="btn-secondary mt-4 ml-2" to={`${base}/instructor`}>
            Meet your instructor
          </Link>
        </section>
      )}
      {welcome && <TeachingTeam cohortId={data.cohortId} />}
      <div className="companion-grid">
        <section className="companion-surface">
          <h2>This week</h2>
          {next ? (
            <>
              <p className="companion-caption">{next.title}</p>
              {next.components.map((c) => (
                <div className="companion-row" key={c.id}>
                  <Link
                    className="inline-flex min-h-11 flex-col justify-center font-medium"
                    to={componentPath(data.cohortId, next.id, c.id)}
                  >
                    {c.title}
                    {!c.required && (
                      <span className="block text-xs text-ink-500">
                        Optional
                      </span>
                    )}
                  </Link>
                  <ComponentState component={c} />
                </div>
              ))}
            </>
          ) : (
            <p className="companion-caption">
              No outstanding released module. You can revisit completed modules.
            </p>
          )}
        </section>
        <div className="space-y-6">
          <section className="companion-surface">
            <h2>Next live class</h2>
            {session ? (
              <SessionDetails session={session} />
            ) : (
              <p className="companion-caption">
                Your instructor has not posted the next class.
              </p>
            )}
          </section>
          <section className="companion-surface">
            <h2>My grades</h2>
            <p className="mt-3 text-2xl font-semibold">
              {summary.grades?.current_grade != null
                ? `${summary.grades.current_grade}%`
                : "Not available yet"}
            </p>
            <p className="companion-caption">
              {summary.grades?.graded_count ?? 0} of{" "}
              {summary.grades?.total ?? 0} gradebook items graded
            </p>
            <Link
              className="btn-secondary mt-4"
              to={`/student/grades?cohort=${data.cohortId}`}
            >
              View Gradebook
            </Link>
          </section>
        </div>
      </div>
      <section className="companion-surface mt-6">
        <h2>Outstanding work</h2>
        {outstanding.length ? (
          outstanding.map(({ m, c }) => (
            <div key={c.id} className="companion-row">
              <Link to={componentPath(data.cohortId, m.id, c.id)}>
                {m.title} — {c.title}
              </Link>
              <ComponentState component={c} />
            </div>
          ))
        ) : (
          <p className="companion-caption">
            No outstanding released activities or assessments.
          </p>
        )}
      </section>
    </CompanionShell>
  );
}
export function CompanionModules() {
  const data = useCompanion();
  const { moduleId } = useParams();
  const modules = data.outline?.modules ?? [];
  const module = modules.find((m) => m.id === moduleId);
  return (
    <CompanionShell data={data} title={module?.title ?? "Course modules"}>
      {moduleId ? (
        !module ? (
          <Alert>Module not found.</Alert>
        ) : !module.available ? (
          <section className="companion-empty">
            <LockKeyhole className="mx-auto" />
            <h2 className="mt-4">This module is locked</h2>
            <p>
              {module.release_at
                ? `Available ${formatDateTime(module.release_at)}`
                : "Your instructor will release it when ready."}
            </p>
          </section>
        ) : (
          <>
            <p className="mb-6 max-w-prose leading-7 text-ink-600">
              {module.description}
            </p>
            <div className="companion-surface">
              <div className="mb-5 flex justify-between">
                <h2>Module checklist</h2>
                <span>{progressOf(module.components).percent}% complete</span>
              </div>
              {module.components.length ? (
                module.components.map((c) => (
                  <Link
                    className="companion-row"
                    to={componentPath(data.cohortId, module.id, c.id)}
                    key={c.id}
                  >
                    <div>
                      <strong>{c.title}</strong>
                      <p className="mt-1 text-sm text-ink-500">
                        {c.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ComponentState component={c} />
                      <ArrowRight size={18} />
                    </div>
                  </Link>
                ))
              ) : (
                <p>Materials are being prepared.</p>
              )}
            </div>
          </>
        )
      ) : (
        <div className="companion-surface">
          {modules.map((m) => {
            const p = progressOf(m.components);
            return (
              <div key={m.id} className="companion-row">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {!m.available ? (
                      <LockKeyhole size={20} />
                    ) : p.total && p.completed === p.total ? (
                      <CheckCircle2 size={20} className="text-success-700" />
                    ) : (
                      <BookOpen size={20} />
                    )}
                    <h2>{m.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-ink-600">
                    {m.available
                      ? p.total
                        ? `${p.percent}% complete · ${p.completed} of ${p.total} required items`
                        : "Materials being prepared"
                      : m.release_at
                        ? `Available ${formatDateTime(m.release_at)}`
                        : "Awaiting release"}
                  </p>
                </div>
                {m.available && (
                  <Link
                    className="btn-secondary shrink-0"
                    to={`/student/courses/${data.cohortId}/modules/${m.id}`}
                  >
                    Open<span className="sr-only"> {m.title}</span>
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            );
          })}
          {!modules.length && <p>No modules have been published yet.</p>}
        </div>
      )}
    </CompanionShell>
  );
}
export function SessionDetails({ session }: { session: Session }) {
  const join = safeWebUrl(session.meeting_url);
  return (
    <div className="mt-4">
      <h3 className="font-semibold">{session.title}</h3>
      <p className="mt-2 text-sm">
        {formatDateTime(session.scheduled_start)} –{" "}
        {new Date(session.scheduled_end).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <p className="mt-2 text-sm text-ink-600">
        Instructor: {fullName(session.instructor) || "To be announced"}
      </p>
      {session.preparation_notes && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
          {session.preparation_notes}
        </p>
      )}
      {session.is_cancelled ? (
        <p className="mt-4 text-danger-700">Cancelled</p>
      ) : join ? (
        <a
          className="btn-primary mt-4"
          href={join}
          target="_blank"
          rel="noreferrer"
        >
          <Video size={16} />
          Join class
        </a>
      ) : (
        <p className="companion-caption">
          Meeting details will be posted here.
        </p>
      )}
    </div>
  );
}
export function CompanionGrades() {
  const data = useCompanion();
  const { grades, error } = useCourseSummary(data.cohortId);
  return (
    <CompanionShell data={data} title="My grades">
      {error && <Alert>{error}</Alert>}
      <section className="companion-surface">
        <h2>
          {grades?.current_grade != null
            ? `Current course grade: ${grades.current_grade}%`
            : "Course grade not available"}
        </h2>
        <p className="companion-caption">
          Your current grade uses the configured category weights and graded
          work. Ungraded work is shown separately.
        </p>
        {grades?.items.map((g) => (
          <article key={g.id} className="companion-row">
            <div>
              <h3 className="font-semibold">{g.title}</h3>
              <p className="mt-1 text-sm text-ink-500">
                {g.module_title ?? g.category}
              </p>
              {g.feedback && (
                <p className="mt-3 whitespace-pre-wrap text-sm">{g.feedback}</p>
              )}
            </div>
            <div className="text-right">
              <strong>{g.percentage == null ? "—" : `${g.percentage}%`}</strong>
              <p className="mt-1 text-sm text-ink-500">{g.status}</p>
            </div>
          </article>
        ))}
        {!grades?.items.length && (
          <p className="mt-4">No graded items have been configured yet.</p>
        )}
      </section>
    </CompanionShell>
  );
}
export function CompanionAttendance() {
  const data = useCompanion();
  const { sessions, error } = useCourseSummary(data.cohortId);
  const [records, setRecords] = useState<
    Array<{ live_session_id: string; status: string }>
  >([]);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    if (!data.outline) return;
    let live = true;
    void supabase
      .from("attendance_records")
      .select("live_session_id,status")
      .eq("enrolment_id", data.outline.enrolment_id)
      .then((r) => {
        if (live) {
          setRecords(r.data ?? []);
          setFailure(r.error?.message ?? "");
        }
      });
    return () => {
      live = false;
    };
  }, [data.outline]);
  const counted = records.filter(
    (r) =>
      r.status !== "excused" &&
      sessions.some((s) => s.id === r.live_session_id && !s.is_cancelled),
  );
  const present = counted.filter((r) =>
    ["present", "late", "left_early"].includes(r.status),
  ).length;
  return (
    <CompanionShell data={data} title="My attendance">
      {(error || failure) && <Alert>{error || failure}</Alert>}
      <section className="companion-surface">
        <h2>
          {counted.length
            ? `${Math.round((present / counted.length) * 100)}% attendance`
            : "No attendance recorded yet"}
        </h2>
        <p className="companion-caption">
          Excused and cancelled sessions are excluded from the attendance
          percentage.
        </p>
        {sessions.map((s) => (
          <div className="companion-row" key={s.id}>
            <div>
              <strong>{s.title}</strong>
              <p className="mt-1 text-sm text-ink-600">
                {formatDateTime(s.scheduled_start)}
              </p>
            </div>
            <span className="capitalize">
              {s.is_cancelled
                ? "Cancelled"
                : (records
                    .find((r) => r.live_session_id === s.id)
                    ?.status.replace("_", " ") ??
                  (new Date(s.scheduled_end) > new Date()
                    ? "Upcoming"
                    : "Not recorded"))}
            </span>
          </div>
        ))}
      </section>
    </CompanionShell>
  );
}
export function CompanionLive() {
  const data = useCompanion();
  const { sessions, error } = useCourseSummary(data.cohortId);
  return (
    <CompanionShell data={data} title="Live classes">
      {error && <Alert>{error}</Alert>}
      <p className="mb-5 text-sm text-ink-600">
        Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
        Complete the released module materials before class.
      </p>
      <div className="space-y-5">
        {sessions.map((s) => (
          <section className="companion-surface" key={s.id}>
            <SessionDetails session={s} />
          </section>
        ))}
        {!sessions.length && (
          <div className="companion-empty">
            Your instructor has not posted any sessions yet.
          </div>
        )}
      </div>
    </CompanionShell>
  );
}
export async function resourceUrl(resource: Resource) {
  if (resource.url?.startsWith("storage:")) {
    const r = await supabase.storage
      .from("course-assets")
      .createSignedUrl(resource.url.slice(8), 300);
    if (r.error) throw r.error;
    return r.data.signedUrl;
  }
  return safeWebUrl(resource.url);
}
export function ResourceList({ resources }: { resources: Resource[] }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  return (
    <>
      {error && <Alert>{error}</Alert>}
      {resources.map((r) => (
        <div className="companion-row" key={r.id}>
          <div>
            <strong>{r.title}</strong>
            <p className="mt-1 text-sm text-ink-500">{r.description}</p>
          </div>
          <button
            className="btn-secondary"
            disabled={busy === r.id}
            onClick={async () => {
              const win = window.open("about:blank", "_blank");
              if (win) win.opener = null;
              setBusy(r.id);
              try {
                const url = await resourceUrl(r);
                if (!url)
                  throw new Error("This resource has no available file.");
                if (win) win.location.href = url;
                else throw new Error("Allow pop-ups to open the resource.");
              } catch (e) {
                win?.close();
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            Open<span className="sr-only"> {r.title}</span>
          </button>
        </div>
      ))}
      {!resources.length && (
        <p className="text-ink-500">No resources have been posted yet.</p>
      )}
    </>
  );
}
export function CompanionResources() {
  const data = useCompanion();
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!data.cohortId) return;
    let live = true;
    void supabase
      .rpc("get_available_course_resources", { cohort_uuid: data.cohortId })
      .then((r) => {
        if (live) {
          setResources(r.data ?? []);
          setError(r.error?.message ?? "");
        }
      });
    return () => {
      live = false;
    };
  }, [data.cohortId]);
  return (
    <CompanionShell data={data} title="Course resources">
      {error && <Alert>{error}</Alert>}
      <section className="companion-surface">
        <h2 className="mb-4">eBooks, worksheets and reference materials</h2>
        <ResourceList resources={resources} />
      </section>
    </CompanionShell>
  );
}

export function CompanionWelcome() {
  return <StudentCompanion welcome />;
}
