/* The course loader is reused after submissions and is keyed by cohort and user. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, Clock, FileUp, Send } from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime } from "@/lib/format";
import type {
  Assessment,
  Assignment,
  Submission,
  SubmissionVersion,
} from "@/types";

type SafeQuestion = {
  id: string;
  question_type: string;
  question_text: string;
  options: unknown[];
  points: number;
};
type StudentAssessment = Pick<
  Assessment,
  | "id"
  | "title"
  | "description"
  | "instructions"
  | "passing_score"
  | "max_attempts"
> & { questions: SafeQuestion[] };

type AssignmentRow = Assignment & { submissions: Submission[] };
export function CourseAssignments() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [versions, setVersions] = useState<Record<string, SubmissionVersion[]>>({});
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [quiz, setQuiz] = useState<StudentAssessment | null>(null);
  const [answers, setAnswers] = useState<
    Record<string, string | string[]>
  >({});
  const [quizResult, setQuizResult] = useState<{
    percentage: number | null;
    passed: boolean | null;
    pending_review: boolean;
  } | null>(null);
  const [enrolmentId, setEnrolmentId] = useState("");
  const [editing, setEditing] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    if (!cohortId || !user) return;
    setLoading(true);
    const { data: enrolment, error: enrolmentError } = await supabase
      .from("enrolments")
      .select("id")
      .eq("cohort_id", cohortId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .single();
    if (enrolmentError) {
      setError(enrolmentError.message);
      setLoading(false);
      return;
    }
    setEnrolmentId(enrolment.id);
    const [assignmentResult, assessmentResult] = await Promise.all([
      supabase
        .from("assignments")
        .select("*,submissions(*)")
        .eq("cohort_id", cohortId)
        .eq("is_published", true)
        .eq("submissions.enrolment_id", enrolment.id)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("assessments")
        .select("*")
        .eq("cohort_id", cohortId)
        .eq("is_published", true)
        .order("created_at"),
    ]);
    const queryError = assignmentResult.error || assessmentResult.error;
    if (queryError) setError(queryError.message);
    else {
      const nextRows = (assignmentResult.data ?? []) as unknown as AssignmentRow[];
      setRows(nextRows);
      setAssessments((assessmentResult.data ?? []) as Assessment[]);
      const submissionIds = nextRows
        .flatMap((row) => row.submissions)
        .map((submission) => submission.id);
      if (submissionIds.length) {
        const { data: versionRows } = await supabase
          .from("submission_versions")
          .select("*")
          .in("submission_id", submissionIds)
          .order("attempt_number", { ascending: false });
        setVersions(
          ((versionRows ?? []) as SubmissionVersion[]).reduce<
            Record<string, SubmissionVersion[]>
          >((groups, version) => {
            groups[version.submission_id] = [
              ...(groups[version.submission_id] ?? []),
              version,
            ];
            return groups;
          }, {}),
        );
      } else setVersions({});
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortId, user]);
  const begin = (row: AssignmentRow) => {
    setEditing(row.id);
    setContent(row.submissions[0]?.content ?? "");
    setFiles([]);
  };
  const submit = async (row: AssignmentRow) => {
    if (!user) return;
    const currentAttempt = Number(row.submissions[0]?.attempt_count || 0);
    if (row.max_attempts && currentAttempt >= row.max_attempts) {
      setError("You have used every submission attempt for this assignment.");
      return;
    }
    setSaving(true);
    setError("");
    const late = !!row.due_date && new Date() > new Date(row.due_date);
    const { data: submission, error: upsertError } = await supabase
      .from("submissions")
      .upsert(
        {
          assignment_id: row.id,
          enrolment_id: enrolmentId,
          student_id: user.id,
          content,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          is_late: late,
          max_grade: row.max_points,
        },
        { onConflict: "assignment_id,enrolment_id" },
      )
      .select()
      .single();
    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }
    const attemptNumber = Number(submission.attempt_count || 0);
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const attemptFolder = attemptNumber ? `attempt-${attemptNumber}/` : "";
      const filePath = `${user.id}/${submission.id}/${attemptFolder}${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("assignment-submissions")
        .upload(filePath, file);
      if (uploadError) {
        setError(
          `The written response was saved, but ${file.name} could not upload: ${uploadError.message}`,
        );
        setSaving(false);
        return;
      }
      const { error: fileError } = await supabase
        .from("submission_files")
        .insert({
          submission_id: submission.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          ...(attemptNumber ? { attempt_number: attemptNumber } : {}),
        });
      if (fileError) {
        setError(fileError.message);
        setSaving(false);
        return;
      }
    }
    setEditing("");
    setFiles([]);
    await load();
    setSaving(false);
  };
  const startQuiz = async (assessmentId: string) => {
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc(
      "get_assessment_for_student",
      { assessment_uuid: assessmentId },
    );
    if (rpcError)
      setError(
        `${rpcError.message}. Apply migration 012 before using quizzes.`,
      );
    else {
      setQuiz(data as StudentAssessment);
      setAnswers({});
      setQuizResult(null);
    }
    setSaving(false);
  };
  const submitQuiz = async () => {
    if (!quiz) return;
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc(
      "submit_assessment_attempt",
      {
        assessment_uuid: quiz.id,
        enrolment_uuid: enrolmentId,
        submitted_answers: answers,
      },
    );
    if (rpcError) setError(rpcError.message);
    else
      setQuizResult(
        data as {
          percentage: number | null;
          passed: boolean | null;
          pending_review: boolean;
        },
      );
    setSaving(false);
  };
  return (
    <CourseLayout>
      <PageHeader
        title="Assignments & quizzes"
        subtitle="Submit work, complete assessments, and review feedback."
      />
      <div className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : rows.length === 0 && assessments.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<ClipboardList size={30} />}
              title="No coursework yet"
              description="Published assignments and quizzes will appear here."
            />
          </div>
        ) : (
          <>
            {assessments.map((assessment) => (
              <article
                key={assessment.id}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="badge-brand">Quiz</span>
                    <h2 className="mt-2 font-semibold text-ink-900">
                      {assessment.title}
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">
                      {assessment.description ||
                        `${assessment.max_attempts} attempt${assessment.max_attempts === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <button
                    className="btn-primary"
                    disabled={saving}
                    onClick={() => void startQuiz(assessment.id)}
                  >
                    Start quiz
                  </button>
                </div>
              </article>
            ))}
            {quiz && (
              <section className="rounded-xl bg-white p-6 shadow-elevated">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="badge-brand">Assessment</span>
                    <h2 className="mt-2 text-xl font-semibold text-ink-900">
                      {quiz.title}
                    </h2>
                  </div>
                  <button className="btn-ghost" onClick={() => setQuiz(null)}>
                    Close
                  </button>
                </div>
                {quizResult ? (
                  <div
                    className={`mt-6 rounded-xl p-5 ${quizResult.pending_review ? "bg-brand-50 text-brand-800" : quizResult.passed ? "bg-success-50 text-success-800" : "bg-warning-50 text-warning-800"}`}
                  >
                    {quizResult.pending_review ? (
                      <>
                        <p className="font-semibold">Submitted for review</p>
                        <p className="mt-1 text-sm">
                          Your instructor will score the written responses and release the final result.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-semibold">
                          {quizResult.percentage}%
                        </p>
                        <p className="mt-1 text-sm">
                          {quizResult.passed
                            ? "Assessment passed."
                            : "Review the material before your next attempt."}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    {quiz.questions.map((question, index) => (
                      <fieldset key={question.id}>
                        <legend className="font-medium text-ink-900">
                          {index + 1}. {question.question_text}
                        </legend>
                        {question.question_type === "short_answer" ? (
                          <input
                            className="input mt-3"
                            aria-label={`Answer to question ${index + 1}`}
                            value={String(answers[question.id] ?? "")}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                        ) : question.question_type === "long_answer" ? (
                          <textarea
                            className="input mt-3 min-h-32"
                            aria-label={`Answer to question ${index + 1}`}
                            value={String(answers[question.id] ?? "")}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          <div className="mt-3 space-y-2">
                          {question.options.map((option, optionIndex) => {
                            const value =
                              typeof option === "string"
                                ? option
                                : String(
                                    (
                                      option as {
                                        value?: string;
                                        label?: string;
                                      }
                                    ).value ??
                                      (option as { label?: string }).label ??
                                      optionIndex,
                                  );
                            const label =
                              typeof option === "string"
                                ? option
                                : String(
                                    (option as { label?: string }).label ??
                                      value,
                                  );
                            return (
                              <label
                                key={value}
                                className="flex items-center gap-3 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700"
                              >
                                <input
                                  type={
                                    question.question_type === "multiple_select"
                                      ? "checkbox"
                                      : "radio"
                                  }
                                  name={question.id}
                                  value={value}
                                  checked={
                                    question.question_type === "multiple_select"
                                      ? Array.isArray(answers[question.id]) &&
                                        (answers[question.id] as string[]).includes(value)
                                      : answers[question.id] === value
                                  }
                                  onChange={(event) => {
                                    if (question.question_type !== "multiple_select") {
                                      setAnswers((current) => ({
                                        ...current,
                                        [question.id]: event.target.value,
                                      }));
                                      return;
                                    }
                                    setAnswers((current) => {
                                      const selected = Array.isArray(current[question.id])
                                        ? (current[question.id] as string[])
                                        : [];
                                      return {
                                        ...current,
                                        [question.id]: event.target.checked
                                          ? [...selected, value]
                                          : selected.filter((item) => item !== value),
                                      };
                                    });
                                  }}
                                />
                                {label}
                              </label>
                            );
                          })}
                          </div>
                        )}
                      </fieldset>
                    ))}
                    <button
                      className="btn-primary"
                      disabled={
                        saving ||
                        quiz.questions.some((question) => {
                          const answer = answers[question.id];
                          return Array.isArray(answer)
                            ? answer.length === 0
                            : !answer?.trim();
                        })
                      }
                      onClick={() => void submitQuiz()}
                    >
                      Submit quiz
                    </button>
                  </div>
                )}
              </section>
            )}
            {rows.map((row) => {
              const submission = row.submissions[0];
              const submissionHistory = submission
                ? versions[submission.id] ?? []
                : [];
              const attemptsUsed = Number(submission?.attempt_count || 0);
              const attemptsAvailable = row.max_attempts || 0;
              const attemptsExhausted =
                attemptsAvailable > 0 && attemptsUsed >= attemptsAvailable;
              return (
                <article
                  key={row.id}
                  className="rounded-xl bg-white p-5 shadow-soft"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-ink-900">
                          {row.title}
                        </h2>
                        <span className="badge-neutral">
                          {row.max_points} points
                        </span>
                        {attemptsAvailable > 0 && (
                          <span className="badge-neutral">
                            {attemptsUsed}/{attemptsAvailable} attempts
                          </span>
                        )}
                        {submission?.status === "submitted" && (
                          <span className="badge-success">
                            <CheckCircle2 size={12} />
                            Submitted
                          </span>
                        )}
                        {submission?.is_late && (
                          <span className="badge-warning">Late</span>
                        )}
                      </div>
                      {row.description && (
                        <p className="mt-2 text-sm leading-6 text-ink-600">
                          {row.description}
                        </p>
                      )}
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
                        <Clock size={13} />
                        Due {formatDateTime(row.due_date)}
                      </p>
                      {submission?.grade != null && (
                        <div className="mt-4 rounded-lg bg-success-50 p-3 text-sm text-success-800">
                          <strong>
                            {submission.grade}/{submission.max_grade}
                          </strong>
                          {submission.feedback && (
                            <p className="mt-1">{submission.feedback}</p>
                          )}
                        </div>
                      )}
                      {submissionHistory.length > 1 && (
                        <details className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-ink-700">
                            Submission history ({submissionHistory.length})
                          </summary>
                          <ol className="mt-3 space-y-2">
                            {submissionHistory.map((version) => (
                              <li key={version.id} className="text-xs text-ink-600">
                                <span className="font-semibold text-ink-800">
                                  Attempt {version.attempt_number}
                                </span>{" "}
                                · {formatDateTime(version.submitted_at)}
                                {version.is_late ? " · Late" : ""}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                    <button
                      className="btn-primary"
                      disabled={attemptsExhausted}
                      onClick={() => begin(row)}
                    >
                      {attemptsExhausted
                        ? "Attempts used"
                        : submission
                          ? "Submit revision"
                          : "Start assignment"}
                    </button>
                  </div>
                  {editing === row.id && (
                    <div className="mt-5 space-y-3 border-t border-ink-100 pt-5">
                      <div>
                        <label className="label" htmlFor={`response-${row.id}`}>
                          Your response
                        </label>
                        <textarea
                          id={`response-${row.id}`}
                          className="input min-h-40"
                          value={content}
                          onChange={(event) => setContent(event.target.value)}
                          placeholder="Write your response here…"
                        />
                      </div>
                      {row.allow_file_upload && (
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700 hover:bg-ink-100">
                          <FileUp size={18} className="text-brand-600" />
                          <span>
                            {files.length
                              ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                              : "Attach supporting files"}
                          </span>
                          <input
                            className="sr-only"
                            type="file"
                            multiple
                            onChange={(event) =>
                              setFiles(Array.from(event.target.files ?? []))
                            }
                          />
                        </label>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-secondary"
                          onClick={() => setEditing("")}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          disabled={
                            saving || (!content.trim() && files.length === 0)
                          }
                          onClick={() => void submit(row)}
                        >
                          <Send size={16} />
                          {saving ? "Submitting…" : "Submit work"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </>
        )}
      </div>
    </CourseLayout>
  );
}
