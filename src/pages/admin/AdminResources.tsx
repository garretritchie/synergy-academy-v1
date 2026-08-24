/* The course resource loader is reused after mutations. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import type { Course, Lesson, Module, Resource } from "@/types";

type ModuleWithLessons = Module & { lessons: Lesson[] };

export function AdminResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(
    () => searchParams.get("course") ?? "",
  );
  const [rows, setRows] = useState<Resource[]>([]);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
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
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .order("title");
      const list = (data ?? []) as Course[];
      setCourses(list);
      setCourseId((current) => current || list[0]?.id || "");
    })();
  }, []);
  const load = async () => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [resourceResult, moduleResult] = await Promise.all([
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
    ]);
    const queryError = resourceResult.error || moduleResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((resourceResult.data ?? []) as Resource[]);
      setModules((moduleResult.data ?? []) as unknown as ModuleWithLessons[]);
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
        ...form,
        resource_type: file ? "file" : form.resource_type,
        url: resourceUrl,
        file_size: file?.size ?? null,
        is_downloadable: file ? true : form.is_downloadable,
        course_id: courseId,
        module_id: form.module_id || null,
        lesson_id: form.lesson_id || null,
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
        title="Course resources"
        subtitle="Publish links, references, and downloadable materials to a course."
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
              steps={["Describe resource", "Choose placement", "Add file"]}
              currentStep={resourceStep}
              canContinue={
                resourceStep === 0
                  ? Boolean(form.title.trim())
                  : resourceStep === 2
                    ? form.resource_type === "link"
                      ? Boolean(form.url)
                      : Boolean(file)
                    : true
              }
              saving={saving}
              finalAction="Publish resource"
              onBack={() => setResourceStep((step) => Math.max(0, step - 1))}
              onNext={() => setResourceStep((step) => Math.min(2, step + 1))}
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
                <p className="mt-1">{form.lesson_id ? "Released with the selected lesson" : form.module_id ? "Available with the selected module" : "Available course-wide"}</p>
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
