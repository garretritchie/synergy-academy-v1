import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Assessment, Lesson, Module, ProgressRecord } from "@/types";

type ModuleRow = Module & { lessons: Lesson[] };
type AssessmentGate = Pick<Assessment, "id" | "module_id" | "passing_score"> & {
  assessment_attempts: Array<{
    status: string;
    percentage: number | null;
    completed_at: string | null;
  }>;
};

export function CourseLearn() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [released, setReleased] = useState<string[]>([]);
  const [passedChecks, setPassedChecks] = useState<string[]>([]);
  const [moduleChecks, setModuleChecks] = useState<AssessmentGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cohortId || !user) return;
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
      const [moduleResult, progressResult, releaseResult, assessmentResult] =
        await Promise.all([
          supabase
            .from("modules")
            .select("*,lessons(*)")
            .eq("course_id", cohort.course_id)
            .eq("is_published", true)
            .order("display_order")
            .order("display_order", { referencedTable: "lessons" }),
          supabase
            .from("progress_records")
            .select("*")
            .eq("cohort_id", cohortId)
            .eq("student_id", user.id),
          supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
          supabase
            .from("assessments")
            .select(
              "id,module_id,passing_score,assessment_attempts(status,percentage,completed_at)",
            )
            .eq("cohort_id", cohortId)
            .eq("assessment_type", "practice")
            .eq("assessment_attempts.student_id", user.id),
        ]);
      const queryError =
        moduleResult.error ||
        progressResult.error ||
        releaseResult.error ||
        assessmentResult.error;
      if (queryError) setError(queryError.message);
      else {
        setModules((moduleResult.data ?? []) as unknown as ModuleRow[]);
        setProgress((progressResult.data ?? []) as ProgressRecord[]);
        setReleased((releaseResult.data ?? []) as string[]);
        const checks = (assessmentResult.data ??
          []) as unknown as AssessmentGate[];
        setModuleChecks(checks);
        setPassedChecks(
          checks
            .filter((assessment) =>
              assessment.assessment_attempts.some(
                (attempt) =>
                  attempt.status === "completed" &&
                  Number(attempt.percentage) >=
                    Number(assessment.passing_score ?? 0),
              ),
            )
            .map((assessment) => assessment.module_id || ""),
        );
      }
      setLoading(false);
    })();
  }, [cohortId, user]);

  const publishedLessons = useMemo(
    () =>
      modules.flatMap((module) =>
        module.lessons.filter((lesson) => lesson.is_published),
      ),
    [modules],
  );
  const completedCount = publishedLessons.filter((lesson) =>
    progress.some(
      (item) => item.lesson_id === lesson.id && item.status === "completed",
    ),
  ).length;
  const coursePercent = publishedLessons.length
    ? Math.round((completedCount / publishedLessons.length) * 100)
    : 0;
  const assessmentStatusByModule = useMemo(() => {
    const statuses = new Map<
      string,
      { hasAssessment: boolean; latestScore: number | null }
    >();
    for (const assessment of moduleChecks) {
      if (!assessment.module_id) continue;
      const latestAttempt = assessment.assessment_attempts
        .filter((attempt) => attempt.status === "completed")
        .sort(
          (left, right) =>
            new Date(right.completed_at || 0).getTime() -
            new Date(left.completed_at || 0).getTime(),
        )[0];
      statuses.set(assessment.module_id, {
        hasAssessment: true,
        latestScore:
          latestAttempt?.percentage === null ||
          latestAttempt?.percentage === undefined
            ? null
            : Math.round(Number(latestAttempt.percentage)),
      });
    }
    return statuses;
  }, [moduleChecks]);

  return (
    <CourseLayout>
      <PageHeader
        title="Learning"
        subtitle="Build your skills one clear eLearning screen at a time."
      />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : modules.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-ink-500">
            <BookOpen className="mx-auto mb-2 text-ink-300" />
            The curriculum has not been published yet.
          </div>
        ) : (
          <>
            <section
              className="grid gap-3 sm:grid-cols-3"
              aria-label="Learning progress summary"
            >
              <SummaryTile label="Course progress" value={`${coursePercent}%`}>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${coursePercent}%` }}
                  />
                </div>
              </SummaryTile>
              <SummaryTile
                label="Learning modules"
                value={publishedLessons.length}
              >
                <p className="mt-2 text-xs text-ink-500">
                  Introduction plus 12 modules
                </p>
              </SummaryTile>
              <SummaryTile
                label="Completed"
                value={`${completedCount}/${publishedLessons.length}`}
              >
                <p className="mt-2 text-xs text-ink-500">
                  Checks unlock the next module
                </p>
              </SummaryTile>
            </section>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module, moduleIndex) => {
                const previousModule = modules[moduleIndex - 1];
                const previousLesson = previousModule?.lessons.find(
                  (lesson) => lesson.is_published,
                );
                const previousLearningComplete =
                  !previousLesson ||
                  progress.some(
                    (item) =>
                      item.lesson_id === previousLesson.id &&
                      item.status === "completed",
                  );
                const pathwayUnlocked =
                  module.display_order === 0 ||
                  (module.display_order === 1
                    ? previousLearningComplete
                    : Boolean(
                        previousModule &&
                          passedChecks.includes(previousModule.id),
                      ));
                const lesson = module.lessons.find((item) => item.is_published);
                if (!lesson) return null;
                const available =
                  pathwayUnlocked && released.includes(lesson.id);
                const record = progress.find(
                  (item) => item.lesson_id === lesson.id,
                );
                const complete = record?.status === "completed";
                const percent = complete
                  ? 100
                  : Number(record?.progress_percent ?? 0);
                const isIntroduction = module.display_order === 0;
                const assessmentStatus = assessmentStatusByModule.get(
                  module.id,
                );
                const cardBody = (
                  <ModuleTile
                    module={module}
                    lesson={lesson}
                    available={available}
                    complete={complete}
                    percent={percent}
                    isIntroduction={isIntroduction}
                    started={Boolean(record)}
                    assessmentScore={
                      assessmentStatus?.latestScore === null ||
                      assessmentStatus?.latestScore === undefined
                        ? assessmentStatus?.hasAssessment
                          ? "Not taken"
                          : "N/A"
                        : `${assessmentStatus.latestScore}%`
                    }
                  />
                );
                return available ? (
                  <article
                    key={module.id}
                    className={`group overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-elevated ${isIntroduction ? "md:col-span-2 xl:col-span-3" : ""}`}
                  >
                    <Link
                      to={`/student/courses/${cohortId}/learn/${lesson.id}`}
                      className="block p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                    >
                      {cardBody}
                    </Link>
                    {!isIntroduction && complete && assessmentStatus?.hasAssessment && (
                      <div className="border-t border-brand-100 bg-brand-50/60 p-3">
                        <Link
                          to={`/student/courses/${cohortId}/learn/check/${moduleChecks.find((check) => check.module_id === module.id)?.id}`}
                          className="btn-primary w-full"
                        >
                          {assessmentStatus.latestScore === null ? "Take module check" : "Review or retake module check"}
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    )}
                  </article>
                ) : (
                  <article
                    key={module.id}
                    className="rounded-2xl border border-ink-200/70 bg-white/70 p-5 opacity-70 shadow-soft"
                  >
                    {cardBody}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </CourseLayout>
  );
}

function SummaryTile({
  label,
  value,
  children,
}: {
  label: string;
  value: string | number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white p-4 shadow-soft">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-950">
        {value}
      </p>
      {children}
    </div>
  );
}

function ModuleTile({
  module,
  lesson,
  available,
  complete,
  percent,
  isIntroduction,
  started,
  assessmentScore,
}: {
  module: ModuleRow;
  lesson: Lesson;
  available: boolean;
  complete: boolean;
  percent: number;
  isIntroduction: boolean;
  started: boolean;
  assessmentScore: string;
}) {
  return (
    <>
      <div className="-mx-5 -mt-5 mb-5 flex h-24 items-end justify-between overflow-hidden rounded-t-2xl bg-gradient-to-br from-navy via-brand-800 to-brand-500 px-5 py-4 text-white">
        <div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/12">
            {complete ? (
              <CheckCircle2 size={19} />
            ) : isIntroduction ? (
              <Sparkles size={18} />
            ) : available ? (
              <BookOpen size={18} />
            ) : (
              <LockKeyhole size={16} />
            )}
          </span>
          <p className="mt-2 text-xs font-semibold text-brand-100">
            {isIntroduction
              ? "Course orientation"
              : `Module ${String(module.display_order).padStart(2, "0")}`}
          </p>
        </div>
        <span className="text-5xl font-semibold leading-none text-white/15">
          {isIntroduction ? "I" : String(module.display_order).padStart(2, "0")}
        </span>
      </div>
      <div className="flex justify-end">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${complete ? "bg-success-50 text-success-700" : available ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"}`}
        >
          {complete
            ? "Completed"
            : available
              ? started
                ? "Continue"
                : "Ready"
              : "Locked"}
        </span>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
        {isIntroduction ? "Start here" : `Module ${module.display_order}`}
      </p>
      <h2 className="mt-1.5 text-lg font-semibold leading-6 text-ink-950">
        {isIntroduction
          ? "Course Introduction"
          : module.title.replace(/^Module \d+: /, "")}
      </h2>
      {module.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink-600">
          {module.description}
        </p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-ink-50 px-3 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} />
          {lesson.estimated_minutes ?? 0} minutes
        </span>
        <span className="text-right text-ink-500">
          Assessment score{" "}
          <strong className="font-semibold tabular-nums text-ink-800">
            {assessmentScore}
          </strong>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
        <span>Learning progress</span>
        <span className="font-semibold tabular-nums text-ink-700">
          {percent}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${complete ? "bg-success-600" : "bg-brand-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className={`mt-5 flex items-center justify-between border-t border-ink-100 pt-4 text-sm font-semibold ${available ? "text-brand-700" : "text-ink-400"}`}
      >
        <span>
          {complete
            ? "Review module"
            : available
              ? started
                ? "Continue learning"
                : "Start learning"
              : "Complete the previous step"}
        </span>
        {available && <ArrowRight size={17} />}
      </div>
    </>
  );
}
