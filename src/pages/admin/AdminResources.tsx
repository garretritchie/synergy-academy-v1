/* The course resource loader is reused after mutations. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, ExternalLink, FolderOpen, LockKeyhole, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRoleView } from "@/context/RoleViewContext";
import type { Course, Lesson, Module, Resource } from "@/types";

type ModuleWithLessons = Module & { lessons: Lesson[] };
type CohortOption = { id: string; name: string };
type CheckpointOption = { id: string; title: string; cohort_id: string; kind: "assessment" | "activity" };

export function AdminResources() {
  const { user } = useAuth();
  const { activeRole } = useRoleView();
  const isInstructorWorkspace = activeRole === "instructor";
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(
    () => searchParams.get("course") ?? "",
  );
  const [rows, setRows] = useState<Resource[]>([]);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId,setEditingId]=useState("");
  const [resourceStep, setResourceStep] = useState(0);
  const [audience, setAudience] = useState<'' | 'cohort' | 'program'>('');
  const [form, setForm] = useState({
    title: "",
    description: "",
    resource_type: "file",
    url: "",
    is_downloadable: false,
    module_id: "",
    lesson_id: "",
    cohort_id: "",
    release_mode: "immediate" as "immediate" | "scheduled" | "checkpoint",
    release_at: "",
    release_checkpoint_type: "lesson" as "lesson" | "assessment" | "activity",
    release_checkpoint_id: "",
    checkpoint_requires_pass: true,
    show_before_release: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loadGeneration = useRef(0);
  useEffect(() => {
    let current = true;
    void (async () => {
      const { data, error: courseError } = isInstructorWorkspace && user
        ? await supabase.from("cohort_instructors").select("cohort:cohorts(course:courses(*))").eq("instructor_id", user.id)
        : await supabase.from("courses").select("*").order("title");
      if (!current) return;
      if (courseError) { setError(courseError.message); setLoading(false); return; }
      const list = isInstructorWorkspace
        ? Array.from(new Map(((data ?? []) as unknown as Array<{ cohort: { course: Course } }>).map((item) => [item.cohort.course.id, item.cohort.course])).values()).sort((a, b) => a.title.localeCompare(b.title))
        : (data ?? []) as Course[];
      setCourses(list);
      setCourseId((current) => list.some(course => course.id === current) ? current : list[0]?.id || "");
    })();
    return () => { current = false; };
  }, [isInstructorWorkspace, user]);
  const load = async () => {
    const generation = ++loadGeneration.current;
    setRows([]); setModules([]); setCohorts([]); setCheckpoints([]);
    if (!courseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [resourceResult, moduleResult, cohortResult] = await Promise.all([
      supabase
        .from("resources")
        .select("*")
        .eq("course_id", courseId)
        .order("display_order"),
      supabase
        .from("modules")
        .select("*,lessons(*)")
        .eq("course_id", courseId)
        .order("display_order"),
      isInstructorWorkspace && user
        ? supabase.from("cohorts").select("id,name,cohort_instructors!inner(instructor_id)").eq("course_id", courseId).eq("cohort_instructors.instructor_id", user.id).order("start_date", { ascending: false })
        : supabase.from("cohorts").select("id,name").eq("course_id", courseId).order("start_date", { ascending: false }),
    ]);
    const cohortIds = (cohortResult.data ?? []).map((item) => item.id);
    const [assessmentResult, activityResult] = cohortIds.length
      ? await Promise.all([
          supabase.from("assessments").select("id,title,cohort_id").in("cohort_id", cohortIds).eq("is_published", true).order("title"),
          supabase.from("assignments").select("id,title,cohort_id").in("cohort_id", cohortIds).eq("assignment_type", "activity").eq("is_published", true).order("title"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const queryError = resourceResult.error || moduleResult.error || cohortResult.error || assessmentResult.error || activityResult.error;
    if (generation !== loadGeneration.current) return;
    if (queryError) setError(queryError.message);
    else {
      setRows(((resourceResult.data ?? []) as Resource[]).filter(row => !isInstructorWorkspace || !row.cohort_id || cohortIds.includes(row.cohort_id)));
      setModules((moduleResult.data ?? []) as unknown as ModuleWithLessons[]);
      setCohorts((cohortResult.data ?? []) as CohortOption[]);
      setCheckpoints([
        ...(assessmentResult.data ?? []).map((item) => ({ ...item, kind: "assessment" as const })),
        ...(activityResult.data ?? []).map((item) => ({ ...item, kind: "activity" as const })),
      ]);
    }
    setLoading(false);
  };
  useEffect(() => {
    void load();
    return () => { loadGeneration.current++; };
  }, [courseId, isInstructorWorkspace, user?.id]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    if (!audience || (audience === 'cohort' && !cohorts.some(cohort => cohort.id === form.cohort_id))) {
      setError('Choose who can use this resource. For a cohort-only resource, select a cohort you teach.');
      setSaving(false); return;
    }
    if (!form.title.trim() || !courses.some(course => course.id === courseId)) {
      setError('Choose a program and enter a resource title.'); setSaving(false); return;
    }
    if (audience === 'program' && form.release_mode === 'checkpoint' && form.release_checkpoint_type !== 'lesson') {
      setError('Program resources can use a shared learning checkpoint. For an activity or assessment checkpoint, choose This cohort only.');
      setSaving(false); return;
    }
    if (form.resource_type === 'link' && !/^https?:\/\//i.test(form.url.trim())) {
      setError('Use a full web link starting with https:// or http://.'); setSaving(false); return;
    }
    if (!file && !form.url) {
      setError("Choose a private file or enter an external URL.");
      setSaving(false);
      return;
    }
    if (form.release_mode === "scheduled" && !form.release_at) {
      setError("Choose the date and time when this resource should open.");
      setSaving(false);
      return;
    }
    if (form.release_mode === "checkpoint" && !form.release_checkpoint_id) {
      setError("Choose the completion checkpoint that releases this resource.");
      setSaving(false);
      return;
    }
    if (file && file.size > 250 * 1024 * 1024) {
      setError("Course resources must be 250 MB or smaller.");
      setSaving(false);
      return;
    }
    const resourceId = editingId || crypto.randomUUID();
    let resourceUrl = form.url.trim();
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${courseId}/${resourceId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("course-assets")
        .upload(path, file);
      if (uploadError) {
        setError(
          `${uploadError.message}. Apply migration 012 before uploading private resources.`,
        );
        setSaving(false);
        return;
      }
      resourceUrl = `storage:${path}`;
    }
    const { error: insertError } = await supabase
      .from("resources")
      .upsert({
        id: resourceId,
        title: form.title,
        description: form.description,
        resource_type: file ? "file" : form.resource_type,
        url: resourceUrl,
        file_size: file?.size ?? rows.find(r=>r.id===editingId)?.file_size ?? null,
        is_downloadable: file ? true : form.is_downloadable,
        course_id: courseId,
        module_id: form.module_id || null,
        lesson_id: form.lesson_id || null,
        cohort_id: audience === 'cohort' ? form.cohort_id : null,
        release_mode: form.release_mode,
        release_at: form.release_mode === "scheduled" ? new Date(form.release_at).toISOString() : null,
        release_checkpoint_type: form.release_mode === "checkpoint" ? form.release_checkpoint_type : null,
        release_checkpoint_id: form.release_mode === "checkpoint" ? form.release_checkpoint_id : null,
        checkpoint_requires_pass: form.checkpoint_requires_pass,
        show_before_release: form.show_before_release,
        display_order: rows.find(r=>r.id===editingId)?.display_order ?? rows.length + 1,
      });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
      setEditingId("");
      setAudience('');
      setForm({
        title: "",
        description: "",
        resource_type: "file",
        url: "",
        is_downloadable: false,
        module_id: "",
        lesson_id: "",
        cohort_id: "",
        release_mode: "immediate",
        release_at: "",
        release_checkpoint_type: "lesson",
        release_checkpoint_id: "",
        checkpoint_requires_pass: true,
        show_before_release: true,
      });
      setFile(null);
      setResourceStep(0);
      await load();
    }
    setSaving(false);
  };
  const editResource=(row:Resource)=>{setEditingId(row.id);setAudience(row.cohort_id ? 'cohort' : 'program');setForm({title:row.title,description:row.description??"",resource_type:row.resource_type,url:row.url??"",is_downloadable:row.is_downloadable,module_id:row.module_id??"",lesson_id:row.lesson_id??"",cohort_id:row.cohort_id??"",release_mode:row.release_mode??"immediate",release_at:row.release_at?new Date(new Date(row.release_at).getTime()-new Date(row.release_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"",release_checkpoint_type:row.release_checkpoint_type??"lesson",release_checkpoint_id:row.release_checkpoint_id??"",checkpoint_requires_pass:row.checkpoint_requires_pass??true,show_before_release:row.show_before_release??true});setFile(null);setResourceStep(0);setOpen(true);};
  const remove = async (id: string) => {
    if(!window.confirm("Remove this resource and its file? This may not be recoverable."))return;
    const row = rows.find((item) => item.id === id);
    if (row?.url?.startsWith("storage:"))
      await supabase.storage.from("course-assets").remove([row.url.slice(8)]);
    const { error: deleteError } = await supabase
      .from("resources")
      .delete()
      .eq("id", id);
    if (deleteError) setError(deleteError.message);
    else await load();
  };
  return (
    <AppLayout>
      <PageHeader
        title={isInstructorWorkspace ? "Teaching resources" : "Course resources"}
        subtitle="Share helpful files and links with one cohort or every current and future cohort in a program. Choose when each resource becomes available."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        <section className="rounded-xl bg-white p-5 shadow-soft">
          <Field label="Program / course">
            <select
              className="input max-w-2xl"
              value={courseId}
              disabled={saving}
              onChange={(event) => {
                const nextCourseId = event.target.value;
                setCourseId(nextCourseId);
                setOpen(false); setEditingId(''); setAudience(''); setFile(null); setError('');
                setSearchParams(nextCourseId ? { course: nextCourseId } : {});
              }}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </Field>
        </section>
        <FormPanel
          title={editingId ? "Edit resource" : "Add resource"}
          description="Upload slides, guides, templates, or class files—or add a helpful web link."
          open={open}
          onToggle={() => {if(saving)return;if(!open){setEditingId("");setAudience('');setForm({title:"",description:"",resource_type:"file",url:"",is_downloadable:false,module_id:"",lesson_id:"",cohort_id:"",release_mode:"immediate",release_at:"",release_checkpoint_type:"lesson",release_checkpoint_id:"",checkpoint_requires_pass:true,show_before_release:true});setFile(null);setResourceStep(0);}setOpen(!open);}}
          actionLabel="New resource"
        >
          <form onSubmit={save}>
            <fieldset disabled={saving || loading}>
            <CreationWizard
              steps={["Describe", "Audience", "Release", "File or link"]}
              currentStep={resourceStep}
              canContinue={
                resourceStep === 0
                  ? Boolean(form.title.trim())
                  : resourceStep === 1
                    ? audience === 'program' || (audience === 'cohort' && cohorts.some(cohort => cohort.id === form.cohort_id))
                  : resourceStep === 2
                    ? form.release_mode === "scheduled"
                      ? Boolean(form.release_at)
                      : form.release_mode === "checkpoint"
                        ? Boolean(form.release_checkpoint_id)
                        : true
                    : resourceStep === 3
                    ? form.resource_type === "link"
                      ? Boolean(form.url)
                      : Boolean(file || (editingId && form.url))
                    : true
              }
              saving={saving}
              finalAction={editingId ? "Save resource" : "Publish resource"}
              onBack={() => setResourceStep((step) => Math.max(0, step - 1))}
              onNext={() => setResourceStep((step) => Math.min(3, step + 1))}
            >
            {resourceStep === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <input
                    required
                    className="input"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Format">
                  <select
                    className="input"
                    value={form.resource_type}
                    onChange={(event) => {
                      setFile(null);
                      setForm((current) => ({ ...current, resource_type: event.target.value, url: "" }));
                    }}
                  >
                    <option value="file">Uploaded file</option>
                    <option value="template">Template</option>
                    <option value="reading">Reading</option>
                    <option value="link">External web link</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <textarea
                      className="input min-h-20"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </Field>
                </div>
              </div>
            ) : resourceStep === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="mb-3 text-sm font-semibold text-ink-900">Who can use this resource?</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['cohort', 'This cohort only', 'Only students enrolled in the selected cohort. It will not carry over to other cohorts.'],
                    ['program', 'All program participants', 'All current and future cohorts of this program. Upload once; no need to add it again.'],
                  ] as const).map(([value, title, help]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 ${audience === value ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-white hover:border-brand-300'}`}>
                    <input className="mt-1" type="radio" name="resource-audience" value={value} checked={audience === value} onChange={() => { setAudience(value); setForm(current => ({ ...current, cohort_id: '', release_checkpoint_type: 'lesson', release_checkpoint_id: '' })); }} />
                    <span><span className="block text-sm font-semibold text-ink-900">{title}</span><span className="mt-1 block text-xs leading-5 text-ink-600">{help}</span></span>
                  </label>)}
                </div>
                <p className="mt-2 text-xs text-ink-600">Resources are available to enrolled participants, not the public course catalog.</p>
              </fieldset>
              {audience === 'cohort' && <div className="sm:col-span-2"><Field label="Select cohort" hint={isInstructorWorkspace ? 'Only cohorts assigned to you are listed.' : 'Choose the cohort that should receive this resource.'}>
                <select className="input" value={form.cohort_id} onChange={event => setForm(current => ({ ...current, cohort_id: event.target.value, release_checkpoint_id: '' }))}>
                  <option value="">Choose a cohort</option>
                  {cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
                </select>
              </Field>{!cohorts.length && <p className="mt-2 text-xs text-ink-600">No cohorts are available for this program. Choose another program or add a cohort first.</p>}</div>}
              <Field label="Module" hint="Optional placement within the selected audience">
                <select
                  className="input"
                  value={form.module_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      module_id: event.target.value,
                      lesson_id: "",
                    }))
                  }
                >
                  <option value="">General resource — no module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lesson" hint="Lesson resources follow that cohort's release rules">
                <select
                  className="input"
                  value={form.lesson_id}
                  disabled={!form.module_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lesson_id: event.target.value,
                    }))
                  }
                >
                  <option value="">All lessons in module</option>
                  {modules
                    .find((module) => module.id === form.module_id)
                    ?.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            ) : resourceStep === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ["immediate", "Release now", "Students can open it right away."],
                    ["scheduled", "Schedule", "Open it at a date and time."],
                    ["checkpoint", "After progress", "Open it after required work."],
                  ] as const).map(([value, label, help]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, release_mode: value, release_checkpoint_id: "", release_at: "" }))}
                      className={`rounded-xl border p-4 text-left transition-colors ${form.release_mode === value ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-ink-200 bg-white hover:border-brand-200"}`}
                    >
                      <span className="block text-sm font-semibold text-ink-900">{label}</span>
                      <span className="mt-1 block text-xs leading-5 text-ink-500">{help}</span>
                    </button>
                  ))}
                </div>
                <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">Audience: {audience === 'program' ? 'All current and future program participants' : cohorts.find(cohort => cohort.id === form.cohort_id)?.name || 'Choose a cohort in the Audience step'}</p>
                {form.release_mode === "scheduled" && (
                  <Field label="Release date and time">
                    <input type="datetime-local" className="input" value={form.release_at} onChange={(event) => setForm((current) => ({ ...current, release_at: event.target.value }))} />
                  </Field>
                )}
                {form.release_mode === "checkpoint" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Checkpoint type">
                      <select className="input" value={form.release_checkpoint_type} onChange={(event) => setForm((current) => ({ ...current, release_checkpoint_type: event.target.value as "lesson" | "assessment" | "activity", release_checkpoint_id: "" }))}>
                        <option value="lesson">Learning completion</option>
                        <option value="activity" disabled={audience === 'program'}>Activity completion — cohort only</option>
                        <option value="assessment" disabled={audience === 'program'}>Assessment completion — cohort only</option>
                      </select>
                    </Field>
                    <Field label="Required checkpoint">
                      <select className="input" value={form.release_checkpoint_id} onChange={(event) => setForm((current) => ({ ...current, release_checkpoint_id: event.target.value }))}>
                        <option value="">Select checkpoint</option>
                        {form.release_checkpoint_type === "lesson"
                          ? modules.flatMap((module) => module.lessons).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)
                          : checkpoints.filter((item) => item.kind === form.release_checkpoint_type && (!form.cohort_id || item.cohort_id === form.cohort_id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                {form.release_mode === "checkpoint" && form.release_checkpoint_type === "assessment" && (
                  <label className="flex items-center gap-2 text-xs text-ink-700"><input type="checkbox" checked={form.checkpoint_requires_pass} onChange={(event) => setForm((current) => ({ ...current, checkpoint_requires_pass: event.target.checked }))} /> Require a passing score, not only a completed attempt</label>
                )}
                {form.release_mode === 'checkpoint' && audience === 'program' && <p className="text-xs leading-5 text-ink-600">A shared learning checkpoint works for future cohorts. Activities and assessments belong to a specific cohort; choose a cohort-only audience to use those checkpoints.</p>}
                {form.release_mode !== "immediate" && (
                  <label className="flex items-center gap-2 text-xs text-ink-700"><input type="checkbox" checked={form.show_before_release} onChange={(event) => setForm((current) => ({ ...current, show_before_release: event.target.checked }))} /> Show a locked preview so students know this resource is coming</label>
                )}
              </div>
            ) : (
              <div className="space-y-4">
              {form.resource_type === "link" ? (
              <Field label="External URL">
                <input
                  type="url"
                  required
                  className="input"
                  value={form.url}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                />
              </Field>
              ) : (
              <Field label="Private file" hint="Stored in the private course-assets bucket. Maximum 250 MB.">
                <input
                  type="file"
                  required={!editingId || !form.url}
                  className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              )}
              <div className="rounded-lg bg-ink-50 p-4 text-xs leading-5 text-ink-600">
                <p className="font-semibold text-ink-900">{form.title}</p>
                <p className="mt-1 font-medium text-brand-800">{audience === 'program' ? 'Shared program resource · includes all future cohorts' : `Cohort only · ${cohorts.find(cohort => cohort.id === form.cohort_id)?.name ?? ''}`}</p>
                <p className="mt-1">{form.release_mode === "immediate" ? "Available immediately" : form.release_mode === "scheduled" ? `Scheduled for ${form.release_at || "a selected time"}` : "Released after the selected checkpoint"}</p>
              </div>
            <label className="flex gap-2 text-xs text-ink-700">
              <input
                type="checkbox"
                checked={form.is_downloadable}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_downloadable: event.target.checked,
                  }))
                }
              />{" "}
              Offer as a download
            </label>
              </div>
            )}
            </CreationWizard>
            </fieldset>
          </form>
        </FormPanel>
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              <FolderOpen className="mx-auto mb-2 text-ink-300" />
              No resources have been published.
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <FolderOpen size={18} className="text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-ink-900">{row.title}</h2>
                    <p className={`mt-1 text-xs font-medium ${row.cohort_id ? 'text-brand-700' : 'text-success-700'}`}>{row.cohort_id ? `Cohort only · ${cohorts.find(cohort => cohort.id === row.cohort_id)?.name ?? 'Selected cohort'}` : 'Program library · all current and future cohorts'}</p>
                    <p className="text-xs text-ink-500">
                      {row.description || row.resource_type}
                    </p>
                  </div>
                  <span className={`badge-neutral inline-flex items-center gap-1 ${row.release_mode === "immediate" ? "" : "!bg-accent-50 !text-accent-800"}`}>
                    {row.release_mode === "immediate" ? <FolderOpen size={12} /> : row.release_mode === "scheduled" ? <Clock3 size={12} /> : <LockKeyhole size={12} />}
                    {row.release_mode === "scheduled" ? "Scheduled" : row.release_mode === "checkpoint" ? "Checkpoint" : "Available now"}
                  </span>
                  {row.url && !row.url.startsWith("storage:") && (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost !p-2"
                      aria-label={`Open ${row.title}`}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button type="button" className="btn-secondary" onClick={()=>editResource(row)}>Edit release / details</button>
                  <button
                    className="btn-ghost !p-2 text-danger-600"
                    onClick={() => void remove(row.id)}
                    aria-label={`Delete ${row.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
