import { Rubric } from '@/components/ui/Rubric';
import { useLearningPath } from '@/hooks/useLearningPath';
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, FileText, FileUp, ListChecks, LockKeyhole, NotebookPen, Save, Send, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CourseLayout } from "./CourseLayout";
import { StudyNotes } from "./StudyNotes";
import { PracticePacket } from './PracticePacket';
import { PathNavigation } from "./PathNavigation";
import { LearningFlow } from "./LearningFlow";
import { moduleLabel, parseStructuredInstructions } from "./courseFormatting";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Assignment, Lesson, Module, ProgressRecord, Submission } from "@/types";

type EvidenceFile = { id:string; file_name:string; file_path:string; file_size:number };
type ActivityRow = Assignment & { module: { title: string; display_order: number } | null; submissions: Array<Submission & { submission_files:EvidenceFile[] }> };
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
  const learningPath=useLearningPath(cohortId);
  const [isAIBusiness,setIsAIBusiness]=useState(false);
  const [enrolmentId, setEnrolmentId] = useState("");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [moduleChecks, setModuleChecks] = useState<PathCheck[]>([]);
  const [pathModules, setPathModules] = useState<PathModule[]>([]);
  const [, setReleasedLessonIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState("");
  const [responses, setResponses] = useState<Record<string, ActivityResponse>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage,setSaveMessage]=useState('');
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);

  const load = useCallback(async () => {
    if (!cohortId || !user) return;
    setLoading(true);
    const enrolmentResult = await supabase.from("enrolments").select("id,cohort:cohorts(course_id)").eq("cohort_id", cohortId).eq("student_id", user.id).eq("status", "active").single();
    if (enrolmentResult.error) { setError(enrolmentResult.error.message); setLoading(false); return; }
    setEnrolmentId(enrolmentResult.data.id);
    const courseId = (enrolmentResult.data.cohort as unknown as { course_id: string }).course_id;
    const course=await supabase.from("courses").select("slug").eq("id",courseId).single();setIsAIBusiness(course.data?.slug==="ai-business-essentials");
    const [activityResult, progressResult, checkResult, moduleResult, releaseResult] = await Promise.all([
      supabase.from("assignments").select("*,module:modules(title,display_order),submissions(*,submission_files(*))").eq("cohort_id", cohortId).eq("assignment_type", "activity").eq("is_published", true).eq("submissions.enrolment_id", enrolmentResult.data.id),
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
  const draftKey=(id:string)=>`academy-activity-draft:${user?.id}:${cohortId}:${id}`;
  const storedResponse=(activity:ActivityRow,length:number)=>{let local:string|null=null;if(!activity.submissions.some(s=>["submitted","graded"].includes(s.status))){try{local=localStorage.getItem(draftKey(activity.id));}catch{/* Account drafts remain available. */}}return readResponse(local??activity.submissions[0]?.content??null,length);};
  const activeResponse = active && structured ? responses[active.id] ?? storedResponse(active,structured.checklist.length) : null;
  const activeModuleCheck = active ? moduleChecks.find((item) => item.module_id === active.module_id) : null;
  const activeModuleOrder = active?.module?.display_order ?? -1;
  const nextLearningLesson = pathModules.find((module) => module.display_order === activeModuleOrder + 1)?.lessons.find((lesson) => lesson.is_published);
  const updateResponse = (activityId: string, next: ActivityResponse) => {setDirty(true);try{localStorage.setItem(draftKey(activityId),JSON.stringify(next));}catch{/* beforeunload still warns if device storage is unavailable. */}setSaveMessage('Unsaved account changes. Save draft to sync.');setResponses((current) => ({ ...current, [activityId]: next }));};
  const pathLocked=learningPath.loading || !learningPath.steps.find(s=>s.id===active?.id)?.available;
  const readOnly=pathLocked || (active?.submissions.some(s=>['submitted','graded'].includes(s.status)) ?? false);
  const openEvidence=async(file:EvidenceFile)=>{const result=await supabase.storage.from('assignment-submissions').createSignedUrl(file.file_path,300);if(result.error)setError(result.error.message);else window.open(result.data.signedUrl,'_blank','noopener,noreferrer');};

  const saveActivity = async (activity: ActivityRow, submit: boolean) => {
    if (!user || readOnly) return;
    if (activity.submissions.some(s=>['submitted','graded'].includes(s.status))) {setError('Your submitted work is preserved. Ask your instructor to return it if you need to make changes.');return;}
    const activityStructure = parseStructuredInstructions(activity.description);
    const response = responses[activity.id] ?? storedResponse(activity,activityStructure.checklist.length);
    if (submit && !response.selfCheck.every(Boolean)) { setError("Complete every self-check item before submitting this activity."); return; }
    if(submit&&!response.work.trim()){setError('Add your work before submitting. The checklist alone is not a submission.');return;}
    if((files[activity.id]??[]).some(f=>f.size>25*1024*1024)){setError('Each evidence file must be 25 MB or smaller.');return;}
    setSaving(true); setError("");
    const payload = { ...response, selfCheckItems: activityStructure.checklist, ...(submit ? { completedAt: new Date().toISOString() } : {}) };
    const { data: submission, error: saveError } = await supabase.from("submissions").upsert({ assignment_id: activity.id, enrolment_id: enrolmentId, student_id: user.id, content: JSON.stringify(payload), status: "draft", submitted_at: null, is_late: false, max_grade: activity.max_points }, { onConflict: "assignment_id,enrolment_id" }).select().single();
    if (saveError) { setError(saveError.message); setSaving(false); return; }
    for (const file of files[activity.id] ?? []) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${submission.id}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage.from("assignment-submissions").upload(path, file);
      if (upload.error) { setError(`${file.name} could not upload: ${upload.error.message}`); setSaving(false); return; }
      const fileResult = await supabase.from("submission_files").insert({ submission_id: submission.id, file_name: file.name, file_path: path, file_size: file.size, file_type: file.type });
      if (fileResult.error) { setError(fileResult.error.message); setSaving(false); return; }
      setFiles(current=>({...current,[activity.id]:(current[activity.id]??[]).filter(item=>item!==file)}));
    }
    if(submit){const finalized=await supabase.from('submissions').update({status:'submitted',submitted_at:new Date().toISOString()}).eq('id',submission.id).eq('status','draft');if(finalized.error){setError(finalized.error.message);setSaving(false);return;}}
    setFiles((current) => ({ ...current, [activity.id]: [] }));
    localStorage.removeItem(draftKey(activity.id));setDirty(false);setSaveMessage(submit?'Activity submitted. Your evidence and work have been saved.':'Draft saved to your account.');
    await load(); await learningPath.refresh(); setSaving(false);
  };

  return (
    <CourseLayout>
      <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex justify-end"><StudyNotes cohortId={cohortId ?? ""} lessonId={active?.lesson_id ?? ""} screen={100000}/></div>
      {!embedded && <PageHeader title="Activity workspace" subtitle="Apply what you learned, record your thinking, and submit clear evidence of your work." />}
      <div className={embedded ? "mb-4" : "mt-5"}><LearningFlow active="do" hasActivity hasAssessment={Boolean(activeModuleCheck)} /></div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {loading ? <div className="rounded-xl bg-white shadow-soft"><TableSkeleton /></div> : activities.length === 0 ? <div className="rounded-xl bg-white shadow-soft"><EmptyState icon={<ListChecks size={30} />} title="No activities yet" description="This course does not currently include activities. Continue with the available learning steps." /></div> : (
        <div className={`${embedded ? "learning-player lg:grid-cols-[15rem_minmax(0,1fr)]" : "mt-5 min-h-[34rem] lg:grid-cols-[18rem_minmax(0,1fr)]"} grid overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated`}>
          {embedded ? <PathNavigation cohortId={cohortId ?? ""} /> : <aside className="border-b border-ink-200 bg-ink-50/80 lg:border-b-0 lg:border-r">
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
              <header className="border-b border-ink-200 bg-gradient-to-r from-brand-50/80 to-white px-5 py-4 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-700">{moduleLabel(active.module)} · Applied practice</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-ink-950">{active.title}</h2><span className="badge-neutral">{active.max_points > 0 ? `${active.max_points} feedback points` : "Practice"}</span></div></header>
              <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-5">
                  {isAIBusiness && <PracticePacket order={active.module?.display_order ?? 0}/>}
                  <section><div className="flex items-center gap-2"><Sparkles size={16} className="text-brand-700" /><h3 className="text-sm font-semibold text-ink-950">Directions</h3></div><ol className="mt-3 space-y-2.5">{structured.instructions.map((step, index) => <li key={step} className="flex gap-3 rounded-xl bg-ink-50 px-3 py-2.5 text-sm leading-5 text-ink-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700 shadow-sm">{index + 1}</span><span>{step}</span></li>)}</ol></section>
                  <WorkspaceField icon={<FileText size={16} />} title="Your work"><textarea disabled={readOnly || saving} aria-label="Your work" className="input mt-3 min-h-28 resize-y" placeholder="Enter your answer, output, or a short description of what you completed..." value={activeResponse.work} onChange={(event) => updateResponse(active.id, { ...activeResponse, work: event.target.value })} /></WorkspaceField>
                  <WorkspaceField icon={<NotebookPen size={16} />} title="Notes and reflection"><textarea disabled={readOnly || saving} aria-label="Notes and reflection" className="input mt-3 min-h-20 resize-y" placeholder="What worked? What did you change? What would you do next time?" value={activeResponse.notes} onChange={(event) => updateResponse(active.id, { ...activeResponse, notes: event.target.value })} /></WorkspaceField>
                  <section className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4"><div className="flex items-center gap-2 text-brand-700"><FileUp size={16} /><h3 className="text-sm font-semibold text-ink-950">Evidence</h3></div><textarea disabled={readOnly || saving} aria-label="Evidence description" className="input mt-3 min-h-16 bg-white" placeholder="Describe the evidence you are providing..." value={activeResponse.evidenceSummary} onChange={(event) => updateResponse(active.id, { ...activeResponse, evidenceSummary: event.target.value })} /><input disabled={readOnly || saving} aria-label="Upload activity evidence" type="file" multiple className="input mt-3 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-800" onChange={(event) => {setDirty(true);setFiles((current) => ({ ...current, [active.id]: Array.from(event.target.files ?? []) }));}} />{(files[active.id]?.length ?? 0) > 0 && <p className="mt-2 text-xs text-brand-800">{files[active.id].length} file(s) ready to upload</p>}</section>
                </div>
                <aside className="space-y-4">
                  <Rubric rubric={active.rubric} values={active.submissions[0]?.rubric_scores}/>
                  <p role="status" className="text-xs leading-5 text-ink-600">{pathLocked ? "Finish the required earlier learning steps to edit this activity." : readOnly ? "Submitted work is preserved. Your instructor can return it for changes." : saveMessage || "Save a draft as you work. Your instructor sees only submitted work."}</p>
                  {(active.submissions[0]?.submission_files??[]).map(file=><button key={file.id} type="button" className="btn-secondary w-full truncate" onClick={()=>void openEvidence(file)}>{file.file_name} · {Math.ceil(file.file_size/1024)} KB</button>)}
                  <section className="rounded-xl border border-accent-200 bg-accent-50/60 p-4"><h3 className="text-sm font-semibold text-ink-950">Submission check</h3><p className="mt-1 text-xs leading-5 text-ink-600">Use the same checks your instructor will see when reviewing your work.</p><div className="mt-3 space-y-2">{structured.checklist.map((item, index) => <label key={item} className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 text-xs leading-5 text-ink-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600 has-[:focus-visible]:ring-offset-2"><input disabled={readOnly || saving} type="checkbox" className="sr-only" checked={activeResponse.selfCheck[index]} onChange={(event) => { const next = [...activeResponse.selfCheck]; next[index] = event.target.checked; updateResponse(active.id, { ...activeResponse, selfCheck: next }); }} />{activeResponse.selfCheck[index] ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" /> : <Circle size={16} className="mt-0.5 shrink-0 text-ink-300" />}<span>{item}</span></label>)}</div></section>
                  {active.submissions[0]?.feedback && <section className="rounded-xl border border-success-200 bg-success-50 p-4"><h3 className="text-sm font-semibold text-success-900">Instructor feedback</h3><p className="mt-2 text-xs leading-5 text-success-800">{active.submissions[0].feedback}</p>{active.submissions[0].grade !== null && <p className="mt-2 font-semibold text-success-900">Score: {active.submissions[0].grade}/{active.submissions[0].max_grade}</p>}</section>}
                  <div className="grid gap-2"><button type="button" className="btn-secondary justify-center" disabled={saving || readOnly} onClick={() => void saveActivity(active, false)}><Save size={15} /> Save draft</button><button type="button" className="btn-primary justify-center" disabled={saving || readOnly || !activeResponse.work.trim() || !activeResponse.selfCheck.every(Boolean)} onClick={() => void saveActivity(active, true)}><Send size={15} /> {saving ? "Saving..." : active.submissions.some((submission) => submission.status === "submitted") ? "Update submission" : "Submit activity"}</button></div>
                  {activeModuleCheck && active.submissions.some((submission) => ["submitted", "graded"].includes(submission.status)) && <Link to={`/student/courses/${cohortId}/learn/check/${activeModuleCheck.id}`} className="flex items-center justify-between rounded-xl bg-accent-100 px-3 py-3 text-xs font-semibold text-accent-900 hover:bg-accent-200">Continue to module check <ArrowRight size={14} /></Link>}
                  {!activeModuleCheck && nextLearningLesson && active.submissions.some((submission) => ["submitted", "graded"].includes(submission.status)) && <Link to={`/student/courses/${cohortId}/learn/${nextLearningLesson.id}`} className="flex items-center justify-between rounded-xl bg-brand-100 px-3 py-3 text-xs font-semibold text-brand-900 hover:bg-brand-200">Continue to next module <ArrowRight size={14} /></Link>}
                  <Link to={`/student/courses/${cohortId}/learn`} className="flex items-center justify-between rounded-xl border border-ink-200 px-3 py-3 text-xs font-semibold text-brand-700 hover:bg-brand-50">Return to learning path <ArrowRight size={14} /></Link>
                </aside>
              </div>
            </main>
          )}
        </div>
      )}
    </div>
    </CourseLayout>
  );
}

function WorkspaceField({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-ink-200 p-4"><div className="flex items-center gap-2 text-brand-700">{icon}<h3 className="text-sm font-semibold text-ink-950">{title}</h3></div>{children}</section>;
}
