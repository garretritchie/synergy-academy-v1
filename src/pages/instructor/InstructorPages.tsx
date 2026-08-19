/* Page-local loaders intentionally rerun when their serialized cohort scope changes. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Megaphone,
  Send,
  UserRound,
  Users,
  Video,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DirectMessagesPanel } from "@/components/communication/DirectMessagesPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { useInstructorCohorts } from "@/hooks/useInstructorCohorts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, fullName } from "@/lib/format";
import type {
  Announcement,
  Assessment,
  Assignment,
  AttendanceRecord,
  Enrolment,
  GradeCategory,
  LiveSession,
  Profile,
  ProgressRecord,
  Submission,
} from "@/types";

function CohortSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { cohorts } = useInstructorCohorts();
  return (
    <select
      required
      className="input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select cohort</option>
      {cohorts.map((cohort) => (
        <option key={cohort.id} value={cohort.id}>
          {cohort.course.title} - {cohort.name}
        </option>
      ))}
    </select>
  );
}
function PageState({
  loading,
  error,
  empty,
  icon,
  children,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <div className="rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : empty ? (
        <div className="rounded-xl bg-white shadow-soft">
          <EmptyState
            icon={icon}
            title="Nothing here yet"
            description="Choose a cohort or create the first item to begin."
          />
        </div>
      ) : (
        children
      )}
    </>
  );
}

export function InstructorLiveSessions() {
  const { user } = useAuth();
  const { cohorts, loading: cohortLoading } = useInstructorCohorts();
  const [rows, setRows] = useState<LiveSession[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cohort_id: "",
    title: "",
    description: "",
    session_type: "lecture",
    scheduled_start: "",
    scheduled_end: "",
    meeting_platform: "Zoom",
    meeting_url: "",
    preparation_notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSession, setUploadingSession] = useState("");
  const [error, setError] = useState("");
  const ids = cohorts.map((item) => item.id);
  const load = async () => {
    if (cohortLoading) return;
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("live_sessions")
      .select("*")
      .in("cohort_id", ids)
      .order("scheduled_start", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as LiveSession[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortLoading, ids.join(",")]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error: insertError } = await supabase.from("live_sessions").insert({
      ...form,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      scheduled_end: new Date(form.scheduled_end).toISOString(),
      instructor_id: user?.id,
      created_by: user?.id,
      metadata: {},
    });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
      setForm({
        cohort_id: "",
        title: "",
        description: "",
        session_type: "lecture",
        scheduled_start: "",
        scheduled_end: "",
        meeting_platform: "Zoom",
        meeting_url: "",
        preparation_notes: "",
      });
      await load();
    }
    setSaving(false);
  };
  const uploadRecording = async (session: LiveSession, file: File) => {
    const cohort = cohorts.find((item) => item.id === session.cohort_id);
    if (!cohort) return;
    if (file.size > 250 * 1024 * 1024) {
      setError("Recordings must be 250 MB or smaller.");
      return;
    }
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      setError("Choose a video or audio recording.");
      return;
    }
    setUploadingSession(session.id);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${cohort.course_id}/live-sessions/${session.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("course-assets")
      .upload(path, file);
    if (uploadError) setError(uploadError.message);
    else {
      const { error: updateError } = await supabase
        .from("live_sessions")
        .update({ recording_storage_path: path, recording_url: null })
        .eq("id", session.id);
      if (updateError) {
        await supabase.storage.from("course-assets").remove([path]);
        setError(updateError.message);
      } else {
        if (session.recording_storage_path) {
          await supabase.storage
            .from("course-assets")
            .remove([session.recording_storage_path]);
        }
        await load();
      }
    }
    setUploadingSession("");
  };
  return (
    <AppLayout>
      <PageHeader
        title="Live sessions"
        subtitle="Schedule meetings, preparation notes, joining links, and recordings."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title="Schedule a live session"
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel="New session"
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cohort">
                <CohortSelect
                  value={form.cohort_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, cohort_id: value }))
                  }
                />
              </Field>
              <Field label="Session title">
                <input
                  required
                  className="input"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={form.scheduled_start}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduled_start: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Ends">
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={form.scheduled_end}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduled_end: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Meeting URL">
              <input
                type="url"
                className="input"
                value={form.meeting_url}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    meeting_url: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Preparation notes">
              <textarea
                className="input min-h-20"
                value={form.preparation_notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    preparation_notes: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="flex justify-end">
              <SubmitButton loading={saving}>Schedule session</SubmitButton>
            </div>
          </form>
        </FormPanel>
        <PageState
          loading={loading}
          error={error}
          empty={!rows.length}
          icon={<Video size={30} />}
        >
          <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
            {rows.map((row) => (
              <article
                key={row.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <Video size={19} className="text-brand-600" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-ink-900">{row.title}</h2>
                  <p className="text-sm text-ink-500">
                    {formatDateTime(row.scheduled_start)}
                  </p>
                </div>
                {row.meeting_url && (
                  <a
                    href={row.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    Open meeting
                  </a>
                )}
                <label className="btn-secondary cursor-pointer">
                  <Upload size={15} />
                  {uploadingSession === row.id
                    ? "Uploading..."
                    : row.recording_storage_path || row.recording_url
                      ? "Replace recording"
                      : "Upload recording"}
                  <input
                    type="file"
                    className="sr-only"
                    accept="video/*,audio/*"
                    disabled={Boolean(uploadingSession)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadRecording(row, file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  className={
                    row.is_cancelled ? "badge-danger" : "badge-success"
                  }
                  onClick={async () => {
                    await supabase
                      .from("live_sessions")
                      .update({ is_cancelled: !row.is_cancelled })
                      .eq("id", row.id);
                    await load();
                  }}
                >
                  {row.is_cancelled ? "Cancelled" : "Scheduled"}
                </button>
              </article>
            ))}
          </div>
        </PageState>
      </div>
    </AppLayout>
  );
}

export function InstructorAssignments() {
  const { user } = useAuth();
  const { cohorts, loading: cohortLoading } = useInstructorCohorts();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [open, setOpen] = useState(false);
  const [assignmentStep, setAssignmentStep] = useState(0);
  const [form, setForm] = useState({
    cohort_id: "",
    title: "",
    description: "",
    assignment_type: "homework",
    max_points: 100,
    max_attempts: 2,
    weight: 1,
    due_date: "",
    allow_late_submission: true,
    is_published: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ids = cohorts.map((item) => item.id);
  const load = async () => {
    if (cohortLoading) return;
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("assignments")
      .select("*")
      .in("cohort_id", ids)
      .order("due_date", { ascending: false, nullsFirst: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as Assignment[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortLoading, ids.join(",")]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error: insertError } = await supabase.from("assignments").insert({
      ...form,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      created_by: user?.id,
      allow_file_upload: true,
    });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
      setAssignmentStep(0);
      setForm({
        cohort_id: "",
        title: "",
        description: "",
        assignment_type: "homework",
        max_points: 100,
        max_attempts: 2,
        weight: 1,
        due_date: "",
        allow_late_submission: true,
        is_published: true,
      });
      await load();
    }
    setSaving(false);
  };
  return (
    <AppLayout>
      <PageHeader
        title="Assignments & quizzes"
        subtitle="Create coursework, publish due dates, and review submissions."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title="Create assignment"
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel="New assignment"
        >
          <form onSubmit={save}>
            {error && <Alert>{error}</Alert>}
            <CreationWizard
              steps={["Describe work", "Set delivery", "Review"]}
              currentStep={assignmentStep}
              canContinue={
                assignmentStep === 0
                  ? Boolean(
                      form.cohort_id &&
                        form.title.trim() &&
                        form.description.trim(),
                    )
                  : assignmentStep === 1
                    ? form.max_points > 0 &&
                      form.max_attempts > 0 &&
                      form.max_attempts <= 20
                    : true
              }
              saving={saving}
              finalAction="Create assignment"
              onBack={() => setAssignmentStep((step) => Math.max(0, step - 1))}
              onNext={() => setAssignmentStep((step) => Math.min(2, step + 1))}
            >
              {assignmentStep === 0 && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Cohort">
                      <CohortSelect
                        value={form.cohort_id}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, cohort_id: value }))
                        }
                      />
                    </Field>
                    <Field label="Title">
                      <input
                        required
                        className="input"
                        value={form.title}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Instructions">
                    <textarea
                      required
                      className="input min-h-28"
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              )}
              {assignmentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Due date">
                      <input
                        type="datetime-local"
                        className="input"
                        value={form.due_date}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            due_date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Maximum points">
                      <input
                        type="number"
                        min="1"
                        className="input"
                        value={form.max_points}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            max_points: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Submission attempts">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        className="input"
                        value={form.max_attempts}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            max_attempts: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Weight">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="input"
                        value={form.weight}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            weight: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-5 text-sm text-ink-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.is_published}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            is_published: event.target.checked,
                          }))
                        }
                      />
                      Publish now
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.allow_late_submission}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            allow_late_submission: event.target.checked,
                          }))
                        }
                      />
                      Allow late work
                    </label>
                  </div>
                </div>
              )}
              {assignmentStep === 2 && (
                <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                    Ready to create
                  </p>
                  <h2 className="mt-2 font-semibold text-ink-950">{form.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    {form.max_points} points · {form.max_attempts} submission attempts
                    {form.due_date
                      ? ` · Due ${formatDateTime(new Date(form.due_date).toISOString())}`
                      : " · No due date"}
                  </p>
                  <p className="mt-2 text-xs text-ink-500">
                    {form.is_published ? "Publishes immediately" : "Saves as draft"}
                    {form.allow_late_submission
                      ? " · Late work allowed"
                      : " · Closes at the due date"}
                  </p>
                </div>
              )}
            </CreationWizard>
          </form>
        </FormPanel>
        <QuizBuilder />
        <PageState
          loading={loading}
          error={error}
          empty={!rows.length}
          icon={<ClipboardList size={30} />}
        >
          <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
            {rows.map((row) => (
              <article
                key={row.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <ClipboardList size={18} className="text-brand-600" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-ink-900">{row.title}</h2>
                  <p className="text-xs text-ink-500">
                    Due {formatDateTime(row.due_date)} · {row.max_points} points
                  </p>
                </div>
                <button
                  className={
                    row.is_published ? "badge-success" : "badge-neutral"
                  }
                  onClick={async () => {
                    await supabase
                      .from("assignments")
                      .update({ is_published: !row.is_published })
                      .eq("id", row.id);
                    await load();
                  }}
                >
                  {row.is_published ? "Published" : "Draft"}
                </button>
              </article>
            ))}
          </div>
        </PageState>
      </div>
    </AppLayout>
  );
}

function QuizBuilder() {
  type DraftQuestion = {
    type:
      | "multiple_choice"
      | "multiple_select"
      | "true_false"
      | "short_answer"
      | "long_answer";
    text: string;
    options: string[];
    correct: string;
    selected: string[];
    points: number;
  };
  const blankQuestion = (): DraftQuestion => ({
    type: "multiple_choice",
    text: "",
    options: ["", "", "", ""],
    correct: "",
    selected: [],
    points: 1,
  });
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cohortId, setCohortId] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    blankQuestion(),
  ]);
  const [passing, setPassing] = useState(70);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const updateQuestion = (
    index: number,
    updater: (question: DraftQuestion) => DraftQuestion,
  ) =>
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? updater(question) : question,
      ),
    );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const invalidQuestion = questions.some((question) => {
      if (!question.text.trim() || question.points <= 0) return true;
      if (question.type === "short_answer" || question.type === "long_answer")
        return false;
      if (question.type === "true_false") return !question.correct;
      if (question.options.filter(Boolean).length < 2) return true;
      return question.type === "multiple_select"
        ? question.selected.length === 0
        : !question.correct;
    });
    if (invalidQuestion) {
      setError("Complete every question and choose the correct objective answers.");
      setSaving(false);
      return;
    }
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .insert({
        cohort_id: cohortId,
        title,
        assessment_type: "quiz",
        max_attempts: 2,
        passing_score: passing,
        is_published: false,
        show_results_immediately: true,
        created_by: user?.id,
      })
      .select()
      .single();
    if (assessmentError) {
      setError(assessmentError.message);
      setSaving(false);
      return;
    }
    const rows = questions.map((question, index) => ({
      assessment_id: assessment.id,
      question_type: question.type,
      question_text: question.text,
      options:
        question.type === "true_false"
          ? ["True", "False"]
          : question.type === "short_answer" || question.type === "long_answer"
            ? []
            : question.options.filter(Boolean),
      correct_answer:
        question.type === "multiple_select"
          ? JSON.stringify(question.selected)
          : question.type === "short_answer" || question.type === "long_answer"
            ? null
            : question.correct,
      points: question.points,
      display_order: index + 1,
    }));
    const { error: questionError } = await supabase
      .from("assessment_questions")
      .insert(rows);
    if (questionError) setError(questionError.message);
    else {
      const { error: publishError } = await supabase
        .from("assessments")
        .update({ is_published: true })
        .eq("id", assessment.id);
      if (publishError) setError(publishError.message);
      else {
        setOpen(false);
        setTitle("");
        setQuestions([blankQuestion()]);
      }
    }
    setSaving(false);
  };
  return (
    <FormPanel
      title="Create a quiz"
      description="Build objective or written assessments. Objective answers grade on the server; written responses wait for instructor review."
      open={open}
      onToggle={() => setOpen(!open)}
      actionLabel="New quiz"
    >
      <form onSubmit={save} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Cohort">
              <CohortSelect value={cohortId} onChange={setCohortId} />
            </Field>
          </div>
          <Field label="Passing score">
            <input
              type="number"
              min="0"
              max="100"
              className="input"
              value={passing}
              onChange={(event) => setPassing(Number(event.target.value))}
            />
          </Field>
        </div>
        <Field label="Quiz title">
          <input
            required
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        {questions.map((question, questionIndex) => (
          <fieldset key={questionIndex} className="rounded-xl bg-ink-50 p-4">
            <div className="flex items-center justify-between">
              <legend className="font-semibold text-ink-900">
                Question {questionIndex + 1}
              </legend>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="btn-ghost !py-1 text-danger-600"
                  onClick={() =>
                    setQuestions((current) =>
                      current.filter((_, index) => index !== questionIndex),
                    )
                  }
                >
                  Remove
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr_7rem]">
                <Field label="Question type">
                  <select
                    className="input"
                    value={question.type}
                    onChange={(event) =>
                      updateQuestion(questionIndex, (current) => ({
                        ...current,
                        type: event.target.value as DraftQuestion["type"],
                        correct: "",
                        selected: [],
                      }))
                    }
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="multiple_select">Multiple select</option>
                    <option value="true_false">True / false</option>
                    <option value="short_answer">Short answer</option>
                    <option value="long_answer">Long answer</option>
                  </select>
                </Field>
                <Field label="Question">
                  <input
                    required
                    className="input"
                    value={question.text}
                    onChange={(event) =>
                      updateQuestion(questionIndex, (current) => ({
                        ...current,
                        text: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Points">
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={question.points}
                    onChange={(event) =>
                      updateQuestion(questionIndex, (current) => ({
                        ...current,
                        points: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
              </div>
              {(question.type === "multiple_choice" ||
                question.type === "multiple_select") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <Field key={optionIndex} label={`Option ${optionIndex + 1}`}>
                      <input
                        required={optionIndex < 2}
                        className="input"
                        value={option}
                        onChange={(event) =>
                          updateQuestion(questionIndex, (current) => ({
                            ...current,
                            options: current.options.map((item, index) =>
                              index === optionIndex ? event.target.value : item,
                            ),
                            correct:
                              current.correct === option ? "" : current.correct,
                            selected: current.selected.filter(
                              (item) => item !== option,
                            ),
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              )}
              {question.type === "multiple_choice" && (
                <Field label="Correct answer">
                  <select
                    required
                    className="input"
                    value={question.correct}
                    onChange={(event) =>
                      updateQuestion(questionIndex, (current) => ({
                        ...current,
                        correct: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select answer</option>
                    {question.options.filter(Boolean).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {question.type === "multiple_select" && (
                <div>
                  <p className="label">Correct answers</p>
                  <div className="flex flex-wrap gap-2">
                    {question.options.filter(Boolean).map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-ink-700"
                      >
                        <input
                          type="checkbox"
                          checked={question.selected.includes(option)}
                          onChange={(event) =>
                            updateQuestion(questionIndex, (current) => ({
                              ...current,
                              selected: event.target.checked
                                ? [...current.selected, option]
                                : current.selected.filter((item) => item !== option),
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {question.type === "true_false" && (
                <Field label="Correct answer">
                  <select
                    className="input"
                    required
                    value={question.correct}
                    onChange={(event) =>
                      updateQuestion(questionIndex, (current) => ({
                        ...current,
                        correct: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select answer</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                </Field>
              )}
              {(question.type === "short_answer" ||
                question.type === "long_answer") && (
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                  Written responses enter the instructor review queue before a final score is released.
                </p>
              )}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setQuestions((current) => [...current, blankQuestion()])
            }
          >
            Add question
          </button>
          <SubmitButton loading={saving}>Publish quiz</SubmitButton>
        </div>
      </form>
    </FormPanel>
  );
}

type AttendanceStudent = Enrolment & {
  student: Profile;
  attendance_records: AttendanceRecord[];
};
export function InstructorAttendance() {
  const { user } = useAuth();
  const { cohorts } = useInstructorCohorts();
  const [cohortId, setCohortId] = useState("");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId) {
      setSessions([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("cohort_id", cohortId)
        .order("scheduled_start", { ascending: false });
      setSessions((data ?? []) as LiveSession[]);
    })();
  }, [cohortId]);
  useEffect(() => {
    if (!cohortId || !sessionId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("enrolments")
        .select(
          "*,student:profiles!enrolments_student_id_fkey(*),attendance_records(*)",
        )
        .eq("cohort_id", cohortId)
        .eq("status", "active")
        .eq("attendance_records.live_session_id", sessionId);
      if (queryError) setError(queryError.message);
      else setStudents((data ?? []) as unknown as AttendanceStudent[]);
      setLoading(false);
    })();
  }, [cohortId, sessionId]);
  const mark = async (row: AttendanceStudent, status: string) => {
    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(
        {
          live_session_id: sessionId,
          student_id: row.student_id,
          enrolment_id: row.id,
          status,
          recorded_by: user?.id,
          arrived_at: ["present", "late"].includes(status)
            ? new Date().toISOString()
            : null,
        },
        { onConflict: "live_session_id,student_id" },
      );
    if (upsertError) setError(upsertError.message);
    else {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("live_session_id", sessionId)
        .eq("student_id", row.student_id)
        .single();
      setStudents((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                attendance_records: data ? [data as AttendanceRecord] : [],
              }
            : item,
        ),
      );
    }
  };
  return (
    <AppLayout>
      <PageHeader
        title="Attendance"
        subtitle="Record attendance by live session; student records stay private under RLS."
      />
      <div className="mt-6 space-y-5">
        <section className="grid gap-4 rounded-xl bg-white p-5 shadow-soft sm:grid-cols-2">
          <Field label="Cohort">
            <select
              className="input"
              value={cohortId}
              onChange={(event) => {
                setCohortId(event.target.value);
                setSessionId("");
              }}
            >
              <option value="">Select cohort</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.course.title} - {cohort.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Live session">
            <select
              className="input"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatDateTime(session.scheduled_start)} - {session.title}
                </option>
              ))}
            </select>
          </Field>
        </section>
        <PageState
          loading={loading}
          error={error}
          empty={!students.length}
          icon={<ClipboardCheck size={30} />}
        >
          <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
            {students.map((row) => (
              <article
                key={row.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-ink-900">
                    {fullName(row.student)}
                  </h2>
                  <p className="text-xs text-ink-500">{row.student.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["present", "late", "excused", "absent"].map((status) => (
                    <button
                      key={status}
                      className={`rounded-lg px-3 py-2 text-xs font-medium capitalize ${row.attendance_records[0]?.status === status ? "bg-brand-600 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"}`}
                      onClick={() => void mark(row, status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </PageState>
      </div>
    </AppLayout>
  );
}

type SubmissionRow = Submission & {
  student: Profile;
  assignment: Assignment;
  submission_files: Array<{
    id: string;
    file_name: string;
    file_path: string;
    attempt_number?: number;
  }>;
};
type GradebookStudent = Enrolment & { student: Profile };
type AssessmentReviewRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  enrolment_id: string;
  answers: Record<string, string | string[]>;
  score: number;
  max_score: number;
  student: Profile;
  assessment: Assessment;
};
type ReviewQuestion = {
  id: string;
  question_type: string;
  question_text: string;
  points: number;
};
export function InstructorGradebook() {
  const { user } = useAuth();
  const { cohorts, loading: cohortLoading } = useInstructorCohorts();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [reviewRows, setReviewRows] = useState<AssessmentReviewRow[]>([]);
  const [reviewingAttemptId, setReviewingAttemptId] = useState("");
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [reviewScores, setReviewScores] = useState<Record<string, string>>({});
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [editing, setEditing] = useState("");
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [gradebookCohortId, setGradebookCohortId] = useState("");
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [students, setStudents] = useState<GradebookStudent[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryWeight, setNewCategoryWeight] = useState("0");
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [manualEnrolmentId, setManualEnrolmentId] = useState("");
  const [manualItemName, setManualItemName] = useState("");
  const [manualScore, setManualScore] = useState("");
  const [manualMax, setManualMax] = useState("100");
  const [manualFeedback, setManualFeedback] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [setupSaving, setSetupSaving] = useState(false);
  const ids = cohorts.map((item) => item.id);
  const load = async () => {
    if (cohortLoading) return;
    if (!ids.length) {
      setRows([]);
      setReviewRows([]);
      setLoading(false);
      return;
    }
    const [submissionResult, reviewResult] = await Promise.all([
      supabase
        .from("submissions")
        .select(
          "*,student:profiles!submissions_student_id_fkey(*),assignment:assignments!inner(*),submission_files(*)",
        )
        .in("assignment.cohort_id", ids)
        .in("status", ["submitted", "graded"])
        .order("submitted_at", { ascending: false }),
      supabase
        .from("assessment_attempts")
        .select(
          "*,student:profiles!assessment_attempts_student_id_fkey(*),assessment:assessments!inner(*)",
        )
        .in("assessment.cohort_id", ids)
        .eq("status", "pending_review")
        .order("completed_at", { ascending: true }),
    ]);
    const queryError = submissionResult.error || reviewResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((submissionResult.data ?? []) as unknown as SubmissionRow[]);
      setReviewRows(
        (reviewResult.data ?? []) as unknown as AssessmentReviewRow[],
      );
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortLoading, ids.join(",")]);
  useEffect(() => {
    if (!gradebookCohortId) {
      setCategories([]);
      setStudents([]);
      setManualCategoryId("");
      setManualEnrolmentId("");
      return;
    }
    void (async () => {
      const [categoryResult, studentResult] = await Promise.all([
        supabase
          .from("grade_categories")
          .select("*")
          .eq("cohort_id", gradebookCohortId)
          .order("display_order"),
        supabase
          .from("enrolments")
          .select("*,student:profiles!enrolments_student_id_fkey(*)")
          .eq("cohort_id", gradebookCohortId)
          .in("status", ["active", "completed"]),
      ]);
      const setupError = categoryResult.error || studentResult.error;
      if (setupError) setError(setupError.message);
      else {
        const nextCategories = (categoryResult.data ?? []) as GradeCategory[];
        setCategories(nextCategories);
        setStudents(
          (studentResult.data ?? []) as unknown as GradebookStudent[],
        );
        setManualCategoryId(nextCategories[0]?.id || "");
      }
    })();
  }, [gradebookCohortId]);

  const refreshGradebookSetup = async () => {
    if (!gradebookCohortId) return;
    const { data, error: categoryError } = await supabase
      .from("grade_categories")
      .select("*")
      .eq("cohort_id", gradebookCohortId)
      .order("display_order");
    if (categoryError) setError(categoryError.message);
    else setCategories((data ?? []) as GradeCategory[]);
  };

  const addCategory = async () => {
    if (!gradebookCohortId || !newCategoryName.trim()) return;
    setSetupSaving(true);
    setError("");
    const { error: insertError } = await supabase
      .from("grade_categories")
      .insert({
        cohort_id: gradebookCohortId,
        name: newCategoryName.trim(),
        weight: Number(newCategoryWeight),
        display_order: categories.length + 1,
      });
    if (insertError) setError(insertError.message);
    else {
      setNewCategoryName("");
      setNewCategoryWeight("0");
      await refreshGradebookSetup();
    }
    setSetupSaving(false);
  };

  const saveCategoryWeight = async (category: GradeCategory) => {
    setSetupSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("grade_categories")
      .update({ weight: category.weight })
      .eq("id", category.id);
    if (updateError) setError(updateError.message);
    setSetupSaving(false);
  };

  const saveManualGrade = async () => {
    const enrolment = students.find((item) => item.id === manualEnrolmentId);
    const numericScore = Number(manualScore);
    const numericMax = Number(manualMax);
    if (
      !enrolment ||
      !manualCategoryId ||
      !manualItemName.trim() ||
      manualReason.trim().length < 3 ||
      !Number.isFinite(numericScore) ||
      !Number.isFinite(numericMax) ||
      numericMax <= 0 ||
      numericScore < 0 ||
      numericScore > numericMax
    ) {
      setError("Choose a student and category, then enter a valid score.");
      return;
    }
    setSetupSaving(true);
    setError("");
    let { data: item, error: itemError } = await supabase
      .from("grade_items")
      .select("id,max_points")
      .eq("grade_category_id", manualCategoryId)
      .eq("name", manualItemName.trim())
      .is("assignment_id", null)
      .is("assessment_id", null)
      .limit(1)
      .maybeSingle();
    if (!item && !itemError) {
      const created = await supabase
        .from("grade_items")
        .insert({
          grade_category_id: manualCategoryId,
          name: manualItemName.trim(),
          max_points: numericMax,
        })
        .select("id,max_points")
        .single();
      item = created.data;
      itemError = created.error;
    }
    if (item && Number(item.max_points) !== numericMax) {
      setError(
        `This grade item already uses a maximum of ${item.max_points}. Enter that maximum or use a different item name.`,
      );
      setSetupSaving(false);
      return;
    }
    if (itemError || !item) {
      setError(itemError?.message || "Could not create the grade item.");
      setSetupSaving(false);
      return;
    }
    const percentage = Math.round((numericScore / numericMax) * 10000) / 100;
    const letter =
      percentage >= 90
        ? "A"
        : percentage >= 80
          ? "B"
          : percentage >= 70
            ? "C"
            : percentage >= 60
              ? "D"
              : "F";
    const { error: gradeError } = await supabase.from("grades").upsert(
      {
        grade_item_id: item.id,
        enrolment_id: enrolment.id,
        student_id: enrolment.student_id,
        score: numericScore,
        max_score: numericMax,
        percentage,
        letter_grade: letter,
        feedback: manualFeedback || null,
        override_reason: manualReason.trim(),
        graded_by: user?.id,
        graded_at: new Date().toISOString(),
      },
      { onConflict: "grade_item_id,enrolment_id" },
    );
    if (gradeError) setError(gradeError.message);
    else {
      setManualItemName("");
      setManualScore("");
      setManualFeedback("");
      setManualReason("");
    }
    setSetupSaving(false);
  };
  const beginAssessmentReview = async (row: AssessmentReviewRow) => {
    setError("");
    const { data, error: questionError } = await supabase
      .from("assessment_questions")
      .select("id,question_type,question_text,points")
      .eq("assessment_id", row.assessment_id)
      .in("question_type", ["short_answer", "long_answer"])
      .order("display_order");
    if (questionError) {
      setError(questionError.message);
      return;
    }
    setReviewQuestions((data ?? []) as ReviewQuestion[]);
    setReviewScores({});
    setReviewFeedback("");
    setReviewingAttemptId(row.id);
  };
  const submitAssessmentReview = async (row: AssessmentReviewRow) => {
    if (
      reviewQuestions.some((question) => {
        const score = Number(reviewScores[question.id]);
        return (
          reviewScores[question.id] === undefined ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > question.points
        );
      })
    ) {
      setError("Score every written response within its point range.");
      return;
    }
    setSetupSaving(true);
    setError("");
    const numericScores = Object.fromEntries(
      Object.entries(reviewScores).map(([key, value]) => [key, Number(value)]),
    );
    const { error: reviewError } = await supabase.rpc(
      "review_assessment_attempt",
      {
        attempt_uuid: row.id,
        manual_scores: numericScores,
        feedback_text: reviewFeedback || null,
      },
    );
    if (reviewError)
      setError(
        `${reviewError.message}. Apply migration 012 before reviewing written assessments.`,
      );
    else {
      setReviewingAttemptId("");
      await load();
    }
    setSetupSaving(false);
  };
  const openFile = async (path: string) => {
    const { data, error: signedError } = await supabase.storage
      .from("assignment-submissions")
      .createSignedUrl(path, 600);
    if (signedError) setError(signedError.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const save = async (row: SubmissionRow) => {
    const numeric = Number(grade);
    const max = Number(row.assignment.max_points);
    const isOverride = row.grade != null && Number(row.grade) !== numeric;
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) {
      setError(`Enter a score between 0 and ${max}.`);
      return;
    }
    if (isOverride && overrideReason.trim().length < 3) {
      setError("Add a short reason when changing a released grade.");
      return;
    }
    const percentage = max > 0 ? Math.round((numeric / max) * 10000) / 100 : 0;
    const letter =
      percentage >= 90
        ? "A"
        : percentage >= 80
          ? "B"
          : percentage >= 70
            ? "C"
            : percentage >= 60
              ? "D"
              : "F";
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        grade: numeric,
        max_grade: max,
        feedback,
        graded_by: user?.id,
        graded_at: new Date().toISOString(),
        status: "graded",
      })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (row.assignment.cohort_id) {
      let { data: category } = await supabase
        .from("grade_categories")
        .select("id")
        .eq("cohort_id", row.assignment.cohort_id)
        .eq("name", "Assignments")
        .maybeSingle();
      if (!category) {
        const created = await supabase
          .from("grade_categories")
          .insert({
            cohort_id: row.assignment.cohort_id,
            name: "Assignments",
            weight: 0,
            display_order: 1,
          })
          .select("id")
          .single();
        category = created.data;
        if (created.error) {
          setError(created.error.message);
          return;
        }
      }
      if (!category) {
        setError("Could not create the grade category.");
        return;
      }
      let { data: item } = await supabase
        .from("grade_items")
        .select("id")
        .eq("assignment_id", row.assignment_id)
        .maybeSingle();
      if (!item) {
        const created = await supabase
          .from("grade_items")
          .insert({
            grade_category_id: category.id,
            assignment_id: row.assignment_id,
            name: row.assignment.title,
            max_points: max,
            due_date: row.assignment.due_date,
          })
          .select("id")
          .single();
        item = created.data;
        if (created.error) {
          setError(created.error.message);
          return;
        }
      }
      if (!item) {
        setError("Could not create the grade item.");
        return;
      }
      const { error: gradeError } = await supabase.from("grades").upsert(
        {
          grade_item_id: item.id,
          enrolment_id: row.enrolment_id,
          student_id: row.student_id,
          score: numeric,
          max_score: max,
          percentage,
          letter_grade: letter,
          feedback,
          override_reason: isOverride ? overrideReason.trim() : null,
          graded_by: user?.id,
          graded_at: new Date().toISOString(),
        },
        { onConflict: "grade_item_id,enrolment_id" },
      );
      if (gradeError) {
        setError(gradeError.message);
        return;
      }
    }
    setEditing("");
    setOverrideReason("");
    await load();
  };
  return (
    <AppLayout>
      <PageHeader
        title="Gradebook"
        subtitle="Grade submitted work, configure weighted categories, and record practical or external assessments."
      />
      <div className="mt-6 space-y-6">
        <FormPanel
          title="Gradebook setup & manual grades"
          description="Set category weights and record work completed outside an online assignment or quiz."
          open={setupOpen}
          onToggle={() => setSetupOpen(!setupOpen)}
          actionLabel="Manage gradebook"
        >
          <div className="space-y-6">
            <Field label="Cohort">
              <CohortSelect
                value={gradebookCohortId}
                onChange={(value) => {
                  setGradebookCohortId(value);
                  setManualCategoryId("");
                  setManualEnrolmentId("");
                }}
              />
            </Field>
            {gradebookCohortId && (
              <>
                <section>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-ink-900">
                        Grade categories
                      </h2>
                      <p className="mt-1 text-xs text-ink-500">
                        Current total: {categories.reduce((sum, item) => sum + Number(item.weight), 0)}%. Use 100% for a fully weighted final grade.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {categories.map((category, index) => (
                      <div
                        key={category.id}
                        className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink-900">
                            {category.name}
                          </p>
                          <p className="text-xs text-ink-500">
                            Category {index + 1}
                          </p>
                        </div>
                        <Field label="Weight %">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="input"
                            value={category.weight}
                            onChange={(event) =>
                              setCategories((current) =>
                                current.map((item) =>
                                  item.id === category.id
                                    ? { ...item, weight: Number(event.target.value) }
                                    : item,
                                ),
                              )
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={setupSaving}
                          onClick={() => void saveCategoryWeight(category)}
                        >
                          Save
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                    <Field label="New category">
                      <input
                        className="input"
                        placeholder="Presentation"
                        value={newCategoryName}
                        onChange={(event) => setNewCategoryName(event.target.value)}
                      />
                    </Field>
                    <Field label="Weight %">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input"
                        value={newCategoryWeight}
                        onChange={(event) => setNewCategoryWeight(event.target.value)}
                      />
                    </Field>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={setupSaving || !newCategoryName.trim()}
                      onClick={() => void addCategory()}
                    >
                      Add category
                    </button>
                  </div>
                </section>

                <section className="border-t border-ink-100 pt-5">
                  <h2 className="font-semibold text-ink-900">
                    Record a manual grade
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    Use this for presentations, practical work, exams, or other activities completed outside the assignment uploader.
                  </p>
                  {categories.length === 0 ? (
                    <Alert>Create at least one grade category first.</Alert>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Student">
                        <select
                          className="input"
                          value={manualEnrolmentId}
                          onChange={(event) => setManualEnrolmentId(event.target.value)}
                        >
                          <option value="">Select student</option>
                          {students.map((item) => (
                            <option key={item.id} value={item.id}>
                              {fullName(item.student)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Category">
                        <select
                          className="input"
                          value={manualCategoryId}
                          onChange={(event) => setManualCategoryId(event.target.value)}
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Grade item">
                        <input
                          className="input"
                          placeholder="Final presentation"
                          value={manualItemName}
                          onChange={(event) => setManualItemName(event.target.value)}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Score">
                          <input
                            type="number"
                            min="0"
                            className="input"
                            value={manualScore}
                            onChange={(event) => setManualScore(event.target.value)}
                          />
                        </Field>
                        <Field label="Out of">
                          <input
                            type="number"
                            min="0.01"
                            className="input"
                            value={manualMax}
                            onChange={(event) => setManualMax(event.target.value)}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Private feedback">
                          <textarea
                            className="input min-h-20"
                            value={manualFeedback}
                            onChange={(event) => setManualFeedback(event.target.value)}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Entry or change reason">
                          <input
                            required
                            className="input"
                            value={manualReason}
                            onChange={(event) => setManualReason(event.target.value)}
                            placeholder="For example: final presentation rubric"
                          />
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="btn-primary sm:col-span-2 sm:justify-self-end"
                        disabled={setupSaving || manualReason.trim().length < 3}
                        onClick={() => void saveManualGrade()}
                      >
                        Record grade
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </FormPanel>
        <PageState
          loading={loading}
          error={error}
          empty={!rows.length && !reviewRows.length}
          icon={<GraduationCap size={30} />}
        >
          <div className="space-y-4">
            {reviewRows.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h2 className="font-semibold text-ink-900">
                    Written assessments awaiting review
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    Objective questions are already scored; review each written response to release the final result.
                  </p>
                </div>
                {reviewRows.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-xl border border-brand-100 bg-white p-5 shadow-soft"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-ink-900">
                          {row.assessment.title}
                        </h3>
                        <p className="mt-1 text-sm text-ink-500">
                          {fullName(row.student)} · objective score {row.score}/{row.max_score}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-primary self-start"
                        onClick={() => void beginAssessmentReview(row)}
                      >
                        Review responses
                      </button>
                    </div>
                    {reviewingAttemptId === row.id && (
                      <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
                        {reviewQuestions.map((question) => (
                          <div key={question.id} className="rounded-lg bg-ink-50 p-4">
                            <p className="text-sm font-medium text-ink-900">
                              {question.question_text}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-700">
                              {String(row.answers[question.id] ?? "No response")}
                            </p>
                            <div className="mt-3 max-w-40">
                              <Field label={`Score / ${question.points}`}>
                                <input
                                  type="number"
                                  min="0"
                                  max={question.points}
                                  className="input"
                                  value={reviewScores[question.id] ?? ""}
                                  onChange={(event) =>
                                    setReviewScores((current) => ({
                                      ...current,
                                      [question.id]: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        ))}
                        <Field label="Feedback for the student">
                          <textarea
                            className="input min-h-24"
                            value={reviewFeedback}
                            onChange={(event) => setReviewFeedback(event.target.value)}
                          />
                        </Field>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={setupSaving}
                          onClick={() => void submitAssessmentReview(row)}
                        >
                          Release final score
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink-900">
                      {row.assignment.title}
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">
                      {fullName(row.student)} · submitted{" "}
                      {formatDateTime(row.submitted_at)}
                    </p>
                    <div className="mt-4 rounded-lg bg-ink-50 p-4 whitespace-pre-wrap text-sm leading-6 text-ink-700">
                      {row.content || "No written response."}
                    </div>
                    {row.submission_files?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.submission_files.map((file) => (
                          <button
                            key={file.id}
                            className="btn-secondary !py-2"
                            onClick={() => void openFile(file.file_path)}
                          >
                            {file.file_name}
                            {file.attempt_number
                              ? ` · Attempt ${file.attempt_number}`
                              : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-primary self-start"
                    onClick={() => {
                      setEditing(row.id);
                      setGrade(String(row.grade ?? ""));
                      setFeedback(row.feedback ?? "");
                      setOverrideReason("");
                    }}
                  >
                    Grade
                  </button>
                </div>
                {editing === row.id && (
                  <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-[10rem_1fr_auto]">
                    <Field label={`Score / ${row.assignment.max_points}`}>
                      <input
                        required
                        type="number"
                        min="0"
                        max={row.assignment.max_points}
                        className="input"
                        value={grade}
                        onChange={(event) => setGrade(event.target.value)}
                      />
                    </Field>
                    <Field label="Feedback">
                      <textarea
                        className="input min-h-20"
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                      />
                    </Field>
                    {row.grade != null && Number(grade) !== Number(row.grade) && (
                      <div className="sm:col-span-2">
                        <Field label="Grade-change reason">
                          <input
                            required
                            className="input"
                            value={overrideReason}
                            onChange={(event) => setOverrideReason(event.target.value)}
                            placeholder="Why is this released grade changing?"
                          />
                        </Field>
                      </div>
                    )}
                    <button
                      className="btn-primary self-end"
                      disabled={grade === ""}
                      onClick={() => void save(row)}
                    >
                      <CheckCircle2 size={16} />
                      {row.grade == null ? "Return grade" : "Save grade"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </PageState>
      </div>
    </AppLayout>
  );
}

type StudentRow = Enrolment & {
  student: Profile;
  cohort: { name: string; course: { title: string } };
  progress_records: ProgressRecord[];
  instructor_notes: Array<{
    id: string;
    note: string;
    author_id: string;
    created_at: string;
  }>;
};
export function InstructorStudents() {
  const { user } = useAuth();
  const { cohorts, loading: cohortLoading } = useInstructorCohorts();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [noteEnrolmentId, setNoteEnrolmentId] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ids = cohorts.map((item) => item.id);
  const load = async () => {
    if (cohortLoading) return;
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("enrolments")
      .select(
        "*,student:profiles!enrolments_student_id_fkey(*),cohort:cohorts(name,course:courses(title)),progress_records(*),instructor_notes(*)",
      )
      .in("cohort_id", ids)
      .order("enrolled_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as unknown as StudentRow[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortLoading, ids.join(",")]);
  const saveNote = async (enrolmentId: string) => {
    if (!user || !note.trim()) return;
    setSavingNote(true);
    setError("");
    const { error: insertError } = await supabase.from("instructor_notes").insert({
      enrolment_id: enrolmentId,
      author_id: user.id,
      note: note.trim(),
    });
    if (insertError)
      setError(
        `${insertError.message}. Apply migration 012 before saving private instructor notes.`,
      );
    else {
      setNote("");
      setNoteEnrolmentId("");
      await load();
    }
    setSavingNote(false);
  };
  return (
    <AppLayout>
      <PageHeader
        title="Students"
        subtitle="Roster, enrolment status, and lesson progress across your cohorts."
      />
      <div className="mt-6">
        <PageState
          loading={loading}
          error={error}
          empty={!rows.length}
          icon={<Users size={30} />}
        >
          <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
            {rows.map((row) => {
              const progress = row.progress_records.length
                ? Math.round(
                    row.progress_records.reduce(
                      (sum, item) => sum + Number(item.progress_percent),
                      0,
                    ) / row.progress_records.length,
                  )
                : 0;
              return (
                <article
                  key={row.id}
                  className="px-5 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <UserRound size={18} />
                      </div>
                      <div>
                        <h2 className="font-medium text-ink-900">
                          {fullName(row.student)}
                        </h2>
                        <p className="text-xs text-ink-500">
                          {row.cohort.course.title} · {row.cohort.name}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-ink-700">
                      {progress}% complete
                    </span>
                    <span
                      className={
                        row.status === "active"
                          ? "badge-success"
                          : "badge-neutral"
                      }
                    >
                      {row.status}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost self-start sm:self-auto"
                      onClick={() => {
                        setNoteEnrolmentId(
                          noteEnrolmentId === row.id ? "" : row.id,
                        );
                        setNote("");
                      }}
                    >
                      Private note
                    </button>
                  </div>
                  {row.instructor_notes?.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                      {row.instructor_notes
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                        )
                        .map((item) => (
                          <div key={item.id} className="rounded-lg bg-warning-50 px-3 py-2">
                            <p className="whitespace-pre-wrap text-sm text-ink-700">
                              {item.note}
                            </p>
                            <p className="mt-1 text-xs text-ink-500">
                              Staff only · {formatDateTime(item.created_at)}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                  {noteEnrolmentId === row.id && (
                    <div className="mt-3 grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label="Private instructor note">
                        <textarea
                          className="input min-h-20"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                        />
                      </Field>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={savingNote || !note.trim()}
                        onClick={() => void saveNote(row.id)}
                      >
                        Save note
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </PageState>
      </div>
    </AppLayout>
  );
}

export function InstructorCommunications() {
  const { user } = useAuth();
  const { cohorts, loading: cohortLoading } = useInstructorCohorts();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [form, setForm] = useState({
    cohort_id: "",
    title: "",
    body: "",
    is_pinned: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ids = cohorts.map((item) => item.id);
  const load = async () => {
    if (cohortLoading) return;
    if (!ids.length) {
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("announcements")
      .select("*")
      .in("cohort_id", ids)
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as Announcement[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [cohortLoading, ids.join(",")]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error: insertError } = await supabase.from("announcements").insert({
      ...form,
      author_id: user?.id,
      is_published: true,
      published_at: new Date().toISOString(),
    });
    if (insertError) setError(insertError.message);
    else {
      setForm({ cohort_id: "", title: "", body: "", is_pinned: false });
      await load();
    }
    setSaving(false);
  };
  return (
    <AppLayout>
      <PageHeader
        title="Communications"
        subtitle="Post timely updates to the students in your cohorts."
      />
      <div className="mt-6 space-y-5">
        <DirectMessagesPanel role="instructor" />
        <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <form
            onSubmit={save}
            className="self-start rounded-xl bg-white p-5 shadow-soft"
          >
            <h2 className="font-semibold text-ink-900">New announcement</h2>
            <div className="mt-4 space-y-4">
              {error && <Alert>{error}</Alert>}
              <Field label="Cohort">
                <CohortSelect
                  value={form.cohort_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, cohort_id: value }))
                  }
                />
              </Field>
              <Field label="Title">
                <input
                  required
                  className="input"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Message">
                <textarea
                  required
                  className="input min-h-32"
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                />
              </Field>
              <label className="flex gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_pinned: event.target.checked,
                    }))
                  }
                />{" "}
                Pin this update
              </label>
              <SubmitButton loading={saving} className="w-full">
                <Send size={16} />
                Publish
              </SubmitButton>
            </div>
          </form>
          <PageState
            loading={loading}
            error=""
            empty={!rows.length}
            icon={<Megaphone size={30} />}
          >
            <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
              {rows.map((row) => (
                <article key={row.id} className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-ink-900">{row.title}</h2>
                    {row.is_pinned && (
                      <span className="badge-warning">Pinned</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    {row.body}
                  </p>
                  <p className="mt-2 text-xs text-ink-500">
                    {formatDateTime(row.published_at)}
                  </p>
                </article>
              ))}
            </div>
          </PageState>
        </div>
      </div>
    </AppLayout>
  );
}
