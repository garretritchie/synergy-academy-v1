import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert } from "@/components/ui/Feedback";
import { useInstructorCohorts } from "@/hooks/useInstructorCohorts";
import { useRoleView } from "@/context/RoleViewContext";
import { supabase } from "@/lib/supabase";
import { progressOf, type Outline } from "./model";
import type { Gradebook, Session } from "./StudentCompanion";
import { SessionDetails } from "./StudentCompanion";
import "./companion.css";
type Student = {
  id: string;
  student_id: string;
  name: string;
  email: string;
  outline: Outline;
  grades: Gradebook;
  failed_checks: number;
};
export function CompanionTeaching({ grid = false }: { grid?: boolean }) {
  const { cohorts, error: cohortError } = useInstructorCohorts();
  const { activeRole } = useRoleView();
  const base = activeRole === "administrator" ? "/admin" : "/instructor";
  const [cohortId, setCohortId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState(0);
  const [release, setRelease] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (cohorts.length && !cohortId) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);
  useEffect(() => {
    if (!cohortId) return;
    let live = true;
    setLoading(true);
    void Promise.all([
      supabase.rpc("companion_staff_roster", { cohort_uuid: cohortId }),
      supabase
        .from("live_sessions")
        .select("*,instructor:profiles!live_sessions_instructor_id_fkey(*)")
        .eq("cohort_id", cohortId)
        .eq("is_cancelled", false)
        .gte("scheduled_end", new Date().toISOString())
        .order("scheduled_start")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("submissions")
        .select("id,assignment:assignments!inner(cohort_id)", {
          count: "exact",
          head: true,
        })
        .eq("assignment.cohort_id", cohortId)
        .eq("status", "submitted"),
      supabase
        .from("module_releases")
        .select("release_at")
        .eq("cohort_id", cohortId)
        .eq("mode", "scheduled")
        .gt("release_at", new Date().toISOString())
        .order("release_at")
        .limit(1)
        .maybeSingle(),
    ]).then(([r, s, p, d]) => {
      if (!live) return;
      setError(
        r.error?.message ??
          s.error?.message ??
          p.error?.message ??
          d.error?.message ??
          "",
      );
      setStudents(r.data ?? []);
      setSession(s.data as Session | null);
      setPending(p.count ?? 0);
      setRelease(d.data?.release_at ?? null);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [cohortId]);
  const columns = Array.from(
    new Map(
      students.flatMap((s) => s.grades.items).map((i) => [i.id, i]),
    ).values(),
  );
  const caughtUp = students.filter((s) =>
    s.outline.modules
      .filter((m) => m.available)
      .every((m) =>
        m.components
          .filter((c) => c.required && c.type !== "live_session")
          .every((c) => c.status === "completed"),
      ),
  ).length;
  return (
    <AppLayout>
      <div className="companion-page">
        <header className="companion-heading">
          <h1>{grid ? "Cohort gradebook" : "Teaching dashboard"}</h1>
          <p className="mt-2 text-ink-600">
            {grid
              ? "Review student results and open the grading tools when a correction is needed."
              : "Prepare your next class and see who needs your attention."}
          </p>
        </header>
        <label className="block text-sm">
          Cohort
          <select
            className="input mt-2"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
          >
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {(error || cohortError) && <Alert>{error || cohortError}</Alert>}
        {loading ? (
          <p className="mt-6" role="status">
            Loading cohort…
          </p>
        ) : grid ? (
          <section className="companion-surface mt-6">
            <div className="overflow-x-auto">
              <table className="companion-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    {columns.map((i) => (
                      <th key={i.id}>{i.title}</th>
                    ))}
                    <th>Current grade</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <th>{s.name || s.email}</th>
                      {columns.map((i) => (
                        <td key={i.id}>
                          {s.grades.items.find((g) => g.id === i.id)
                            ?.percentage ?? "—"}
                        </td>
                      ))}
                      <td>{s.grades.current_grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link className="btn-secondary mt-5" to={`${base}/grading-tools`}>
              Manual grades & corrections
            </Link>
          </section>
        ) : (
          <>
            <div className="companion-grid">
              <section className="companion-surface">
                <h2>Next session</h2>
                {session ? (
                  <SessionDetails session={session} />
                ) : (
                  <p className="companion-caption">
                    No upcoming session scheduled.
                  </p>
                )}
              </section>
              <section className="companion-surface">
                <h2>Needs attention</h2>
                <p className="mt-4">
                  {students.reduce((n, s) => n + (s.failed_checks ?? 0), 0)}{" "}
                  assessment checks awaiting a passing result
                </p>
                <p className="mt-4">{pending} submissions awaiting review</p>
                <p className="mt-3">
                  {caughtUp} of {students.length} students caught up with
                  released preparation
                </p>
                <p className="mt-3 text-sm text-ink-600">
                  {release
                    ? `Next release: ${new Date(release).toLocaleString()}`
                    : "No scheduled module release"}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link className="btn-primary" to={`${base}/submissions`}>
                    Review submissions
                  </Link>
                  <Link className="btn-secondary" to={`${base}/modules`}>
                    Manage releases
                  </Link>
                </div>
              </section>
            </div>
            <section className="companion-surface mt-6">
              <h2>Student progress</h2>
              {students.map((s) => {
                const p = progressOf(
                  s.outline.modules.flatMap((m) => m.components),
                );
                const released = s.outline.modules
                  .filter((m) => m.available)
                  .flatMap((m) =>
                    m.components.filter(
                      (c) => c.required && c.type !== "live_session",
                    ),
                  );
                const remaining = released.filter(
                  (c) => c.status !== "completed",
                ).length;
                return (
                  <div className="companion-row" key={s.id}>
                    <div>
                      <strong>{s.name || s.email}</strong>
                      <p className="mt-1 text-sm text-ink-600">
                        {remaining
                          ? `${remaining} released items outstanding`
                          : "Caught up"}{" "}
                        · {p.percent}% overall
                      </p>
                    </div>
                    <span className="text-sm">
                      {s.grades.current_grade != null
                        ? `${s.grades.current_grade}% grade`
                        : "No grade yet"}
                    </span>
                  </div>
                );
              })}
              {!students.length && (
                <p className="companion-caption">No enrolled students yet.</p>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
type SubmissionRow = {
  id: string;
  content: string | null;
  submitted_at: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  student: { first_name: string; last_name: string };
  assignment: {
    title: string;
    description: string | null;
    max_points: number;
    cohort_id: string;
  };
  submission_files: Array<{ id: string; file_name: string; file_path: string }>;
};
export function CompanionSubmissions() {
  const { cohorts } = useInstructorCohorts();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<
    Array<{ id: string; content: string; submitted_at: string }>
  >([]);
  const ids = cohorts.map((c) => c.id).join(",");
  const load = useCallback(async () => {
    if (!ids) return;
    const r = await supabase
      .from("submissions")
      .select(
        "id,content,submitted_at,status,grade,feedback,student:profiles!submissions_student_id_fkey(first_name,last_name),assignment:assignments!inner(title,description,max_points,cohort_id),submission_files(id,file_name,file_path)",
      )
      .in("assignment.cohort_id", ids.split(","))
      .in("status", ["submitted", "returned", "graded"])
      .order("submitted_at");
    setRows((r.data ?? []) as unknown as SubmissionRow[]);
    setError(r.error?.message ?? "");
  }, [ids]);
  useEffect(() => {
    void load();
  }, [load]);
  async function review(row: SubmissionRow) {
    setSelected(row);
    setScore(row.grade == null ? "" : String(row.grade));
    setFeedback(row.feedback ?? "");
    const r = await supabase
      .from("submission_versions")
      .select("id,content,submitted_at")
      .eq("submission_id", row.id)
      .order("submitted_at", { ascending: false });
    setHistory(r.data ?? []);
    if (r.error) setError(r.error.message);
  }
  async function save(returned: boolean) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (returned && !feedback.trim())
        throw new Error("Explain what the student should revise.");
      const numeric = Number(score);
      if (
        !returned &&
        (!score.trim() ||
          !Number.isFinite(numeric) ||
          numeric < 0 ||
          numeric > selected.assignment.max_points)
      )
        throw new Error("Enter a score within the activity point range.");
      const r = await supabase
        .from("submissions")
        .update(
          returned
            ? { status: "returned", feedback, grade: null, graded_at: null }
            : {
                status: "graded",
                grade: numeric,
                max_grade: selected.assignment.max_points,
                feedback,
                graded_at: new Date().toISOString(),
              },
        )
        .eq("id", selected.id)
        .select("id")
        .single();
      if (r.error) throw r.error;
      setSelected(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const response = (text: string | null) => {
    try {
      return JSON.parse(text ?? "").work ?? text;
    } catch {
      return text;
    }
  };
  return (
    <AppLayout>
      <div className="companion-page">
        <header className="companion-heading">
          <h1>Submissions</h1>
          <p className="mt-2 text-ink-600">
            Review private evidence, give feedback, and record a grade.
          </p>
        </header>
        {error && <Alert>{error}</Alert>}
        {selected ? (
          <section className="companion-surface">
            <h2>{selected.assignment.title}</h2>
            <p className="companion-caption">
              {selected.student.first_name} {selected.student.last_name} ·{" "}
              {new Date(selected.submitted_at).toLocaleString()}
            </p>
            <details className="mt-5">
              <summary className="cursor-pointer font-medium">
                Activity instructions
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                {selected.assignment.description}
              </p>
            </details>
            <h3 className="mt-6 font-semibold">Student response</h3>
            <p className="mt-3 whitespace-pre-wrap leading-7">
              {response(selected.content)}
            </p>
            {selected.submission_files.map((f) => (
              <button
                key={f.id}
                className="btn-secondary mt-4 mr-2"
                onClick={async () => {
                  const r = await supabase.storage
                    .from("assignment-submissions")
                    .createSignedUrl(f.file_path, 300);
                  if (r.error) setError(r.error.message);
                  else
                    window.open(
                      r.data.signedUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                }}
              >
                {f.file_name}
              </button>
            ))}
            <details className="mt-6">
              <summary className="cursor-pointer font-medium">
                Previous submissions ({history.length})
              </summary>
              {history.map((h) => (
                <article
                  className="mt-4 border-t border-ink-200 pt-3"
                  key={h.id}
                >
                  <p className="text-sm text-ink-500">
                    {new Date(h.submitted_at).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {response(h.content)}
                  </p>
                </article>
              ))}
            </details>
            <label className="mt-6 block text-sm font-medium">
              Score (out of {selected.assignment.max_points})
              <input
                className="input mt-2"
                type="number"
                min="0"
                max={selected.assignment.max_points}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Feedback
              <textarea
                className="input mt-2"
                rows={5}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
            <div className="companion-actions">
              <button
                className="btn-secondary"
                onClick={() => setSelected(null)}
              >
                Back to queue
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Request resubmission
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Save grade
              </button>
            </div>
          </section>
        ) : (
          <section className="companion-surface">
            {rows.map((r) => (
              <div className="companion-row" key={r.id}>
                <div>
                  <strong>
                    {r.student.first_name} {r.student.last_name}
                  </strong>
                  <p className="mt-1 text-sm">{r.assignment.title}</p>
                  <p className="mt-1 text-xs capitalize text-ink-500">
                    {r.status} · {new Date(r.submitted_at).toLocaleString()}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => void review(r)}
                >
                  Review
                </button>
              </div>
            ))}
            {!rows.length && <p>No submissions to review yet.</p>}
          </section>
        )}
      </div>
    </AppLayout>
  );
}

export function CompanionGradeGrid() {
  return <CompanionTeaching grid />;
}
