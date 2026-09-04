import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardCheck,
  BookOpen,
  LockKeyhole,
  ListChecks,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { LearningFlow } from "./LearningFlow";
import { moduleLabel } from "./courseFormatting";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import courseContent from "@/content/ai-business-essentials.json";
import type { Assessment, Lesson, Module, ProgressRecord } from "@/types";

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
type PathModule = Module & { lessons: Lesson[] };
type PathActivity = { id: string; title: string; module_id: string | null; submissions: Array<{ status: string }> };
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
  const [pathModules, setPathModules] = useState<PathModule[]>([]);
  const [pathActivities, setPathActivities] = useState<PathActivity[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
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
      .select("id,cohort:cohorts(course_id)")
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
    const courseId = (enrolmentResult.data.cohort as unknown as { course_id: string }).course_id;
    const [assessmentResult, progressResult, moduleResult, releaseResult, activityResult] = await Promise.all([
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
      supabase
        .from("modules")
        .select("*,lessons(*)")
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("display_order")
        .order("display_order", { referencedTable: "lessons" }),
      supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
      supabase.from("assignments").select("id,title,module_id,submissions(status)").eq("cohort_id", cohortId).eq("assignment_type", "activity").eq("is_published", true).eq("submissions.student_id", user.id),
    ]);
    const queryError = assessmentResult.error || progressResult.error || moduleResult.error || activityResult.error;
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
      setPathModules((moduleResult.data ?? []) as unknown as PathModule[]);
      setPathActivities((activityResult.data ?? []) as unknown as PathActivity[]);
      setReleasedLessonIds(
        releaseResult.error
          ? (moduleResult.data ?? []).flatMap((module) =>
              (module.lessons as unknown as Lesson[])
                .filter((lesson) => lesson.is_published)
                .map((lesson) => lesson.id),
            )
          : ((releaseResult.data ?? []) as string[]),
      );
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
    if (isModuleCheck(assessment)) {
      const activity = pathActivities.find((item) => item.module_id === assessment.module_id);
      return !activity || activity.submissions.some((submission) => ["submitted", "graded"].includes(submission.status));
    }
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
    if (!available(assessment) && !review) {
      setError(isModuleCheck(assessment) ? "Complete and submit the matching activity before starting this module check." : "Complete the required course steps before starting this assessment.");
      return;
    }
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

  const practiceChecks = assessments.filter(isModuleCheck);
  const graded = assessments.filter((item) => !isModuleCheck(item));
  const learningCheckActive = Boolean(
    assessmentId && quiz && practiceChecks.some((item) => item.id === quiz.id),
  );
  const activeAssessment = quiz ? assessments.find((item) => item.id === quiz.id) : null;
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
        <>
        {learningCheckActive && <div className="mb-4"><LearningFlow active="assess" hasActivity={pathActivities.some((activity) => activity.module_id === activeAssessment?.module_id)} hasAssessment /></div>}
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
          learningFrame={learningCheckActive}
          learningRail={
            learningCheckActive ? (
              <AssessmentLearningRail
                modules={pathModules}
                assessments={practiceChecks}
                activities={pathActivities}
                progress={progress}
                releasedLessonIds={releasedLessonIds}
                cohortId={cohortId || ""}
                currentAssessmentId={quiz.id}
              />
            ) : undefined
          }
        />
        </>
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

function AssessmentLearningRail({
  modules,
  assessments,
  activities,
  progress,
  releasedLessonIds,
  cohortId,
  currentAssessmentId,
}: {
  modules: PathModule[];
  assessments: AssessmentRow[];
  activities: PathActivity[];
  progress: ProgressRecord[];
  releasedLessonIds: string[];
  cohortId: string;
  currentAssessmentId: string;
}) {
  const completedLessonIds = new Set(
    progress
      .filter((record) => record.status === "completed")
      .map((record) => record.lesson_id),
  );
  const publishedLessons = modules.flatMap((module) =>
    module.lessons.filter((lesson) => lesson.is_published),
  );
  const passedChecks = assessments.filter((assessment) =>
    assessment.assessment_attempts.some(
      (attempt) =>
        attempt.status === "completed" &&
        Number(attempt.percentage) >= Number(assessment.passing_score ?? 0),
    ),
  );
  const completedActivities = activities.filter((activity) => activity.submissions.some((submission) => ["submitted", "graded"].includes(submission.status)));
  const totalSteps = publishedLessons.length + assessments.length + activities.length;
  const completedSteps =
    publishedLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length +
    passedChecks.length + completedActivities.length;
  const courseProgress = totalSteps
    ? Math.round((completedSteps / totalSteps) * 100)
    : 0;

  return (
    <aside
      className="hidden min-h-0 flex-col border-r border-ink-200 bg-ink-50 text-ink-900 lg:flex"
      aria-label="Course modules and module checks"
    >
      <div className="border-b border-ink-200 px-5 py-5">
        <p className="text-sm font-semibold">Course progress</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-200">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${courseProgress}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-brand-700">
            {courseProgress}%
          </span>
        </div>
      </div>
      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Learning pathway">
        {modules.map((module) => {
          const lesson = module.lessons.find((item) => item.is_published);
          if (!lesson) return null;
          const previousModule = modules.find((item) => item.display_order === module.display_order - 1);
          const previousCheck = previousModule ? assessments.find((item) => item.module_id === previousModule.id) : null;
          const previousActivity = previousModule ? activities.find((item) => item.module_id === previousModule.id) : null;
          const previousLesson = previousModule?.lessons.find((item) => item.is_published);
          const pathwayReleased = module.display_order === 0 || (module.display_order === 1
            ? Boolean(previousLesson && completedLessonIds.has(previousLesson.id))
            : Boolean(previousModule && (previousCheck
            ? passedChecks.some((item) => item.id === previousCheck.id)
            : previousActivity
              ? completedActivities.some((item) => item.id === previousActivity.id)
              : previousLesson && completedLessonIds.has(previousLesson.id))));
          const released = releasedLessonIds.includes(lesson.id) && pathwayReleased;
          const completed = completedLessonIds.has(lesson.id);
          const check = assessments.find((item) => item.module_id === module.id);
          const activity = activities.find((item) => item.module_id === module.id);
          const activityComplete = activity ? completedActivities.some((item) => item.id === activity.id) : true;
          const checkPassed = check
            ? passedChecks.some((item) => item.id === check.id)
            : false;
          const checkCurrent = check?.id === currentAssessmentId;
          const moduleLabel = module.display_order === 0 ? "Introduction" : `Module ${module.display_order}`;
          const current = checkCurrent;
          const finishedSteps = Number(completed) + Number(activity ? activityComplete : false) + Number(check ? checkPassed : false);
          const stepCount = 1 + Number(Boolean(activity)) + Number(Boolean(check));
          return (
            <details key={module.id} name="assessment-pathway" open={current || undefined} className={`group mb-1 rounded-lg ${current ? "bg-white shadow-[0_1px_3px_rgba(19,56,92,0.10)]" : "open:bg-white/70"}`}>
              <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden ${released ? "hover:bg-white/80" : "opacity-55"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${completed ? "bg-success-600 text-white" : released ? "border border-brand-100 bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-400"}`}>{completed ? <CheckCircle2 size={15} /> : released ? <BookOpen size={14} /> : <LockKeyhole size={13} />}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink-900">{moduleLabel}</span><span className="mt-0.5 block truncate text-[11px] text-ink-500">{module.title.replace(/^Module \d+: /, "")}</span></span><span className="text-[10px] font-semibold tabular-nums text-ink-400">{finishedSteps}/{stepCount}</span><ChevronDown size={14} className="text-ink-400 transition-transform group-open:rotate-180" /></summary>
              <div className="pb-2">
              {released ? <Link to={`/student/courses/${cohortId}/learn/${lesson.id}`} className="ml-8 flex min-h-9 items-center gap-2 rounded-md border-l-2 border-brand-200 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50"><BookOpen size={12} className="shrink-0" /><span className="min-w-0 flex-1 truncate">Learn it</span><span className="shrink-0 text-[10px] text-ink-500">{completed ? "Completed" : "In progress"}</span></Link> : <div className="ml-8 flex min-h-9 items-center gap-2 rounded-md border-l-2 border-ink-200 px-2 py-1 text-[11px] text-ink-400"><LockKeyhole size={11} className="shrink-0" /><span className="truncate">Learn it</span></div>}
              {activity && (() => {
                const content = <><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${activityComplete ? "bg-success-100 text-success-700" : completed ? "bg-violet-100 text-violet-700" : "bg-ink-100 text-ink-400"}`}>{activityComplete ? <CheckCircle2 size={12} /> : completed ? <ListChecks size={12} /> : <LockKeyhole size={11} />}</span><span className="min-w-0"><span className={`block truncate text-[11px] font-medium ${completed ? "text-violet-900" : "text-ink-500"}`}>Do it</span><span className="mt-0.5 block truncate text-[10px] leading-4 text-ink-500">{activityComplete ? "Activity submitted" : completed ? "Ready to practice" : "Finish learning first"}</span></span></>;
                const className = `ml-8 mt-0 flex min-h-9 items-center gap-2 rounded-md border-l-2 px-2 py-1 transition-colors ${completed ? "border-violet-300 bg-violet-50/55 hover:bg-violet-100/70" : "border-ink-200 bg-ink-50/50 opacity-60"}`;
                return completed ? <Link to={`/student/courses/${cohortId}/learn/activity/${activity.id}`} className={`${className} outline-none focus-visible:ring-2 focus-visible:ring-violet-400`}>{content}</Link> : <div className={className}>{content}</div>;
              })()}
              {check && (() => {
                const checkAvailable = completed && activityComplete;
                const checkContent = (
                  <>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${checkPassed ? "bg-success-100 text-success-700" : checkAvailable ? "bg-accent-100 text-accent-800" : "bg-ink-100 text-ink-400"}`}>
                      {checkPassed ? <CheckCircle2 size={12} /> : checkAvailable ? <ClipboardCheck size={12} /> : <LockKeyhole size={11} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-[11px] font-medium ${checkAvailable ? "text-accent-900" : "text-ink-500"}`}>Assess it</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-ink-500">{checkCurrent ? "Current check" : checkPassed ? "Passed · Retake anytime" : checkAvailable ? "Ready · Unlimited attempts" : completed && activity ? "Finish the activity first" : "Finish learning first"}</span>
                    </span>
                  </>
                );
                const checkClass = `ml-8 mt-0 flex min-h-9 items-center gap-2 rounded-md border-l-2 px-2 py-1 transition-colors ${checkCurrent ? "border-accent-500 bg-accent-100/80" : checkPassed ? "border-success-300 bg-success-50/55" : completed ? "border-accent-300 bg-accent-50/55 hover:bg-accent-100/70" : "border-ink-200 bg-ink-50/50 opacity-60"}`;
                return checkAvailable ? (
                  <Link
                    to={`/student/courses/${cohortId}/learn/check/${check.id}`}
                    aria-current={checkCurrent ? "page" : undefined}
                    className={`${checkClass} outline-none focus-visible:ring-2 focus-visible:ring-accent-400`}
                  >
                    {checkContent}
                  </Link>
                ) : <div className={checkClass}>{checkContent}</div>;
              })()}
              </div>
            </details>
          );
        })}
      </nav>
      <div className="border-t border-ink-200 px-5 py-4 text-xs leading-5 text-ink-500">
        Pass this check to unlock the next module.
      </div>
    </aside>
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
  learningFrame = false,
  learningRail,
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
  learningFrame?: boolean;
  learningRail?: ReactNode;
}) {
  const question = quiz.questions[currentQuestion];
  const checked = feedback[question?.id];
  const checkedCount = Object.keys(feedback).length;
  const correctCount = Object.values(feedback).filter(
    (item) => item.correct,
  ).length;
  const incorrectCount = checkedCount - correctCount;
  const progressPercent = Math.round(
    ((currentQuestion + 1) / quiz.questions.length) * 100,
  );
  const isLast = currentQuestion === quiz.questions.length - 1;
  if (!question) return null;
  return (
    <section
      id="assessment-workspace"
      className={`overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated ${learningFrame ? "mt-4 flex h-[calc(100dvh-13.5rem)] min-h-[30rem] max-h-[42rem] flex-col" : "mt-6"}`}
      aria-labelledby="assessment-title"
    >
      <header className={`border-b border-ink-200 px-5 sm:px-6 ${learningFrame ? "py-2" : "py-4"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-700">
              {reviewMode ? "Review mode" : learningFrame ? "Learning pathway · Module check" : "Assessment attempt"}
            </p>
            <h2
              id="assessment-title"
              className={`${learningFrame ? "mt-0.5 text-lg sm:text-xl" : "mt-1 text-xl"} truncate font-semibold text-ink-950`}
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
        <div className={`${learningFrame ? "mt-2" : "mt-3"} flex items-center gap-3`}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {learningFrame ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums">
              <span className="rounded-md bg-success-50 px-2 py-0.5 text-success-700" aria-label={`${correctCount} correct`}>
                ✓ {correctCount}
              </span>
              <span className="rounded-md bg-danger-50 px-2 py-0.5 text-danger-700" aria-label={`${incorrectCount} incorrect`}>
                ✕ {incorrectCount}
              </span>
            </span>
          ) : (
            <span className="text-xs font-semibold tabular-nums text-brand-700">
              {progressPercent}%
            </span>
          )}
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
          <div className={`grid min-h-[24rem] ${learningFrame ? "min-h-0 flex-1 lg:grid-cols-[15rem_minmax(0,1fr)]" : "lg:h-[24rem] lg:grid-cols-[13rem_minmax(0,1fr)]"}`}>
            {learningFrame ? learningRail : (
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
            )}
            <div className={`flex min-w-0 flex-col p-5 sm:p-7 ${learningFrame ? "scrollbar-thin min-h-0 overflow-y-auto" : ""}`}>
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
