import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  LockKeyhole,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
import { useLearningPath } from "@/hooks/useLearningPath";
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
type ActivityGate = { id: string; module_id: string | null; submissions: Array<{ status: string }> };

export function CourseLearn() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const path=useLearningPath(cohortId);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [, setReleased] = useState<string[]>([]);
  const [passedChecks, setPassedChecks] = useState<string[]>([]);
  const [moduleChecks, setModuleChecks] = useState<AssessmentGate[]>([]);
  const [moduleActivities, setModuleActivities] = useState<ActivityGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('academy-module-view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const changeView = (next: 'grid' | 'list') => {
    setView(next);
    try { localStorage.setItem('academy-module-view', next); } catch { /* Session preference still works. */ }
  };

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
      const [moduleResult, progressResult, releaseResult, assessmentResult, activityResult] =
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
          supabase.from("assignments").select("id,module_id,submissions(status)").eq("cohort_id", cohortId).eq("assignment_type", "activity").eq("is_published", true).eq("submissions.student_id", user.id),
        ]);
      const queryError =
        moduleResult.error ||
        progressResult.error ||
        releaseResult.error ||
        assessmentResult.error ||
        activityResult.error;
      if (queryError) setError(queryError.message);
      else {
        setModules((moduleResult.data ?? []) as unknown as ModuleRow[]);
        setProgress((progressResult.data ?? []) as ProgressRecord[]);
        setReleased((releaseResult.data ?? []) as string[]);
        const checks = (assessmentResult.data ??
          []) as unknown as AssessmentGate[];
        setModuleChecks(checks);
        setModuleActivities((activityResult.data ?? []) as unknown as ActivityGate[]);
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
  const completedActivityCount = moduleActivities.filter((activity) => activity.submissions.some((submission) => ["submitted", "graded"].includes(submission.status))).length;
  const courseStepCount = publishedLessons.length + moduleChecks.length + moduleActivities.length;
  const completedStepCount = completedCount + passedChecks.length + completedActivityCount;
  const coursePercent = path.percentage;
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
        actions={<div className="inline-flex rounded-lg border border-brand-200 bg-white p-1" role="group" aria-label="Module layout">{([{ id: 'grid', label: 'Grid', Icon: LayoutGrid }, { id: 'list', label: 'List', Icon: List }] as const).map(({id,label,Icon}) => <button key={id} type="button" aria-pressed={view === id} onClick={() => changeView(id)} className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold ${view === id ? 'bg-brand-700 text-white' : 'text-ink-600 hover:bg-brand-50'}`}><Icon size={15}/>{label}</button>)}</div>}
      />
      <div className="mt-6">
        {(error || path.error) && <Alert>{error || path.error}</Alert>}
        {loading || path.loading ? (
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
              className="grid divide-y divide-ink-200 rounded-xl border border-ink-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0"
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
                  The steps published for this course
                </p>
              </SummaryTile>
              <SummaryTile
                label="Completed"
                value={`${completedStepCount}/${courseStepCount}`}
              >
                <p className="mt-2 text-xs text-ink-500">
                  Learn, Do, and Assess steps
                </p>
              </SummaryTile>
            </section>
            <div className={view === 'grid' ? 'mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'module-list mt-5 grid gap-3'}>
              {modules.map((module) => {
                const moduleSteps=path.steps.filter(s=>s.moduleId===module.id);
                const destination=moduleSteps.find(s=>s.available&&!s.done) ?? moduleSteps.find(s=>s.available);
                const lesson = module.lessons.find((item) => item.is_published);
                if (!lesson) return null;
                const available =
                  Boolean(destination);
                const record = progress.find(
                  (item) => item.lesson_id === lesson.id,
                );
                const complete = moduleSteps.length>0 && moduleSteps.every(s=>s.done);
                const percent = moduleSteps.length?Math.round(moduleSteps.filter(s=>s.done).length/moduleSteps.length*100):0;
                const isIntroduction = module.display_order === 0;
                const assessmentStatus = assessmentStatusByModule.get(
                  module.id,
                );
                const cardBody = (
                  <ModuleTile
                    module={module}
                    lesson={lesson}
                    available={available}
                    lockReason={moduleSteps.find(step => !step.available)?.reason || 'Waiting for your instructor to release this module.'}
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
                    className="module-card module-card-available group"
                  >
                    <Link
                      to={destination?.href ?? `/student/courses/${cohortId}/learn/${lesson.id}`}
                      className="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                    >
                      {cardBody}
                    </Link>
                  </article>
                ) : (
                  <article
                    key={module.id}
                    className="module-card module-card-locked"
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
    <div className="p-4">
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
  lockReason,
  complete,
  percent,
  isIntroduction,
  started,
  assessmentScore,
}: {
  module: ModuleRow;
  lesson: Lesson;
  available: boolean;
  lockReason: string;
  complete: boolean;
  percent: number;
  isIntroduction: boolean;
  started: boolean;
  assessmentScore: string;
}) {
  return (
    <>
      <div className="module-card-head">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${complete ? 'bg-success-100 text-success-800' : available ? 'bg-brand-100 text-brand-800' : 'bg-ink-200 text-ink-600'}`}>
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
          <p className="text-xs font-semibold text-ink-700">
            {isIntroduction
              ? "Introduction"
              : `Module ${String(module.display_order).padStart(2, "0")}`}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${complete ? "bg-success-100 text-success-800" : available ? "bg-white text-brand-800" : "bg-ink-200 text-ink-600"}`}
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
      <div className="module-card-body">
      <h2 className="text-base font-semibold leading-6 text-ink-950">
        {isIntroduction
          ? "Course Introduction"
          : module.title.replace(/^Module \d+: /, "")}
      </h2>
      {module.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink-600">
          {module.description}
        </p>
      )}
      <dl className="mt-auto grid grid-cols-2 gap-3 pt-3 text-xs">
        <div><dt className="text-ink-500">Estimated time</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-ink-800"><Clock size={13} />{lesson.estimated_minutes ?? 0} min</dd></div>
        <div className="text-right"><dt className="text-ink-500">Assessment score</dt><dd className="mt-1 font-semibold tabular-nums text-ink-800">{assessmentScore}</dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
        <span>Module progress</span>
        <span className="font-semibold tabular-nums text-ink-700">
          {percent}%
        </span>
      </div>
      <div role="progressbar" aria-label="Module progress" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-200">
        <div
          className={`h-full rounded-full ${complete ? "bg-success-600" : "bg-brand-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className={`mt-3 flex items-center justify-between border-t border-ink-200 pt-3 text-sm font-semibold ${available ? "text-brand-700" : "text-ink-500"}`}
      >
        <span>
          {complete
            ? "Review module"
            : available
              ? started
                ? "Continue learning"
                : "Start learning"
              : lockReason}
        </span>
        {available && <ArrowRight size={17} />}
      </div>
      </div>
    </>
  );
}
