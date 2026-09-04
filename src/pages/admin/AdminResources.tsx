/* The course resource loader is reused after mutations. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, ExternalLink, FolderOpen, LockKeyhole, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Course, Lesson, Module, Resource } from "@/types";

type ModuleWithLessons = Module & { lessons: Lesson[] };
type CohortOption = { id: string; name: string };
type CheckpointOption = { id: string; title: string; cohort_id: string; kind: "assessment" | "activity" };

export function AdminResources() {
  const { user, roles } = useAuth();
  const isInstructorWorkspace = roles.includes("instructor") && !roles.includes("administrator");
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
  const [resourceStep, setResourceStep] = useState(0);
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
  useEffect(() => {
    void (async () => {
      const { data } = isInstructorWorkspace && user
        ? await supabase.from("cohort_instructors").select("cohort:cohorts(course:courses(*))").eq("instructor_id", user.id)
        : await supabase.from("courses").select("*").order("title");
      const list = isInstructorWorkspace
        ? Array.from(new Map(((data ?? []) as unknown as Array<{ cohort: { course: Course } }>).map((item) => [item.cohort.course.id, item.cohort.course])).values()).sort((a, b) => a.title.localeCompare(b.title))
        : (data ?? []) as Course[];
      setCourses(list);
      setCourseId((current) => current || list[0]?.id || "");
    })();
  }, [isInstructorWorkspace, user]);
  const load = async () => {
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
      supabase.from("cohorts").select("id,name").eq("course_id", courseId).order("start_date", { ascending: false }),
    ]);
    const cohortIds = (cohortResult.data ?? []).map((item) => item.id);
    const [assessmentResult, activityResult] = cohortIds.length
      ? await Promise.all([
          supabase.from("assessments").select("id,title,cohort_id").in("cohort_id", cohortIds).eq("is_published", true).order("title"),
          supabase.from("assignments").select("id,title,cohort_id").in("cohort_id", cohortIds).eq("assignment_type", "activity").eq("is_published", true).order("title"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const queryError = resourceResult.error || moduleResult.error || cohortResult.error || assessmentResult.error || activityResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((resourceResult.data ?? []) as Resource[]);
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
  }, [courseId]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
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
    const resourceId = crypto.randomUUID();
    let resourceUrl = form.url;
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
      .insert({
        id: resourceId,
        title: form.title,
        description: form.description,
        resource_type: file ? "file" : form.resource_type,
        url: resourceUrl,
        file_size: file?.size ?? null,
        is_downloadable: file ? true : form.is_downloadable,
        course_id: courseId,
        module_id: form.module_id || null,
        lesson_id: form.lesson_id || null,
        cohort_id: form.cohort_id || null,
        release_mode: form.release_mode,
        release_at: form.release_mode === "scheduled" ? new Date(form.release_at).toISOString() : null,
        release_checkpoint_type: form.release_mode === "checkpoint" ? form.release_checkpoint_type : null,
        release_checkpoint_id: form.release_mode === "checkpoint" ? form.release_checkpoint_id : null,
        checkpoint_requires_pass: form.checkpoint_requires_pass,
        show_before_release: form.show_before_release,
        display_order: rows.length + 1,
      });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
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
  const remove = async (id: string) => {
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
        subtitle="Stage slides, class files, links, and downloads, then control exactly when students receive them."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        <section className="rounded-xl bg-white p-5 shadow-soft">
          <Field label="Course">
            <select
              className="input max-w-2xl"
              value={courseId}
              onChange={(event) => {
                const nextCourseId = event.target.value;
                setCourseId(nextCourseId);
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
          title="Add resource"
          description="Upload a private course file or publish a trusted external URL."
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel="New resource"
        >
          <form onSubmit={save}>
            <CreationWizard
              steps={["Describe", "Placement", "Release", "File"]}
              currentStep={resourceStep}
              canContinue={
                resourceStep === 0
                  ? Boolean(form.title.trim())
                  : resourceStep === 2
                    ? form.release_mode === "scheduled"
                      ? Boolean(form.release_at)
                      : form.release_mode === "checkpoint"
                        ? Boolean(form.release_checkpoint_id)
                        : true
                    : resourceStep === 3
                    ? form.resource_type === "link"
                      ? Boolean(form.url)
                      : Boolean(file)
                    : true
              }
              saving={saving}
              finalAction="Publish resource"
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
              <Field label="Module" hint="Optional - leave blank for a course-wide resource">
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
                  <option value="">Course-wide</option>
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
                <Field label="Cohort" hint="Optional for immediate or scheduled course-wide resources; required for assessment and activity checkpoints.">
                  <select className="input" value={form.cohort_id} onChange={(event) => setForm((current) => ({ ...current, cohort_id: event.target.value, release_checkpoint_id: "" }))}>
                    <option value="">Every cohort in this course</option>
                    {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
                  </select>
                </Field>
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
                        <option value="activity">Activity completion</option>
                        <option value="assessment">Assessment completion</option>
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
                  required
                  className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Field>
              )}
              <div className="rounded-lg bg-ink-50 p-4 text-xs leading-5 text-ink-600">
                <p className="font-semibold text-ink-900">{form.title}</p>
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
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <FolderOpen size={18} className="text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-ink-900">{row.title}</h2>
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
