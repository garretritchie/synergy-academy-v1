import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { getErrorMessage, slugify } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import type { Course, CourseCategory } from "@/types";

type CourseRow = Course & {
  course_categories_join?: Array<{ category: CourseCategory }>;
};
type CompletionSettings = {
  require_all_lessons: boolean;
  require_assignments: boolean;
  require_assessments: boolean;
  min_grade: number | null;
  min_attendance: number | null;
};
const defaultCompletion: CompletionSettings = {
  require_all_lessons: true,
  require_assignments: true,
  require_assessments: true,
  min_grade: null,
  min_attendance: null,
};

type CourseForm = Pick<
  Course,
  | "title"
  | "slug"
  | "short_description"
  | "description"
  | "cover_image_url"
  | "introduction_video_url"
  | "duration_weeks"
  | "difficulty_level"
  | "language"
  | "is_published"
  | "is_self_paced"
>;
const emptyForm: CourseForm = {
  title: "",
  slug: "",
  short_description: "",
  description: "",
  cover_image_url: null,
  introduction_video_url: null,
  duration_weeks: 6,
  difficulty_level: "beginner",
  language: "en",
  is_published: false,
  is_self_paced: false,
};

export function AdminCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [completion, setCompletion] =
    useState<CompletionSettings>(defaultCompletion);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [courseResult, categoryResult] = await Promise.all([
      supabase
        .from("courses")
        .select("*, course_categories_join(category:course_categories(*))")
        .order("created_at", { ascending: false }),
      supabase
        .from("course_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),
    ]);
    if (courseResult.error) setError(courseResult.error.message);
    else setCourses((courseResult.data ?? []) as CourseRow[]);
    if (categoryResult.error) setError(categoryResult.error.message);
    else setCategories((categoryResult.data ?? []) as CourseCategory[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const setValue = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const startEdit = (course: CourseRow) => {
    setEditingId(course.id);
    setForm({
      title: course.title,
      slug: course.slug,
      short_description: course.short_description,
      description: course.description,
      cover_image_url: course.cover_image_url,
      introduction_video_url: course.introduction_video_url,
      duration_weeks: course.duration_weeks,
      difficulty_level: course.difficulty_level,
      language: course.language,
      is_published: course.is_published,
      is_self_paced: course.is_self_paced,
    });
    setCategoryIds(
      course.course_categories_join?.map(({ category }) => category.id) ?? [],
    );
    const savedCompletion = (course.metadata?.completion ??
      {}) as Partial<CompletionSettings>;
    setCompletion({ ...defaultCompletion, ...savedCompletion });
    setMetadata(course.metadata ?? {});
    setCoverFile(null);
    setIntroFile(null);
    setOpen(true);
    setError("");
  };
  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCategoryIds([]);
    setCompletion(defaultCompletion);
    setMetadata({});
    setCoverFile(null);
    setIntroFile(null);
    setOpen(false);
    setError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        metadata: { ...metadata, completion },
        slug: form.slug || slugify(form.title),
        duration_weeks: form.duration_weeks || null,
        created_by: user?.id,
      };
      const result = editingId
        ? await supabase
            .from("courses")
            .update(payload)
            .eq("id", editingId)
            .select("id")
            .single()
        : await supabase.from("courses").insert(payload).select("id").single();
      if (result.error) throw result.error;
      const courseId = result.data.id;
      if (!editingId) setEditingId(courseId);
      const { error: clearError } = await supabase
        .from("course_categories_join")
        .delete()
        .eq("course_id", courseId);
      if (clearError) throw clearError;
      if (categoryIds.length > 0) {
        const { error: categoryError } = await supabase
          .from("course_categories_join")
          .insert(
            categoryIds.map((categoryId) => ({
              course_id: courseId,
              category_id: categoryId,
            })),
          );
        if (categoryError) throw categoryError;
      }
      const uploadCatalogAsset = async (
        file: File,
        kind: "cover" | "introduction",
        oldPath?: string | null,
      ) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `courses/${courseId}/${kind}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("catalog-assets")
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data: publicAsset } = supabase.storage
          .from("catalog-assets")
          .getPublicUrl(path);
        const columns =
          kind === "cover"
            ? {
                cover_image_url: publicAsset.publicUrl,
                cover_image_storage_path: path,
              }
            : {
                introduction_video_url: publicAsset.publicUrl,
                introduction_video_storage_path: path,
              };
        const { error: updateError } = await supabase
          .from("courses")
          .update(columns)
          .eq("id", courseId);
        if (updateError) {
          await supabase.storage.from("catalog-assets").remove([path]);
          throw updateError;
        }
        if (oldPath) {
          await supabase.storage.from("catalog-assets").remove([oldPath]);
        }
      };
      const currentCourse = courses.find((course) => course.id === courseId);
      if (coverFile) {
        await uploadCatalogAsset(
          coverFile,
          "cover",
          currentCourse?.cover_image_storage_path,
        );
      }
      if (introFile) {
        await uploadCatalogAsset(
          introFile,
          "introduction",
          currentCourse?.introduction_video_storage_path,
        );
      }
      reset();
      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (course: Course) => {
    if (
      !window.confirm(
        `Delete “${course.title}” and its curriculum? This cannot be undone.`,
      )
    )
      return;
    const { error: deleteError } = await supabase
      .from("courses")
      .delete()
      .eq("id", course.id);
    if (deleteError) setError(deleteError.message);
    else {
      const paths = [
        course.cover_image_storage_path,
        course.introduction_video_storage_path,
      ].filter((path): path is string => Boolean(path));
      if (paths.length) await supabase.storage.from("catalog-assets").remove(paths);
      await load();
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Courses"
        subtitle="Build reusable curriculum for cohort, individual, or organization access."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title={editingId ? "Edit course" : "Create a course"}
          description="Drafts remain available only to administrators."
          open={open}
          onToggle={() => (open ? reset() : setOpen(true))}
          actionLabel="New course"
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Course title">
                <input
                  required
                  className="input"
                  value={form.title}
                  onChange={(event) => {
                    setValue("title", event.target.value);
                    if (!editingId)
                      setValue("slug", slugify(event.target.value));
                  }}
                />
              </Field>
              <Field label="URL slug">
                <input
                  required
                  className="input"
                  value={form.slug}
                  onChange={(event) =>
                    setValue("slug", slugify(event.target.value))
                  }
                />
              </Field>
            </div>
            <Field label="Short description">
              <input
                className="input"
                value={form.short_description ?? ""}
                onChange={(event) =>
                  setValue("short_description", event.target.value)
                }
                maxLength={180}
              />
            </Field>
            <Field label="Full description">
              <textarea
                className="input min-h-24 resize-y"
                value={form.description ?? ""}
                onChange={(event) =>
                  setValue("description", event.target.value)
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cover image" hint="Upload a wide JPG, PNG, or WebP image up to 10 MB.">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-3 text-sm text-ink-700 hover:border-brand-400 hover:bg-brand-50">
                  <Upload size={17} className="text-brand-600" />
                  <span>{coverFile?.name || (form.cover_image_url ? "Replace cover image" : "Choose cover image")}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && file.size > 10 * 1024 * 1024) {
                        setError("Cover images must be 10 MB or smaller.");
                        event.target.value = "";
                        return;
                      }
                      setCoverFile(file);
                    }}
                  />
                </label>
              </Field>
              <Field label="Introduction video" hint="Upload an optional MP4, WebM, or MOV video up to 250 MB.">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-ink-300 bg-ink-50 px-4 py-3 text-sm text-ink-700 hover:border-brand-400 hover:bg-brand-50">
                  <Upload size={17} className="text-brand-600" />
                  <span>{introFile?.name || (form.introduction_video_url ? "Replace introduction video" : "Choose introduction video")}</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && file.size > 250 * 1024 * 1024) {
                        setError("Introduction videos must be 250 MB or smaller.");
                        event.target.value = "";
                        return;
                      }
                      setIntroFile(file);
                    }}
                  />
                </label>
              </Field>
            </div>
            <div>
              <span className="label">Categories</span>
              <div className="grid gap-2 rounded-lg border border-ink-200 p-3 sm:grid-cols-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    Create an active category before assigning one.
                  </p>
                ) : (
                  categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 text-sm text-ink-700"
                    >
                      <input
                        type="checkbox"
                        checked={categoryIds.includes(category.id)}
                        onChange={(event) =>
                          setCategoryIds((current) =>
                            event.target.checked
                              ? [...current, category.id]
                              : current.filter((id) => id !== category.id),
                          )
                        }
                      />
                      {category.name}
                    </label>
                  ))
                )}
              </div>
              <span className="mt-1 block text-xs text-ink-500">
                Choose all categories that apply.
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Duration (weeks)">
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={form.duration_weeks ?? ""}
                  onChange={(event) =>
                    setValue("duration_weeks", Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Difficulty">
                <select
                  className="input"
                  value={form.difficulty_level ?? "beginner"}
                  onChange={(event) =>
                    setValue("difficulty_level", event.target.value)
                  }
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>
              <Field label="Language">
                <input
                  className="input"
                  value={form.language}
                  onChange={(event) => setValue("language", event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-ink-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) =>
                    setValue("is_published", event.target.checked)
                  }
                />{" "}
                Published
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_self_paced}
                  onChange={(event) =>
                    setValue("is_self_paced", event.target.checked)
                  }
                />{" "}
                Open all lessons immediately
              </label>
            </div>
            <fieldset className="rounded-lg border border-ink-200 p-4">
              <legend className="px-1 text-sm font-semibold text-ink-900">
                Completion requirements
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["require_all_lessons", "All published lessons"],
                  ["require_assignments", "All published assignments"],
                  ["require_assessments", "All published quizzes"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm text-ink-700"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(
                        completion[key as keyof CompletionSettings],
                      )}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Minimum grade (%)"
                  hint="Leave blank when the course is ungraded."
                >
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={completion.min_grade ?? ""}
                    onChange={(event) =>
                      setCompletion((current) => ({
                        ...current,
                        min_grade: event.target.value
                          ? Number(event.target.value)
                          : null,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Minimum attendance (%)"
                  hint="Leave blank when attendance is informational."
                >
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={completion.min_attendance ?? ""}
                    onChange={(event) =>
                      setCompletion((current) => ({
                        ...current,
                        min_attendance: event.target.value
                          ? Number(event.target.value)
                          : null,
                      }))
                    }
                  />
                </Field>
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
              <SubmitButton loading={saving}>
                {editingId ? "Save changes" : "Create course"}
              </SubmitButton>
            </div>
          </form>
        </FormPanel>

        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {error && !open && (
            <div className="p-4">
              <Alert>{error}</Alert>
            </div>
          )}
          {loading ? (
            <TableSkeleton />
          ) : courses.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={30} />}
              title="No courses yet"
              description="Create the first course, add its curriculum, then schedule a cohort."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3">Course</th>
                    <th className="px-5 py-3">Delivery</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-ink-50/70">
                      <td className="px-5 py-4">
                        <p className="font-medium text-ink-900">
                          {course.title}
                        </p>
                        <p className="mt-0.5 max-w-xl text-xs text-ink-500">
                          {course.short_description || course.slug}
                        </p>
                        {course.course_categories_join?.length ? (
                          <p className="mt-1 text-xs font-medium text-primary-700">
                            {course.course_categories_join
                              .map(({ category }) => category.name)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-ink-600">
                        {course.duration_weeks
                          ? `${course.duration_weeks} weeks`
                          : "Flexible"}{" "}
                        · {course.difficulty_level}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            course.is_published
                              ? "badge-success"
                              : "badge-neutral"
                          }
                        >
                          {course.is_published ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <CircleDashed size={12} />
                          )}
                          {course.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            className="btn-ghost !p-2"
                            aria-label={`Edit ${course.title}`}
                            onClick={() => startEdit(course)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn-ghost !p-2 text-danger-600"
                            aria-label={`Delete ${course.title}`}
                            onClick={() => void remove(course)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
