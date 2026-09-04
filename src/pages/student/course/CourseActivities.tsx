import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ChevronDown, Circle, ClipboardCheck, FileText, FileUp, ListChecks, LockKeyhole, NotebookPen, Save, Send, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CourseLayout } from "./CourseLayout";
import { LearningFlow } from "./LearningFlow";
import { moduleLabel, parseStructuredInstructions } from "./courseFormatting";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Assignment, Lesson, Module, ProgressRecord, Submission } from "@/types";

type ActivityRow = Assignment & { module: { title: string; display_order: number } | null; submissions: Submission[] };
type PathModule = Module & { lessons: Lesson[] };
type PathCheck = { id: string; title: string; module_id: string | null; passing_score: number | null; assessment_attempts: Array<{ status: string; percentage: number | null }> };
type ActivityResponse = { version: 1; work: string; notes: string; evidenceSummary: string; selfCheck: boolean[]; selfCheckItems?: string[]; completedAt?: string };

const blankResponse = (length: number): ActivityResponse => ({ version: 1, work: "", notes: "", evidenceSummary: "", selfCheck: Array.from({ length }, () => false) });

function readResponse(content: string | null, checklistLength: number) {
  if (!content) return blankResponse(checklistLength);
  try {
    const value = JSON.parse(content) as Partial<ActivityResponse>;
    return { ...blankResponse(checklistLength), ...value, selfCheck: Array.from({ length: checklistLength }, (_, index) => Boolean(value.selfCheck?.[index])) };
  } catch {
    return { ...blankResponse(checklistLength), work: content };
  }
}

export function CourseActivities() {
  const { cohortId, activityId } = useParams<{ cohortId: string; activityId?: string }>();
  const [searchParams] = useSearchParams();
  const requestedActivity = activityId ?? searchParams.get("activity");
  const embedded = Boolean(activityId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enrolmentId, setEnrolmentId] = useState("");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [moduleChecks, setModuleChecks] = useState<PathCheck[]>([]);
  const [pathModules, setPathModules] = useState<PathModule[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState("");
  const [responses, setResponses] = useState<Record<string, ActivityResponse>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cohortId || !user) return;
    setLoading(true);
    const enrolmentResult = await supabase.from("enrolments").select("id,cohort:cohorts(course_id)").eq("cohort_id", cohortId).eq("student_id", user.id).eq("status", "active").single();
    if (enrolmentResult.error) { setError(enrolmentResult.error.message); setLoading(false); return; }
    setEnrolmentId(enrolmentResult.data.id);
    const courseId = (enrolmentResult.data.cohort as unknown as { course_id: string }).course_id;
    const [activityResult, progressResult, checkResult, moduleResult, releaseResult] = await Promise.all([
      supabase.from("assignments").select("*,module:modules(title,display_order),submissions(*)").eq("cohort_id", cohortId).eq("assignment_type", "activity").eq("is_published", true).eq("submissions.enrolment_id", enrolmentResult.data.id),
      supabase.from("progress_records").select("*").eq("cohort_id", cohortId).eq("student_id", user.id),
      supabase.from("assessments").select("id,title,module_id,passing_score,assessment_attempts(status,percentage)").eq("cohort_id", cohortId).eq("assessment_type", "practice").eq("is_published", true).eq("assessment_attempts.enrolment_id", enrolmentResult.data.id),
      supabase.from("modules").select("*,lessons(*)").eq("course_id", courseId).eq("is_published", true).order("display_order").order("display_order", { referencedTable: "lessons" }),
      supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
    ]);
    const queryError = activityResult.error || progressResult.error || checkResult.error || moduleResult.error;
    if (queryError) setError(queryError.message);
    else {
      const sorted = ((activityResult.data ?? []) as unknown as ActivityRow[]).sort((a, b) => (a.module?.display_order ?? 99) - (b.module?.display_order ?? 99));
      setActivities(sorted);
      setProgress((progressResult.data ?? []) as ProgressRecord[]);
      setModuleChecks((checkResult.data ?? []) as unknown as PathCheck[]);
      setPathModules((moduleResult.data ?? []) as unknown as PathModule[]);
      setReleasedLessonIds(releaseResult.error ? (moduleResult.data ?? []).flatMap((module) => (module.lessons as unknown as Lesson[]).filter((lesson) => lesson.is_published).map((lesson) => lesson.id)) : ((releaseResult.data ?? []) as string[]));
      setOpenId((current) => (requestedActivity && sorted.some((item) => item.id === requestedActivity) ? requestedActivity : current) || sorted.find((item) => !item.submissions.some((submission) => ["submitted", "graded"].includes(submission.status)))?.id || sorted[0]?.id || "");
    }
    setLoading(false);
  }, [cohortId, requestedActivity, user]);

  useEffect(() => { void load(); }, [load]);
  const completedLessons = useMemo(() => new Set(progress.filter((item) => item.status === "completed").map((item) => item.lesson_id)), [progress]);
  const active = activities.find((item) => item.id === openId) ?? null;
  const structured = active ? parseStructuredInstructions(active.description) : null;
  const activeResponse = active && structured ? responses[active.id] ?? readResponse(active.submissions[0]?.content ?? null, structured.checklist.length) : null;
  const activeModuleCheck = active ? moduleChecks.find((item) => item.module_id === active.module_id) : null;
  const activeModuleOrder = active?.module?.display_order ?? -1;
  const nextLearningLesson = pathModules.find((module) => module.display_order === activeModuleOrder + 1)?.lessons.find((lesson) => lesson.is_published);
  const completedActivities = useMemo(() => new Set(activities.filter((activity) => activity.submissions.some((submission) => ["submitted", "graded"].includes(submission.status))).map((activity) => activity.id)), [activities]);
  const passedChecks = useMemo(() => new Set(moduleChecks.filter((check) => check.assessment_attempts.some((attempt) => attempt.status === "completed" && Number(attempt.percentage) >= Number(check.passing_score ?? 0))).map((check) => check.id)), [moduleChecks]);
  const updateResponse = (activityId: string, next: ActivityResponse) => setResponses((current) => ({ ...current, [activityId]: next }));

  const saveActivity = async (activity: ActivityRow, submit: boolean) => {
    if (!user) return;
    const activityStructure = parseStructuredInstructions(activity.description);
    const response = responses[activity.id] ?? readResponse(activity.submissions[0]?.content ?? null, activityStructure.checklist.length);
    if (submit && !response.selfCheck.every(Boolean)) { setError("Complete every self-check item before submitting this activity."); return; }
    setSaving(true); setError("");
    const payload = { ...response, selfCheckItems: activityStructure.checklist, ...(submit ? { completedAt: new Date().toISOString() } : {}) };
    const { data: submission, error: saveError } = await supabase.from("submissions").upsert({ assignment_id: activity.id, enrolment_id: enrolmentId, student_id: user.id, content: JSON.stringify(payload), status: submit ? "submitted" : "draft", submitted_at: submit ? new Date().toISOString() : null, is_late: false, max_grade: activity.max_points }, { onConflict: "assignment_id,enrolment_id" }).select().single();
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    for (const file of files[activity.id] ?? []) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${submission.id}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage.from("assignment-submissions").upload(path, file);
      if (upload.error) { setError(`${file.name} could not upload: ${upload.error.message}`); setSaving(false); return; }
      const fileResult = await supabase.from("submission_files").insert({ submission_id: submission.id, file_name: file.name, file_path: path, file_size: file.size, file_type: file.type });
      if (fileResult.error) { setError(fileResult.error.message); setSaving(false); return; }
    }
    setFiles((current) => ({ ...current, [activity.id]: [] }));
    await load(); setSaving(false);
  };

  return (
    <CourseLayout>
      {!embedded && <PageHeader title="Activity workspace" subtitle="Apply what you learned, record your thinking, and submit clear evidence of your work." />}
      <div className={embedded ? "mb-4" : "mt-5"}><LearningFlow active="do" hasActivity hasAssessment={Boolean(activeModuleCheck)} /></div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading ? <div className="rounded-xl bg-white shadow-soft"><TableSkeleton /></div> : activities.length === 0 ? <div className="rounded-xl bg-white shadow-soft"><EmptyState icon={<ListChecks size={30} />} title="No activities yet" description="This course does not currently include activities. Continue with the available learning steps." /></div> : (
        <div className={`${embedded ? "h-[calc(100dvh-13.5rem)] min-h-[30rem] max-h-[42rem] lg:grid-cols-[15rem_minmax(0,1fr)]" : "mt-5 min-h-[34rem] lg:grid-cols-[18rem_minmax(0,1fr)]"} grid overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated`}>
          {embedded ? <ActivityPathRail cohortId={cohortId ?? ""} modules={pathModules} activities={activities} checks={moduleChecks} currentActivityId={active?.id ?? ""} completedLessonIds={completedLessons} completedActivityIds={completedActivities} passedCheckIds={passedChecks} releasedLessonIds={new Set(releasedLessonIds)} /> : <aside className="border-b border-ink-200 bg-ink-50/80 lg:border-b-0 lg:border-r">
            <div className="border-b border-ink-200 px-4 py-4"><p className="text-sm font-semibold text-ink-900">Course activities</p><p className="mt-1 text-xs text-ink-500">{activities.filter((item) => item.submissions.some((submission) => ["submitted", "graded"].includes(submission.status))).length} of {activities.length} submitted</p></div>
            <nav className="max-h-72 overflow-y-auto p-2 lg:max-h-[31rem]" aria-label="Course activities">
              {activities.map((activity) => {
                const unlocked = !activity.lesson_id || completedLessons.has(activity.lesson_id);
                const done = activity.submissions.some((submission) => ["submitted", "graded"].includes(submission.status));
                const selected = activity.id === openId;
                return <button key={activity.id} type="button" disabled={!unlocked} onClick={() => unlocked && navigate(`/student/courses/${cohortId}/learn/activity/${activity.id}`)} className={`mb-1 flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left transition-colors ${selected ? "bg-white shadow-sm ring-1 ring-brand-100" : unlocked ? "hover:bg-white/80" : "cursor-not-allowed opacity-50"}`}><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? "bg-success-100 text-success-700" : selected ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"}`}>{done ? <CheckCircle2 size={14} /> : unlocked ? <ListChecks size={14} /> : <LockKeyhole size={13} />}</span><span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-700">{moduleLabel(activity.module)}</span><span className="mt-0.5 block line-clamp-2 text-xs font-semibold leading-4 text-ink-900">{activity.title}</span><span className="mt-1 block text-[10px] text-ink-500">{done ? "Submitted" : unlocked ? "Open in Learning" : "Finish learning first"}</span></span></button>;
              })}
            </nav>
          </aside>}
          {active && structured && activeResponse && (
            <main className="min-h-0 min-w-0 overflow-y-auto">
              <header className="border-b border-ink-200 bg-gradient-to-r from-brand-50/80 to-white px-5 py-4 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-700">{moduleLabel(active.module)} · Applied practice</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-ink-950">{active.title}</h2><span className="badge-neutral">{active.max_points > 0 ? `${active.max_points} points` : "Practice"}</span></div></header>
              <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-5">
                  <section><div className="flex items-center gap-2"><Sparkles size={16} className="text-brand-700" /><h3 className="text-sm font-semibold text-ink-950">Directions</h3></div><ol className="mt-3 space-y-2.5">{structured.instructions.map((step, index) => <li key={step} className="flex gap-3 rounded-xl bg-ink-50 px-3 py-2.5 text-sm leading-5 text-ink-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700 shadow-sm">{index + 1}</span><span>{step}</span></li>)}</ol></section>
                  <WorkspaceField icon={<FileText size={16} />} title="Your work"><textarea className="input mt-3 min-h-28 resize-y" placeholder="Enter your answer, output, or a short description of what you completed..." value={activeResponse.work} onChange={(event) => updateResponse(active.id, { ...activeResponse, work: event.target.value })} /></WorkspaceField>
                  <WorkspaceField icon={<NotebookPen size={16} />} title="Notes and reflection"><textarea className="input mt-3 min-h-20 resize-y" placeholder="What worked? What did you change? What would you do next time?" value={activeResponse.notes} onChange={(event) => updateResponse(active.id, { ...activeResponse, notes: event.target.value })} /></WorkspaceField>
                  <section className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4"><div className="flex items-center gap-2 text-brand-700"><FileUp size={16} /><h3 className="text-sm font-semibold text-ink-950">Evidence</h3></div><textarea className="input mt-3 min-h-16 bg-white" placeholder="Describe the evidence you are providing..." value={activeResponse.evidenceSummary} onChange={(event) => updateResponse(active.id, { ...activeResponse, evidenceSummary: event.target.value })} /><input type="file" multiple className="input mt-3 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-800" onChange={(event) => setFiles((current) => ({ ...current, [active.id]: Array.from(event.target.files ?? []) }))} />{(files[active.id]?.length ?? 0) > 0 && <p className="mt-2 text-xs text-brand-800">{files[active.id].length} file(s) ready to upload</p>}</section>
                </div>
                <aside className="space-y-4">
                  <section className="rounded-xl border border-accent-200 bg-accent-50/60 p-4"><h3 className="text-sm font-semibold text-ink-950">Submission check</h3><p className="mt-1 text-xs leading-5 text-ink-600">Use the same checks your instructor will see when reviewing your work.</p><div className="mt-3 space-y-2">{structured.checklist.map((item, index) => <label key={item} className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 text-xs leading-5 text-ink-700"><input type="checkbox" className="sr-only" checked={activeResponse.selfCheck[index]} onChange={(event) => { const next = [...activeResponse.selfCheck]; next[index] = event.target.checked; updateResponse(active.id, { ...activeResponse, selfCheck: next }); }} />{activeResponse.selfCheck[index] ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" /> : <Circle size={16} className="mt-0.5 shrink-0 text-ink-300" />}<span>{item}</span></label>)}</div></section>
                  {active.submissions[0]?.feedback && <section className="rounded-xl border border-success-200 bg-success-50 p-4"><h3 className="text-sm font-semibold text-success-900">Instructor feedback</h3><p className="mt-2 text-xs leading-5 text-success-800">{active.submissions[0].feedback}</p>{active.submissions[0].grade !== null && <p className="mt-2 font-semibold text-success-900">Score: {active.submissions[0].grade}/{active.submissions[0].max_grade}</p>}</section>}
                  <div className="grid gap-2"><button type="button" className="btn-secondary justify-center" disabled={saving} onClick={() => void saveActivity(active, false)}><Save size={15} /> Save draft</button><button type="button" className="btn-primary justify-center" disabled={saving || !activeResponse.selfCheck.every(Boolean)} onClick={() => void saveActivity(active, true)}><Send size={15} /> {saving ? "Saving..." : active.submissions.some((submission) => submission.status === "submitted") ? "Update submission" : "Submit activity"}</button></div>
                  {activeModuleCheck && active.submissions.some((submission) => ["submitted", "graded"].includes(submission.status)) && <Link to={`/student/courses/${cohortId}/learn/check/${activeModuleCheck.id}`} className="flex items-center justify-between rounded-xl bg-accent-100 px-3 py-3 text-xs font-semibold text-accent-900 hover:bg-accent-200">Continue to module check <ArrowRight size={14} /></Link>}
                  {!activeModuleCheck && nextLearningLesson && active.submissions.some((submission) => ["submitted", "graded"].includes(submission.status)) && <Link to={`/student/courses/${cohortId}/learn/${nextLearningLesson.id}`} className="flex items-center justify-between rounded-xl bg-brand-100 px-3 py-3 text-xs font-semibold text-brand-900 hover:bg-brand-200">Continue to next module <ArrowRight size={14} /></Link>}
                  <Link to={`/student/courses/${cohortId}/learn`} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-3 text-xs font-semibold text-brand-700 hover:bg-brand-50">Return to learning path <ArrowRight size={14} /></Link>
                </aside>
              </div>
            </main>
          )}
        </div>
      )}
    </CourseLayout>
  );
}

function WorkspaceField({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-ink-200 p-4"><div className="flex items-center gap-2 text-brand-700">{icon}<h3 className="text-sm font-semibold text-ink-950">{title}</h3></div>{children}</section>;
}

function ActivityPathRail({ cohortId, modules, activities, checks, currentActivityId, completedLessonIds, completedActivityIds, passedCheckIds, releasedLessonIds }: {
  cohortId: string;
  modules: PathModule[];
  activities: ActivityRow[];
  checks: PathCheck[];
  currentActivityId: string;
  completedLessonIds: Set<string>;
  completedActivityIds: Set<string>;
  passedCheckIds: Set<string>;
  releasedLessonIds: Set<string>;
}) {
  const publishedLessons = modules.flatMap((module) => module.lessons.filter((lesson) => lesson.is_published));
  const total = publishedLessons.length + activities.length + checks.length;
  const completed = publishedLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length + completedActivityIds.size + passedCheckIds.size;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  const previousStepComplete = (module: PathModule) => {
    if (module.display_order === 0) return true;
    const previous = modules.find((item) => item.display_order === module.display_order - 1);
    if (!previous) return true;
    if (module.display_order === 1) {
      const introductionLesson = previous.lessons.find((lesson) => lesson.is_published);
      return Boolean(introductionLesson && completedLessonIds.has(introductionLesson.id));
    }
    const previousCheck = checks.find((item) => item.module_id === previous.id);
    if (previousCheck) return passedCheckIds.has(previousCheck.id);
    const previousActivity = activities.find((item) => item.module_id === previous.id);
    if (previousActivity) return completedActivityIds.has(previousActivity.id);
    const previousLesson = previous.lessons.find((lesson) => lesson.is_published);
    return Boolean(previousLesson && completedLessonIds.has(previousLesson.id));
  };

  return (
    <aside className="hidden min-h-0 flex-col border-r border-ink-200 bg-ink-50 text-ink-900 lg:flex" aria-label="Learning pathway">
      <div className="border-b border-ink-200 px-5 py-4">
        <p className="text-sm font-semibold">Course progress</p>
        <div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-200"><div className="h-full rounded-full bg-brand-600" style={{ width: `${percentage}%` }} /></div><span className="text-xs font-semibold tabular-nums text-brand-700">{percentage}%</span></div>
      </div>
      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {modules.map((module) => {
          const lesson = module.lessons.find((item) => item.is_published);
          if (!lesson) return null;
          const moduleActivity = activities.find((item) => item.module_id === module.id);
          const check = checks.find((item) => item.module_id === module.id);
          const lessonComplete = completedLessonIds.has(lesson.id);
          const activityComplete = moduleActivity ? completedActivityIds.has(moduleActivity.id) : true;
          const released = releasedLessonIds.has(lesson.id) && previousStepComplete(module);
          const current = moduleActivity?.id === currentActivityId;
          const label = module.display_order === 0 ? "Introduction" : `Module ${module.display_order}`;
          const finishedSteps = Number(lessonComplete) + Number(moduleActivity ? activityComplete : false) + Number(check ? passedCheckIds.has(check.id) : false);
          const stepCount = 1 + Number(Boolean(moduleActivity)) + Number(Boolean(check));
          return (
            <details key={module.id} name="activity-pathway" open={current || undefined} className={`group mb-1 rounded-lg ${current ? "bg-white shadow-[0_1px_3px_rgba(19,56,92,0.10)]" : "open:bg-white/70"}`}>
              <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden ${released ? "hover:bg-white/80" : "opacity-55"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${lessonComplete ? "bg-success-600 text-white" : released ? "border border-brand-100 bg-white text-brand-700" : "bg-ink-100 text-ink-400"}`}>{lessonComplete ? <CheckCircle2 size={15} /> : released ? <BookOpen size={14} /> : <LockKeyhole size={13} />}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block truncate text-[11px] text-ink-500">{module.title.replace(/^Module \d+: /, "")}</span></span><span className="text-[10px] font-semibold tabular-nums text-ink-400">{finishedSteps}/{stepCount}</span><ChevronDown size={14} className="text-ink-400 transition-transform group-open:rotate-180" /></summary>
              <div className="pb-2">
              {released ? <Link to={`/student/courses/${cohortId}/learn/${lesson.id}`} className="ml-8 flex min-h-9 items-center gap-2 rounded-md border-l-2 border-brand-200 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50"><BookOpen size={12} className="shrink-0" /><span className="min-w-0 flex-1 truncate">Learn it</span><span className="shrink-0 text-[10px] text-ink-500">{lessonComplete ? "Completed" : "In progress"}</span></Link> : <div className="ml-8 flex min-h-9 items-center gap-2 rounded-md border-l-2 border-ink-200 px-2 py-1 text-[11px] text-ink-400"><LockKeyhole size={11} className="shrink-0" /><span className="truncate">Learn it</span></div>}
              {moduleActivity && (() => {
                const available = lessonComplete;
                const item = <><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${activityComplete ? "bg-success-100 text-success-700" : available ? "bg-violet-100 text-violet-700" : "bg-ink-100 text-ink-400"}`}>{activityComplete ? <CheckCircle2 size={12} /> : available ? <ListChecks size={12} /> : <LockKeyhole size={11} />}</span><span className="min-w-0"><span className={`block truncate text-[11px] font-medium ${available ? "text-violet-900" : "text-ink-500"}`}>Do it</span><span className="mt-0.5 block truncate text-[10px] leading-4 text-ink-500">{current ? "Current activity" : activityComplete ? "Activity submitted" : available ? "Ready to practice" : "Finish learning first"}</span></span></>;
                const className = `ml-8 flex min-h-9 items-center gap-2 rounded-md border-l-2 px-2 py-1 ${current ? "border-violet-500 bg-violet-100/80" : available ? "border-violet-300 bg-violet-50/55 hover:bg-violet-100/70" : "border-ink-200 bg-ink-50/50 opacity-60"}`;
                return available ? <Link to={`/student/courses/${cohortId}/learn/activity/${moduleActivity.id}`} aria-current={current ? "page" : undefined} className={className}>{item}</Link> : <div className={className}>{item}</div>;
              })()}
              {check && (() => {
                const available = lessonComplete && activityComplete;
                const passed = passedCheckIds.has(check.id);
                const item = <><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${passed ? "bg-success-100 text-success-700" : available ? "bg-accent-100 text-accent-800" : "bg-ink-100 text-ink-400"}`}>{passed ? <CheckCircle2 size={12} /> : available ? <ClipboardCheck size={12} /> : <LockKeyhole size={11} />}</span><span className="min-w-0"><span className={`block truncate text-[11px] font-medium ${available ? "text-accent-900" : "text-ink-500"}`}>Assess it</span><span className="mt-0.5 block truncate text-[10px] leading-4 text-ink-500">{passed ? "Passed · Retake anytime" : available ? "Ready · Unlimited attempts" : lessonComplete && moduleActivity ? "Finish the activity first" : "Finish learning first"}</span></span></>;
                const className = `ml-8 flex min-h-9 items-center gap-2 rounded-md border-l-2 px-2 py-1 ${passed ? "border-success-300 bg-success-50/55" : available ? "border-accent-300 bg-accent-50/55 hover:bg-accent-100/70" : "border-ink-200 bg-ink-50/50 opacity-60"}`;
                return available ? <Link to={`/student/courses/${cohortId}/learn/check/${check.id}`} className={className}>{item}</Link> : <div className={className}>{item}</div>;
              })()}
              </div>
            </details>
          );
        })}
      </nav>
      <div className="border-t border-ink-200 px-5 py-3 text-xs leading-5 text-ink-500">Follow the available steps. Activities and checks appear only when the course includes them.</div>
    </aside>
  );
}
