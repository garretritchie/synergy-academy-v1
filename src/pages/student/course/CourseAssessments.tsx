import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { moduleLabel } from "./courseFormatting";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import courseContent from "@/content/ai-business-essentials.json";
import type { Assessment, ProgressRecord } from "@/types";

type AssessmentModule = { id: string; title: string; display_order: number };
type Attempt = {
  id: string;
  status: string;
  percentage: number | null;
  completed_at: string | null;
  answers: Record<string, string> | null;
};
type AssessmentRow = Assessment & {
  module: AssessmentModule | null;
  assessment_attempts: Attempt[];
};
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
type AssessmentResult = {
  percentage: number | null;
  passed: boolean | null;
  pending_review: boolean;
};
type QuestionFeedback = {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
};

const isModuleCheck = (assessment: AssessmentRow) =>
  assessment.assessment_type === "practice";

export function CourseAssessments() {
  const { cohortId, assessmentId } = useParams<{
    cohortId: string;
    assessmentId?: string;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [enrolmentId, setEnrolmentId] = useState("");
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [quiz, setQuiz] = useState<StudentAssessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, QuestionFeedback>>(
    {},
  );
  const [reviewMode, setReviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const autoStartedAssessment = useRef("");

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
    const [assessmentResult, progressResult] = await Promise.all([
      supabase
        .from("assessments")
        .select(
          "*,module:modules(id,title,display_order),assessment_attempts(id,status,percentage,completed_at,answers)",
        )
        .eq("cohort_id", cohortId)
        .eq("is_published", true)
        .eq("assessment_attempts.enrolment_id", enrolmentResult.data.id),
      supabase
        .from("progress_records")
        .select("*")
        .eq("cohort_id", cohortId)
        .eq("student_id", user.id),
    ]);
    const queryError = assessmentResult.error || progressResult.error;
    if (queryError) setError(queryError.message);
    else {
      setAssessments(
        ((assessmentResult.data ?? []) as unknown as AssessmentRow[]).sort(
          (a, b) =>
            (a.module?.display_order ?? 99) - (b.module?.display_order ?? 99) ||
            a.title.localeCompare(b.title),
        ),
      );
      setProgress((progressResult.data ?? []) as ProgressRecord[]);
    }
    setLoading(false);
  }, [cohortId, user]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (quiz) document.getElementById("assessment-workspace")?.scrollIntoView();
  }, [quiz]);
  const completedLessonIds = useMemo(
    () =>
      new Set(
        progress
          .filter((item) => item.status === "completed")
          .map((item) => item.lesson_id),
      ),
    [progress],
  );
  const passedModuleOrders = useMemo(
    () =>
      new Set(
        assessments
          .filter(
            (item) =>
              isModuleCheck(item) &&
              item.assessment_attempts.some(
                (attempt) =>
                  attempt.status === "completed" &&
                  Number(attempt.percentage) >= Number(item.passing_score ?? 0),
              ),
          )
          .map((item) => item.module?.display_order ?? -1),
      ),
    [assessments],
  );
  const available = (assessment: AssessmentRow) => {
    if (assessment.lesson_id && !completedLessonIds.has(assessment.lesson_id))
      return false;
    if (isModuleCheck(assessment)) return true;
    if (assessment.title.includes("Graded Quiz 1"))
      return [1, 2, 3].every((item) => passedModuleOrders.has(item));
    if (assessment.title.includes("Midterm"))
      return [1, 2, 3, 4, 5, 6].every((item) => passedModuleOrders.has(item));
    if (assessment.title.includes("Graded Quiz 3"))
      return [7, 8, 9].every((item) => passedModuleOrders.has(item));
    if (assessment.title.includes("Final Exam"))
      return Array.from({ length: 12 }, (_, index) => index + 1).every((item) =>
        passedModuleOrders.has(item),
      );
    return true;
  };

  const start = async (assessment: AssessmentRow, review = false) => {
    if (!available(assessment) && !review) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc(
      "get_assessment_for_student",
      { assessment_uuid: assessment.id },
    );
    if (rpcError) setError(rpcError.message);
    else {
      const loadedQuiz = data as StudentAssessment;
      const latestAttempt = [...assessment.assessment_attempts].sort((a, b) =>
        String(b.completed_at).localeCompare(String(a.completed_at)),
      )[0];
      const reviewAnswers = review ? (latestAttempt?.answers ?? {}) : {};
      const reviewFeedback = review
        ? Object.fromEntries(
            loadedQuiz.questions.map((question) => {
              const key = localAnswerKey(
                loadedQuiz.title,
                question.question_text,
              );
              return [
                question.id,
                {
                  ...key,
                  correct: reviewAnswers[question.id] === key.correctAnswer,
                },
              ];
            }),
          )
        : {};
      setQuiz(loadedQuiz);
      setAnswers(reviewAnswers);
      setFeedback(reviewFeedback);
      setReviewMode(review);
      setCurrentQuestion(0);
      setResult(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setSaving(false);
  };

  useEffect(() => {
    if (
      !assessmentId ||
      loading ||
      quiz ||
      autoStartedAssessment.current === assessmentId
    ) return;
    const linkedCheck = assessments.find(
      (assessment) => assessment.id === assessmentId && isModuleCheck(assessment),
    );
    if (!linkedCheck) return;
    autoStartedAssessment.current = assessmentId;
    void start(linkedCheck);
    // The assessment id is the one-time trigger; start uses the current loaded row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, assessments, loading, quiz]);
  const checkAnswer = async () => {
    if (!quiz) return;
    const question = quiz.questions[currentQuestion];
    const selectedAnswer = answers[question.id];
    if (!selectedAnswer) return;
    setSaving(true);
    setError("");
    const { data, error: checkError } = await supabase.rpc(
      "check_assessment_answer",
      { question_uuid: question.id, selected_answer: selectedAnswer },
    );
    const checked =
      !checkError && data
        ? {
            correct: Boolean(data.correct),
            correctAnswer: String(data.correct_answer),
            explanation: String(data.explanation || ""),
          }
        : localAnswerKey(quiz.title, question.question_text, selectedAnswer);
    setFeedback((current) => ({ ...current, [question.id]: checked }));
    setSaving(false);
  };
  const submit = async () => {
    if (!quiz) return;
    setSaving(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc(
      "submit_assessment_attempt",
      {
        assessment_uuid: quiz.id,
        enrolment_uuid: enrolmentId,
        submitted_answers: answers,
      },
    );
    if (rpcError) setError(rpcError.message);
    else {
      setResult(data as AssessmentResult);
      await load();
    }
    setSaving(false);
  };

  const graded = assessments.filter((item) => !isModuleCheck(item));
  return (
    <CourseLayout>
      {!quiz && (
        <PageHeader
          title="Assessments"
          subtitle="Graded checkpoints, the midterm, and the final exam unlock at the required course points. Module checks now live inside Learning."
        />
      )}
      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {quiz && (
        <AssessmentWorkspace
          quiz={quiz}
          answers={answers}
          feedback={feedback}
          currentQuestion={currentQuestion}
          reviewMode={reviewMode}
          result={result}
          saving={saving}
          onAnswer={(id, value) =>
            setAnswers((current) => ({ ...current, [id]: value }))
          }
          onCheck={() => void checkAnswer()}
          onPrevious={() =>
            setCurrentQuestion((current) => Math.max(0, current - 1))
          }
          onNext={() =>
            setCurrentQuestion((current) =>
              Math.min(quiz.questions.length - 1, current + 1),
            )
          }
          onClose={() => {
            if (assessmentId) navigate(`/student/courses/${cohortId}/learn`);
            else setQuiz(null);
          }}
          onSubmit={() => void submit()}
          cohortId={cohortId || ""}
        />
      )}
      {!quiz &&
        (loading ? (
          <div className="mt-6 rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : graded.length === 0 ? (
          <div className="mt-6 rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<BrainCircuit size={30} />}
              title="No assessments yet"
              description="Published graded checkpoints and exams will appear here."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            <AssessmentGroup
              title="Graded assessments"
              description="Three quiz-category checkpoints, including the midterm, and the final exam."
              rows={graded}
              focusedModule={searchParams.get("module")}
              available={available}
              saving={saving}
              onStart={start}
            />
          </div>
        ))}
    </CourseLayout>
  );
}

function AssessmentGroup({
  title,
  description,
  rows,
  focusedModule,
  available,
  saving,
  onStart,
}: {
  title: string;
  description: string;
  rows: AssessmentRow[];
  focusedModule: string | null;
  available: (assessment: AssessmentRow) => boolean;
  saving: boolean;
  onStart: (assessment: AssessmentRow, review?: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-brand-100 bg-brand-50/35 p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-ink-950">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">{description}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rows.map((assessment) => {
          const unlocked = available(assessment);
          const attempts = assessment.assessment_attempts || [];
          const best = Math.max(
            ...attempts.map((item) => Number(item.percentage ?? 0)),
            0,
          );
          const passed = attempts.some(
            (item) =>
              item.status === "completed" &&
              Number(item.percentage) >= Number(assessment.passing_score ?? 0),
          );
          const moduleKey = assessment.module?.display_order
            ? `module-${String(assessment.module.display_order).padStart(2, "0")}`
            : "";
          const attemptLimitReached =
            !isModuleCheck(assessment) &&
            attempts.length >= assessment.max_attempts;
          const canReview = attempts.length > 0;
          return (
            <article
              id={moduleKey}
              key={assessment.id}
              className={`rounded-2xl border bg-white p-4 shadow-soft transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-elevated ${focusedModule === moduleKey ? "border-brand-400 ring-2 ring-brand-100" : "border-ink-200/80"}`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${passed ? "bg-success-50 text-success-700" : unlocked ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-400"}`}
                >
                  {passed ? (
                    <CheckCircle2 size={21} />
                  ) : unlocked ? (
                    <BrainCircuit size={21} />
                  ) : (
                    <LockKeyhole size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
                    {moduleLabel(assessment.module)}
                  </p>
                  <h3 className="mt-1 font-semibold text-ink-950">
                    {assessment.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink-600">
                    {assessment.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-500">
                    <span className="rounded-full bg-ink-50 px-2.5 py-1">
                      <Clock3 size={12} className="mr-1 inline" />
                      {assessment.time_limit_minutes || "No"} min
                    </span>
                    <span className="rounded-full bg-ink-50 px-2.5 py-1">
                      {isModuleCheck(assessment)
                        ? `${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"}, unlimited`
                        : `${attempts.length}/1 attempt`}
                    </span>
                    {attempts.length > 0 && (
                      <span className="rounded-full bg-success-50 px-2.5 py-1 text-success-700">
                        Best {best}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {canReview && (
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={saving}
                    onClick={() => onStart(assessment, true)}
                  >
                    Review questions
                  </button>
                )}
                <button
                  type="button"
                  className={
                    unlocked ? "btn-primary w-full" : "btn-secondary w-full"
                  }
                  disabled={!unlocked || saving || attemptLimitReached}
                  onClick={() => onStart(assessment, false)}
                >
                  {!unlocked ? (
                    "Locked"
                  ) : attemptLimitReached ? (
                    "Attempt used"
                  ) : attempts.length ? (
                    <>
                      <RotateCcw size={16} /> Start attempt{" "}
                      {attempts.length + 1}
                    </>
                  ) : (
                    "Start assessment"
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AssessmentWorkspace({
  quiz,
  answers,
  feedback,
  currentQuestion,
  reviewMode,
  result,
  saving,
  onAnswer,
  onCheck,
  onPrevious,
  onNext,
  onClose,
  onSubmit,
  cohortId,
}: {
  quiz: StudentAssessment;
  answers: Record<string, string>;
  feedback: Record<string, QuestionFeedback>;
  currentQuestion: number;
  reviewMode: boolean;
  result: AssessmentResult | null;
  saving: boolean;
  onAnswer: (id: string, value: string) => void;
  onCheck: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onSubmit: () => void;
  cohortId: string;
}) {
  const question = quiz.questions[currentQuestion];
  const checked = feedback[question?.id];
  const checkedCount = Object.keys(feedback).length;
  const correctCount = Object.values(feedback).filter(
    (item) => item.correct,
  ).length;
  const progressPercent = Math.round(
    ((currentQuestion + 1) / quiz.questions.length) * 100,
  );
  const isLast = currentQuestion === quiz.questions.length - 1;
  if (!question) return null;
  return (
    <section
      id="assessment-workspace"
      className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated"
      aria-labelledby="assessment-title"
    >
      <header className="border-b border-ink-200 px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-700">
              {reviewMode ? "Review mode" : "Assessment attempt"}
            </p>
            <h2
              id="assessment-title"
              className="mt-1 truncate text-xl font-semibold text-ink-950"
            >
              {quiz.title}
            </h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
            aria-label="Close assessment"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-brand-700">
            {progressPercent}%
          </span>
        </div>
      </header>
      {result ? (
        <div
          className={`m-5 rounded-xl p-6 sm:m-6 ${result.passed ? "bg-success-50 text-success-800" : "bg-warning-50 text-warning-900"}`}
        >
          <p className="text-3xl font-semibold tabular-nums">
            {result.percentage}%
          </p>
          <p className="mt-2 font-semibold">
            {result.passed
              ? "Assessment passed."
              : "Review the module before your next attempt."}
          </p>
          <p className="mt-1 text-sm">
            You can review these questions at any time without using another
            attempt.
          </p>
          <Link
            className="btn-primary mt-5"
            to={`/student/courses/${cohortId}/learn`}
          >
            Return to Learning <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid min-h-[24rem] lg:h-[24rem] lg:grid-cols-[13rem_minmax(0,1fr)]">
            <aside className="hidden border-r border-ink-200 bg-ink-50 p-5 text-ink-900 lg:block">
              <p className="text-xs font-semibold text-brand-700">Live score</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {correctCount}/{checkedCount || 0}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                correct answers checked
              </p>
              <div className="mt-6 grid grid-cols-5 gap-2">
                {quiz.questions.map((item, index) => (
                  <span
                    key={item.id}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold ${index === currentQuestion ? "border-brand-600 bg-brand-600 text-white" : feedback[item.id]?.correct ? "border-success-200 bg-success-50 text-success-700" : feedback[item.id] ? "border-danger-200 bg-danger-50 text-danger-700" : "border-ink-200 bg-white text-ink-500"}`}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            </aside>
            <div className="flex min-w-0 flex-col p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Question {currentQuestion + 1} of {quiz.questions.length}
                </p>
                <p className="text-xs text-ink-500">
                  {quiz.passing_score}% to pass
                </p>
              </div>
              <h3 className="mt-3 max-w-3xl text-xl font-semibold leading-7 text-ink-950">
                {question.question_text}
              </h3>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => {
                  const typed = option as { value?: string; label?: string };
                  const value =
                    typeof option === "string"
                      ? option
                      : String(typed.value ?? typed.label ?? optionIndex);
                  const label =
                    typeof option === "string"
                      ? option
                      : String(typed.label ?? value);
                  const selected = answers[question.id] === value;
                  const correctOption = checked?.correctAnswer === value;
                  return (
                    <label
                      key={value}
                      className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${correctOption ? "border-success-300 bg-success-50 text-success-900" : checked && selected ? "border-danger-300 bg-danger-50 text-danger-900" : selected ? "border-brand-400 bg-brand-50 text-brand-950" : "border-ink-200 bg-ink-50 text-ink-700 hover:border-brand-200"}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={value}
                        checked={selected}
                        disabled={Boolean(checked) || reviewMode}
                        onChange={(event) =>
                          onAnswer(question.id, event.target.value)
                        }
                      />
                      <span>{label}</span>
                      {correctOption && (
                        <CheckCircle2
                          size={18}
                          className="ml-auto shrink-0 text-success-600"
                        />
                      )}
                      {checked && selected && !correctOption && (
                        <XCircle
                          size={18}
                          className="ml-auto shrink-0 text-danger-600"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {checked && (
                <div
                  className={`mt-4 flex gap-3 rounded-xl border p-4 ${checked.correct ? "border-success-200 bg-success-50 text-success-900" : "border-danger-200 bg-danger-50 text-danger-900"}`}
                >
                  {checked.correct ? (
                    <CheckCircle2 size={20} className="shrink-0" />
                  ) : (
                    <XCircle size={20} className="shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {checked.correct
                        ? "Correct"
                        : `Not quite. The correct answer is: ${checked.correctAnswer}`}
                    </p>
                    {checked.explanation && (
                      <p className="mt-1 text-sm leading-5">
                        {checked.explanation}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <footer className="border-t border-ink-200 bg-ink-50/90 px-5 py-3">
            <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={currentQuestion === 0}
                  onClick={onPrevious}
                >
                  <ArrowLeft size={16} /> Previous
                </button>
              </div>
              <p className="order-first col-span-2 text-center text-xs font-semibold text-ink-600 sm:order-none sm:col-span-1">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </p>
              <div className="flex justify-end">
                {reviewMode ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={isLast ? onClose : onNext}
                  >
                    {isLast ? (
                      "Finish review"
                    ) : (
                      <>
                        Next <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                ) : !checked ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!answers[question.id] || saving}
                    onClick={onCheck}
                  >
                    {saving ? "Checking..." : "Check answer"}
                  </button>
                ) : !isLast ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onNext}
                  >
                    Next question <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary !bg-success-600 hover:!bg-success-700"
                    disabled={checkedCount !== quiz.questions.length || saving}
                    onClick={onSubmit}
                  >
                    {saving ? "Submitting..." : "Finish assessment"}
                  </button>
                )}
              </div>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

function localAnswerKey(
  title: string,
  questionText: string,
  selectedAnswer = "",
): QuestionFeedback {
  const assessments = courseContent.assessments as Array<{
    title: string;
    questions: Array<{ question: string; answer: string; explanation: string }>;
  }>;
  const source = assessments
    .find((assessment) => assessment.title === title)
    ?.questions.find((question) => question.question === questionText);
  const correctAnswer = source?.answer ?? "";
  return {
    correct: selectedAnswer === correctAnswer,
    correctAnswer,
    explanation:
      source?.explanation ??
      "Review the related learning screen for this answer.",
  };
}
