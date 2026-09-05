import { Rubric } from '@/components/ui/Rubric';
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileUp,
  Send,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { CourseLayout } from "./CourseLayout";
import { moduleLabel, parseStructuredInstructions } from "./courseFormatting";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Assignment, Submission } from "@/types";

type AssignmentRow = Assignment & {
  module: { title: string; display_order: number } | null;
  submissions: Array<Submission & {submission_files:Array<{id:string;file_name:string;file_path:string}>}>;
};

export function CourseAssignments() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [enrolmentId, setEnrolmentId] = useState("");
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [openId, setOpenId] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cohortId || !user) return;
    setLoading(true);
    const enrolmentResult = await supabase
      .from("enrolments")
      .select("id")
      .eq("cohort_id", cohortId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .single();
    if (enrolmentResult.error) {
      setError(enrolmentResult.error.message);
      setLoading(false);
      return;
    }
    setEnrolmentId(enrolmentResult.data.id);
    const assignmentResult = await supabase
      .from("assignments")
      .select("*,module:modules(title,display_order),submissions(*,submission_files(*))")
      .eq("cohort_id", cohortId)
      .neq("assignment_type", "activity")
      .eq("is_published", true)
      .eq("submissions.enrolment_id", enrolmentResult.data.id)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (assignmentResult.error) setError(assignmentResult.error.message);
    else setRows((assignmentResult.data ?? []) as unknown as AssignmentRow[]);
    setLoading(false);
  }, [cohortId, user]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = (row: AssignmentRow) => {
    setOpenId(row.id);
    const saved=row.submissions[0];let draft:string|null=null;if(!saved||!["submitted","graded"].includes(saved.status)){try{draft=localStorage.getItem(`academy-assignment-draft:${user?.id}:${cohortId}:${row.id}`);}catch{/* Use the account draft. */}}setContent(draft ?? saved?.content ?? "");
    setFiles([]);
  };

  const submit = async (row: AssignmentRow, finalize=true) => {
    if(row.submissions.some(s=>["submitted","graded"].includes(s.status))){setError("Your submitted work is preserved. Ask your instructor to return it for changes.");return;}
    if(finalize&&!content.trim()&&!files.length&&!row.submissions[0]?.submission_files.length){setError("Add your work or evidence before submitting.");return;}
    if(files.some(f=>f.size>(row.max_file_size_mb??25)*1024*1024)){setError(`Files must be ${row.max_file_size_mb??25} MB or smaller.`);return;}
    if(files.some(f=>row.allowed_file_types?.length&&!row.allowed_file_types.includes(f.name.split(".").pop()?.toLowerCase()??""))){setError("One of the selected file types is not allowed for this assignment.");return;}
    if (!user) return;
    setSaving(true);
    setError("");
    const late = Boolean(row.due_date && new Date() > new Date(row.due_date));
    const { data: submission, error: saveError } = await supabase
      .from("submissions")
      .upsert(
        {
          assignment_id: row.id,
          enrolment_id: enrolmentId,
          student_id: user.id,
          content,
          status: "draft",
          submitted_at: null,
          is_late: late,
          max_grade: row.max_points,
        },
        { onConflict: "assignment_id,enrolment_id" },
      )
      .select()
      .single();
    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filePath = `${user.id}/${submission.id}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage
        .from("assignment-submissions")
        .upload(filePath, file);
      if (upload.error) {
        setError(`${file.name} could not upload: ${upload.error.message}`);
        setSaving(false);
        return;
      }
      const fileResult = await supabase.from("submission_files").insert({
        submission_id: submission.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
      });
      if (fileResult.error) {
        setError(fileResult.error.message);
        setSaving(false);
        return;
      }
      setFiles(current=>current.filter(item=>item!==file));
    }
    if(finalize){const saved=await supabase.from("submissions").update({status:"submitted",submitted_at:new Date().toISOString()}).eq("id",submission.id).eq("status","draft");if(saved.error){setError(saved.error.message);setSaving(false);return;}}
    localStorage.removeItem(`academy-assignment-draft:${user?.id}:${cohortId}:${row.id}`);
    setFiles([]);
    await load();
    setSaving(false);
  };

  return (
    <CourseLayout>
      <PageHeader
        title="Assignments"
        subtitle="Find homework, capstone guidance, presentation work, feedback, and submissions in one place."
      />
      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {loading ? (
        <div className="mt-6 rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white shadow-soft">
          <EmptyState
            icon={<ClipboardList size={30} />}
            title="No assignments yet"
            description="Published homework and capstone work will appear here."
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const submission = row.submissions[0];
            const submitted =
              submission && ["submitted", "graded"].includes(submission.status);
            const structured = parseStructuredInstructions(row.description);
            const expanded = openId === row.id;
            const isHomework = row.assignment_type === "homework";
            return (
              <article
                key={row.id}
                className={`overflow-hidden rounded-2xl border border-ink-200/80 border-t-4 bg-white shadow-soft ${isHomework ? "border-t-brand-500" : "border-t-navy"} ${expanded ? "lg:col-span-2" : ""}`}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-4 p-5 text-left hover:bg-ink-50"
                  aria-expanded={expanded}
                  onClick={() => (expanded ? setOpenId("") : open(row))}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${submitted ? "bg-success-50 text-success-700" : isHomework ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-navy"}`}
                  >
                    {submitted ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <ClipboardList size={20} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${isHomework ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-navy"}`}
                    >
                      {isHomework ? "Homework" : "Capstone project"}
                    </span>
                    <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                      {moduleLabel(row.module)} ·{" "}
                      {row.assignment_type.replace("_", " ")}
                    </span>
                    <span className="mt-1 block font-semibold text-ink-950">
                      {row.title}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500">
                      <span>{row.max_points} points</span>
                      {row.due_date && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} /> Due {formatDateTime(row.due_date)}
                        </span>
                      )}
                      {submitted && (
                        <span>
                          Submitted{" "}
                          {submission.submitted_at
                            ? formatDateTime(submission.submitted_at)
                            : ""}
                        </span>
                      )}
                    </span>
                  </span>
                  {expanded ? (
                    <ChevronUp size={19} />
                  ) : (
                    <ChevronDown size={19} />
                  )}
                </button>
                {expanded && (
                  <div className="border-t border-ink-100 p-5 sm:p-6">
                    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                      <div>
                        <Rubric rubric={row.rubric} values={submission?.rubric_scores}/><h3 className="mt-4 font-semibold text-ink-950">
                          Instructions
                        </h3>
                        <ol className="mt-3 space-y-3 text-sm leading-6 text-ink-700">
                          {structured.instructions.map((step, index) => (
                            <li key={step} className="flex gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                        <h3 className="mt-6 font-semibold text-ink-950">
                          Before you submit
                        </h3>
                        <ul className="mt-3 space-y-2 text-sm text-ink-700">
                          {structured.checklist.map((item) => (
                            <li key={item} className="flex gap-2">
                              <CheckCircle2
                                size={17}
                                className="mt-0.5 shrink-0 text-brand-600"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <aside className="rounded-xl border border-ink-200 bg-ink-50 p-5">
                        <label className="label" htmlFor={`response-${row.id}`}>
                          Written response or submission note
                        </label>
                        <textarea
                          id={`response-${row.id}`}
                          disabled={saving || submitted}
                          className="input min-h-32"
                          value={content}
                          onChange={(event) => {setContent(event.target.value);try{localStorage.setItem(`academy-assignment-draft:${user?.id}:${cohortId}:${row.id}`,event.target.value);}catch{/* Account saving remains available. */}}}
                          placeholder="Add your response, a short summary, or a note for your instructor."
                        />
                        <label className="btn-secondary mt-4 w-full cursor-pointer">
                          <FileUp size={16} /> Add files
                          <input
                            type="file"
                            disabled={saving || submitted || !row.allow_file_upload}
                            accept={row.allowed_file_types?.map(t=>`.${t}`).join(",")}
                            multiple
                            className="sr-only"
                            onChange={(event) =>
                              setFiles(Array.from(event.target.files || []))
                            }
                          />
                        </label>
                        {files.length > 0 && (
                          <ul className="mt-3 space-y-1 text-xs text-ink-600">
                            {files.map((file) => (
                              <li key={`${file.name}-${file.size}`}>
                                {file.name}
                              </li>
                            ))}
                          </ul>
                        )}
                        {submission?.submission_files.map(file=><button className="btn-secondary mt-2 w-full" key={file.id} onClick={async()=>{const result=await supabase.storage.from("assignment-submissions").createSignedUrl(file.file_path,300);if(result.error)setError(result.error.message);else window.open(result.data.signedUrl,"_blank","noopener,noreferrer");}}>{file.file_name}</button>)}
                        <p className="mt-3 text-xs text-ink-600">{submitted ? "Submitted work is preserved. Your instructor can return it for changes." : submission?.status==="draft" ? "Draft saved to your account." : "Save a draft as you work. Submit when all files have uploaded."}</p>
                        <button type="button" className="btn-secondary mt-3 w-full" disabled={saving||submitted} onClick={()=>void submit(row,false)}>Save draft</button>
                        <button
                          type="button"
                          className="btn-primary mt-4 w-full"
                          disabled={
                            saving || submitted || (!content.trim() && files.length === 0 && !submission?.submission_files.length)
                          }
                          onClick={() => void submit(row)}
                        >
                          <Send size={16} />{" "}
                          {saving
                            ? "Submitting..."
                            : submitted
                              ? "Submitted"
                              : "Submit assignment"}
                        </button>
                        {submission?.feedback && (
                          <div className="mt-4 rounded-lg bg-white p-3 text-sm text-ink-700">
                            <strong>Instructor feedback:</strong>{" "}
                            {submission.feedback}
                          </div>
                        )}
                      </aside>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </CourseLayout>
  );
}
