import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Alert } from "@/components/ui/Feedback";
import { parseStructuredInstructions } from "@/pages/student/course/courseFormatting";
import { isSubmissionGraded } from "@/lib/submissionPolicy";
import type { Assignment, Submission } from "@/types";
import type { Binding } from "./ComponentPage";

type Activity = Assignment & {
  evidence_required: boolean;
  evidence_instructions: string | null;
  submissions: Array<
    Submission & {
      submission_files: Array<{
        id: string;
        file_name: string;
        file_path: string;
      }>;
    }
  >;
};
export function ComponentActivity({
  bindings,
  enrolmentId,
}: {
  bindings: Binding[];
  enrolmentId: string;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    const ids = bindings.flatMap((b) =>
      b.assignment_id ? [b.assignment_id] : [],
    );
    if (!ids.length) {
      setLoading(false);
      return;
    }
    const r = await supabase
      .from("assignments")
      .select("*,submissions(*,submission_files(*))")
      .in("id", ids)
      .eq("submissions.enrolment_id", enrolmentId);
    setRows((r.data ?? []) as Activity[]);
    setError(r.error?.message ?? "");
    setLoading(false);
  }
  useEffect(() => {
    void load(); /* Binding identity represents this component's activity list. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindings, enrolmentId]);
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <p>Loading activities…</p>
      ) : !rows.length ? (
        <p>No activities have been assigned to this component.</p>
      ) : (
        rows.map((a) => (
          <ActivityEditor
            key={a.id}
            activity={a}
            enrolmentId={enrolmentId}
            studentId={user!.id}
            reload={load}
          />
        ))
      )}
    </div>
  );
}
function ActivityEditor({
  activity: a,
  enrolmentId,
  studentId,
  reload,
}: {
  activity: Activity;
  enrolmentId: string;
  studentId: string;
  reload: () => Promise<void>;
}) {
  const existing = a.submissions[0];
  const structure = parseStructuredInstructions(a.description);
  let initial = existing?.content ?? "";
  try {
    initial = JSON.parse(initial).work ?? initial;
  } catch {
    /* Plain written responses remain supported. */
  }
  const [work, setWork] = useState(initial);
  const [checks, setChecks] = useState<boolean[]>(() => {
    try {
      const saved = JSON.parse(existing?.content ?? "{}").selfCheck;
      return structure.checklist.map((_, i) => Boolean(saved?.[i]));
    } catch {
      return structure.checklist.map(() => false);
    }
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locked = isSubmissionGraded(existing);
  async function save(finalize: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (finalize && !work.trim())
        throw new Error("Add your written response before submitting.");
      if (finalize && checks.some((v) => !v))
        throw new Error("Complete the self-check before submitting.");
      if (
        finalize &&
        a.evidence_required &&
        !files.length &&
        !existing?.submission_files.length
      )
        throw new Error("Upload the required evidence.");
      for (const f of files) {
        if (f.size > (a.max_file_size_mb ?? 100) * 1024 * 1024)
          throw new Error(`${f.name} exceeds the file-size limit.`);
        if (
          a.allowed_file_types?.length &&
          !a.allowed_file_types.includes(
            f.name.split(".").pop()?.toLowerCase() ?? "",
          )
        )
          throw new Error(`${f.name} is not an approved file type.`);
      }
      const content = JSON.stringify({
        version: 1,
        work,
        notes: "",
        evidenceSummary: "",
        selfCheck: checks.length ? checks : [true],
        selfCheckItems: structure.checklist,
      });
      let id = existing?.id;
      if (existing?.status === "submitted" && !finalize)
        throw new Error(
          "Choose Update submission to send your revision. Your previous submission stays available.",
        );
      if (!id) {
        const r = await supabase
          .from("submissions")
          .insert({
            assignment_id: a.id,
            enrolment_id: enrolmentId,
            student_id: studentId,
            content,
            status: "draft",
            max_grade: a.max_points,
          })
          .select("id")
          .single();
        if (r.error) throw r.error;
        id = r.data.id;
      }
      for (const file of files) {
        const path = `${studentId}/${id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "-")}`;
        const r = await supabase.storage
          .from("assignment-submissions")
          .upload(path, file);
        if (r.error) throw r.error;
        const f = await supabase.from("submission_files").insert({
          submission_id: id,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        });
        if (f.error) throw f.error;
        setFiles((current) => current.filter((pending) => pending !== file));
      }
      const r = await supabase
        .from("submissions")
        .update({
          content,
          status: finalize ? "submitted" : "draft",
          ...(finalize ? { submitted_at: new Date().toISOString() } : {}),
        })
        .eq("id", id)
        .select("id")
        .single();
      if (r.error) throw r.error;
      setFiles([]);
      setMessage(finalize ? "Your work has been submitted." : "Draft saved.");
      await reload();
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="companion-surface">
      <div className="flex flex-wrap justify-between gap-3">
        <h2>{a.title}</h2>
        <span className="text-sm capitalize">
          {existing?.status === "returned"
            ? "Resubmission required"
            : (existing?.status ?? "Not started")}
          {existing?.is_late ? " · Late" : ""}
        </span>
      </div>
      {a.due_date && (
        <p className="companion-caption">
          Due {new Date(a.due_date).toLocaleString()}
        </p>
      )}
      <div className="my-6 whitespace-pre-wrap text-sm leading-7">
        {structure.instructions?.length
          ? structure.instructions.map((s, i) => (
              <p className="mb-3" key={i}>
                <strong>Step {i + 1}.</strong> {s}
              </p>
            ))
          : a.description}
      </div>
      {a.evidence_instructions && (
        <div className="mb-5 rounded-lg bg-ink-50 p-4">
          <strong>Required evidence</strong>
          <p className="mt-2 text-sm">{a.evidence_instructions}</p>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      <label className="block text-sm font-medium">
        Your response
        <textarea
          className="input mt-2 min-h-40"
          value={work}
          disabled={locked || busy}
          onChange={(e) => setWork(e.target.value)}
        />
      </label>
      {structure.checklist.map((s, i) => (
        <label className="mt-4 flex items-start gap-3 text-sm" key={i}>
          <input
            type="checkbox"
            checked={checks[i]}
            disabled={locked || busy}
            onChange={(e) =>
              setChecks((v) =>
                v.map((x, j) => (j === i ? e.target.checked : x)),
              )
            }
          />
          <span>{s}</span>
        </label>
      ))}
      {a.allow_file_upload && (
        <label className="mt-5 block text-sm font-medium">
          Evidence files
          <input
            className="input mt-2"
            type="file"
            multiple
            disabled={locked || busy}
            accept={a.allowed_file_types?.map((t) => `.${t}`).join(",")}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <span className="mt-2 block text-xs text-ink-500">
            {a.evidence_required ? "Required" : "Optional"} · up to{" "}
            {a.max_file_size_mb ?? 100} MB per file
          </span>
        </label>
      )}
      {existing?.submission_files.map((f) => (
        <button
          className="btn-secondary mt-3 mr-2"
          key={f.id}
          onClick={async () => {
            const r = await supabase.storage
              .from("assignment-submissions")
              .createSignedUrl(f.file_path, 300);
            if (r.error) setError(r.error.message);
            else window.open(r.data.signedUrl, "_blank", "noopener,noreferrer");
          }}
        >
          {f.file_name}
        </button>
      ))}
      {existing?.feedback && (
        <p className="mt-5 whitespace-pre-wrap rounded-lg bg-ink-50 p-4">
          <strong>Instructor feedback</strong>
          <br />
          {existing.feedback}
        </p>
      )}
      {locked ? (
        <p className="mt-5">
          Graded work is protected. Ask your instructor to reopen it if a
          revision is needed.
        </p>
      ) : (
        <div className="companion-actions">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            Save draft
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            {busy
              ? "Saving…"
              : existing?.status === "submitted"
                ? "Update submission"
                : "Submit activity"}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-4 text-success-700">
          {message}
        </p>
      )}
    </section>
  );
}
