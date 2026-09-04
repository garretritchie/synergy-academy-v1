import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDashed,
  Eye,
  FileText,
  Layers,
  Plus,
  Rocket,
  Settings2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage, slugify } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Course, CourseCategory } from "@/types";

type OutlineLessonDraft = {
  id: string;
  title: string;
};

type OutlineModuleDraft = {
  id: string;
  title: string;
  lessons: OutlineLessonDraft[];
};

type CourseReadiness = Course & {
  categoryCount: number;
  moduleCount: number;
  lessonCount: number;
  populatedLessonCount: number;
  publishedModuleCount: number;
  publishedLessonCount: number;
  resourceCount: number;
  cohortCount: number;
};

type ReadinessStep = {
  label: string;
  description: string;
  complete: boolean;
  optional?: boolean;
  path: string;
  action: string;
  icon: typeof BookOpen;
};

const newLesson = (): OutlineLessonDraft => ({
  id: crypto.randomUUID(),
  title: "",
});

const newModule = (): OutlineModuleDraft => ({
  id: crypto.randomUUID(),
  title: "",
  lessons: [newLesson()],
});

const initialOutline = (): OutlineModuleDraft[] => [newModule()];

function getReadinessSteps(course: CourseReadiness): ReadinessStep[] {
  const editPath = `/admin/courses?edit=${course.id}`;
  const curriculumPath = `/admin/academic?course=${course.id}`;
  return [
    {
      label: "Course details",
      description: "Add a clear summary, category, format, and completion rules.",
      complete: Boolean(course.short_description?.trim()) && course.categoryCount > 0,
      path: editPath,
      action: "Complete details",
      icon: Settings2,
    },
    {
      label: "Outline",
      description: "Organize the course into modules and short lessons.",
      complete: course.moduleCount > 0 && course.lessonCount > 0,
      path: curriculumPath,
      action: "Build outline",
      icon: Layers,
    },
    {
      label: "Lesson content",
      description: "Add text, media, activities, or resources to every lesson.",
      complete:
        course.lessonCount > 0 &&
        course.populatedLessonCount === course.lessonCount,
      path: curriculumPath,
      action: "Add content",
      icon: FileText,
    },
    {
      label: "Delivery and learners",
      description: course.is_self_paced
        ? "eLearning access is enabled. Cohorts can still be added later."
        : "Create a cohort before enrolling learners into live delivery.",
      complete: course.is_self_paced || course.cohortCount > 0,
      path: `/admin/cohorts?course=${course.id}`,
      action: "Set up delivery",
      icon: Users,
    },
    {
      label: "Review and publish",
      description: "Publish the course, modules, and lessons when they are ready.",
      complete:
        course.is_published &&
        course.publishedModuleCount > 0 &&
        course.publishedLessonCount > 0,
      path: editPath,
      action: "Review publishing",
      icon: Rocket,
    },
  ];
}

export function AdminCourseStudio() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<CourseReadiness[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [durationWeeks, setDurationWeeks] = useState(6);
  const [selfPaced, setSelfPaced] = useState(true);
  const [outline, setOutline] = useState<OutlineModuleDraft[]>(initialOutline);

  const selectedCourseId = searchParams.get("course") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [
      courseResult,
      categoryResult,
      moduleResult,
      lessonResult,
      blockResult,
      resourceResult,
      cohortResult,
    ] = await Promise.all([
      supabase
        .from("courses")
        .select("*, course_categories_join(category_id)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("course_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("modules").select("id,course_id,is_published"),
      supabase.from("lessons").select("id,module_id,is_published"),
      supabase.from("lesson_blocks").select("id,lesson_id"),
      supabase.from("resources").select("id,course_id"),
      supabase.from("cohorts").select("id,course_id,is_active"),
    ]);

    const failed = [
      courseResult,
      categoryResult,
      moduleResult,
      lessonResult,
      blockResult,
      resourceResult,
      cohortResult,
    ].find((result) => result.error);
    if (failed?.error) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    const modules = moduleResult.data ?? [];
    const lessons = lessonResult.data ?? [];
    const blocks = blockResult.data ?? [];
    const resources = resourceResult.data ?? [];
    const cohorts = cohortResult.data ?? [];
    const blockLessonIds = new Set(blocks.map((block) => block.lesson_id));
    const lessonsByModule = new Map<string, typeof lessons>();
    for (const lesson of lessons) {
      const current = lessonsByModule.get(lesson.module_id) ?? [];
      current.push(lesson);
      lessonsByModule.set(lesson.module_id, current);
    }

    const enriched = (courseResult.data ?? []).map((rawCourse) => {
      const courseModules = modules.filter(
        (module) => module.course_id === rawCourse.id,
      );
      const courseLessons = courseModules.flatMap(
        (module) => lessonsByModule.get(module.id) ?? [],
      );
      return {
        ...rawCourse,
        categoryCount: rawCourse.course_categories_join?.length ?? 0,
        moduleCount: courseModules.length,
        lessonCount: courseLessons.length,
        populatedLessonCount: courseLessons.filter((lesson) =>
          blockLessonIds.has(lesson.id),
        ).length,
        publishedModuleCount: courseModules.filter(
          (module) => module.is_published,
        ).length,
        publishedLessonCount: courseLessons.filter(
          (lesson) => lesson.is_published,
        ).length,
        resourceCount: resources.filter(
          (resource) => resource.course_id === rawCourse.id,
        ).length,
        cohortCount: cohorts.filter(
          (cohort) => cohort.course_id === rawCourse.id && cohort.is_active,
        ).length,
      } as CourseReadiness;
    });

    setCourses(enriched);
    setCategories((categoryResult.data ?? []) as CourseCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCourse = useMemo(
    () =>
      courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId],
  );

  useEffect(() => {
    if (!selectedCourse || selectedCourseId) return;
    setSearchParams({ course: selectedCourse.id }, { replace: true });
  }, [selectedCourse, selectedCourseId, setSearchParams]);

  const readiness = selectedCourse ? getReadinessSteps(selectedCourse) : [];
  const completedSteps = readiness.filter((item) => item.complete).length;
  const readinessPercent = readiness.length
    ? Math.round((completedSteps / readiness.length) * 100)
    : 0;
  const nextStep = readiness.find((item) => !item.complete);

  const outlineIsValid =
    outline.length > 0 &&
    outline.every(
      (module) =>
        module.title.trim() &&
        module.lessons.length > 0 &&
        module.lessons.every((lesson) => lesson.title.trim()),
    );

  const canContinue =
    step === 0
      ? Boolean(title.trim() && shortDescription.trim())
      : step === 1
        ? categories.length === 0 || Boolean(categoryId)
        : step === 2
          ? outlineIsValid
          : true;

  const resetWizard = () => {
    setStep(0);
    setTitle("");
    setShortDescription("");
    setCategoryId("");
    setDifficulty("beginner");
    setDurationWeeks(6);
    setSelfPaced(true);
    setOutline(initialOutline());
    setWizardOpen(false);
    setError("");
  };

  const uniqueSlug = (value: string) => {
    const base = slugify(value) || "course";
    const existing = new Set(courses.map((course) => course.slug));
    if (!existing.has(base)) return base;
    let suffix = 2;
    while (existing.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  };

  const createCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue || !outlineIsValid) return;
    setSaving(true);
    setError("");
    let createdCourseId = "";
    try {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({
          title: title.trim(),
          slug: uniqueSlug(title),
          short_description: shortDescription.trim(),
          description: null,
          cover_image_url: null,
          introduction_video_url: null,
          duration_weeks: durationWeeks,
          difficulty_level: difficulty,
          language: "en",
          is_published: false,
          is_self_paced: selfPaced,
          metadata: {
            completion: {
              require_all_lessons: true,
              require_assignments: false,
              require_assessments: false,
              min_grade: null,
              min_attendance: null,
            },
          },
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (courseError) throw courseError;
      createdCourseId = course.id;

      if (categoryId) {
        const { error: categoryError } = await supabase
          .from("course_categories_join")
          .insert({ course_id: course.id, category_id: categoryId });
        if (categoryError) throw categoryError;
      }

      const { data: createdModules, error: moduleError } = await supabase
        .from("modules")
        .insert(
          outline.map((module, index) => ({
            course_id: course.id,
            title: module.title.trim(),
            display_order: index + 1,
            is_published: false,
            metadata: {},
          })),
        )
        .select("id,display_order");
      if (moduleError) throw moduleError;

      const moduleIdByOrder = new Map(
        (createdModules ?? []).map((module) => [module.display_order, module.id]),
      );
      const lessonPayload = outline.flatMap((module, moduleIndex) => {
        const moduleId = moduleIdByOrder.get(moduleIndex + 1);
        if (!moduleId) return [];
        return module.lessons.map((lesson, lessonIndex) => ({
          module_id: moduleId,
          title: lesson.title.trim(),
          estimated_minutes: 15,
          display_order: lessonIndex + 1,
          is_published: false,
          metadata: {},
        }));
      });
      const { error: lessonError } = await supabase
        .from("lessons")
        .insert(lessonPayload);
      if (lessonError) throw lessonError;

      resetWizard();
      await load();
      setSearchParams({ course: course.id });
    } catch (caught) {
      if (createdCourseId) {
        await supabase.from("courses").delete().eq("id", createdCourseId);
      }
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const updateModule = (
    moduleId: string,
    update: (module: OutlineModuleDraft) => OutlineModuleDraft,
  ) => {
    setOutline((current) =>
      current.map((module) => (module.id === moduleId ? update(module) : module)),
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Course Studio"
        subtitle="Create, prepare, and publish a course with one guided workspace. Advanced tools remain available when you need them."
        actions={
          <button className="btn-primary" onClick={() => setWizardOpen(true)}>
            <Plus size={16} /> New course
          </button>
        }
      />

      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}

        {wizardOpen && (
          <FormPanel
            title="Create a course"
            description="Start with the essentials. You can refine every setting later."
            open
            onToggle={resetWizard}
          >
          <form onSubmit={createCourse}>
            <CreationWizard
              steps={["Course basics", "Format", "Outline", "Review"]}
              currentStep={step}
              canContinue={canContinue}
              saving={saving}
              finalAction="Create draft course"
              onBack={() => setStep((current) => Math.max(0, current - 1))}
              onNext={() => setStep((current) => Math.min(3, current + 1))}
            >
              {step === 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field
                    label="Course title"
                    hint="Use the name learners will see in the catalog."
                  >
                    <input
                      required
                      autoFocus
                      className="input"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Example: Fundamentals of AI for Business"
                    />
                  </Field>
                  <Field
                    label="Short description"
                    hint="One clear sentence describing what learners will gain."
                  >
                    <input
                      required
                      className="input"
                      maxLength={180}
                      value={shortDescription}
                      onChange={(event) =>
                        setShortDescription(event.target.value)
                      }
                      placeholder="Build practical AI skills for everyday work."
                    />
                  </Field>
                </div>
              ) : step === 1 ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <Field
                      label="Category"
                      hint="This helps learners find the course later."
                    >
                      <select
                        required
                        className="input"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                      >
                        <option value="">
                          {categories.length
                            ? "Choose a category"
                            : "No categories are available yet"}
                        </option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Difficulty">
                        <select
                          className="input"
                          value={difficulty}
                          onChange={(event) => setDifficulty(event.target.value)}
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </Field>
                      <Field label="Estimated duration">
                        <select
                          className="input"
                          value={durationWeeks}
                          onChange={(event) =>
                            setDurationWeeks(Number(event.target.value))
                          }
                        >
                          {[1, 2, 3, 4, 6, 8, 12].map((weeks) => (
                            <option key={weeks} value={weeks}>
                              {weeks} {weeks === 1 ? "week" : "weeks"}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                  <fieldset>
                    <legend className="label">How will learners take it?</legend>
                    <div className="space-y-2">
                      <label
                        className={`block cursor-pointer rounded-xl border p-4 transition ${
                          selfPaced
                            ? "border-brand-400 bg-brand-50"
                            : "border-ink-200 hover:border-ink-300"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="delivery"
                            className="mt-1"
                            checked={selfPaced}
                            onChange={() => setSelfPaced(true)}
                          />
                          <span>
                            <span className="block text-sm font-semibold text-ink-900">
                              eLearning access
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-ink-600">
                              Learners can work through available lessons on their own schedule.
                            </span>
                          </span>
                        </span>
                      </label>
                      <label
                        className={`block cursor-pointer rounded-xl border p-4 transition ${
                          !selfPaced
                            ? "border-brand-400 bg-brand-50"
                            : "border-ink-200 hover:border-ink-300"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="delivery"
                            className="mt-1"
                            checked={!selfPaced}
                            onChange={() => setSelfPaced(false)}
                          />
                          <span>
                            <span className="block text-sm font-semibold text-ink-900">
                              Guided cohort
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-ink-600">
                              Pair eLearning with scheduled instruction, dates, and a learner group.
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                </div>
              ) : step === 2 ? (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">
                        Create a simple outline
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-ink-500">
                        Add module and lesson names now. Content can be added after the draft is created.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setOutline((current) => [...current, newModule()])
                      }
                    >
                      <Plus size={15} /> Add module
                    </button>
                  </div>
                  <div className="space-y-3">
                    {outline.map((module, moduleIndex) => (
                      <section
                        key={module.id}
                        className="rounded-xl border border-ink-200 bg-ink-50/60 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-800">
                            {moduleIndex + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-3">
                            <input
                              className="input bg-white"
                              aria-label={`Module ${moduleIndex + 1} title`}
                              value={module.title}
                              onChange={(event) =>
                                updateModule(module.id, (current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="Module title"
                            />
                            <div className="space-y-2 pl-0 sm:pl-4">
                              {module.lessons.map((lesson, lessonIndex) => (
                                <div key={lesson.id} className="flex items-center gap-2">
                                  <span className="w-5 text-right text-xs text-ink-400">
                                    {lessonIndex + 1}.
                                  </span>
                                  <input
                                    className="input bg-white"
                                    aria-label={`Lesson ${lessonIndex + 1} in module ${moduleIndex + 1}`}
                                    value={lesson.title}
                                    onChange={(event) =>
                                      updateModule(module.id, (current) => ({
                                        ...current,
                                        lessons: current.lessons.map((item) =>
                                          item.id === lesson.id
                                            ? { ...item, title: event.target.value }
                                            : item,
                                        ),
                                      }))
                                    }
                                    placeholder="Lesson title"
                                  />
                                  {module.lessons.length > 1 ? (
                                    <button
                                      type="button"
                                      className="btn-ghost !p-2 text-danger-600"
                                      aria-label={`Remove lesson ${lessonIndex + 1}`}
                                      onClick={() =>
                                        updateModule(module.id, (current) => ({
                                          ...current,
                                          lessons: current.lessons.filter(
                                            (item) => item.id !== lesson.id,
                                          ),
                                        }))
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                              <button
                                type="button"
                                className="btn-ghost text-brand-700"
                                onClick={() =>
                                  updateModule(module.id, (current) => ({
                                    ...current,
                                    lessons: [...current.lessons, newLesson()],
                                  }))
                                }
                              >
                                <Plus size={14} /> Add lesson
                              </button>
                            </div>
                          </div>
                          {outline.length > 1 ? (
                            <button
                              type="button"
                              className="btn-ghost !p-2 text-danger-600"
                              aria-label={`Remove module ${moduleIndex + 1}`}
                              onClick={() =>
                                setOutline((current) =>
                                  current.filter((item) => item.id !== module.id),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink-950">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-ink-600">
                      {shortDescription}
                    </p>
                    <div className="mt-5 space-y-3">
                      {outline.map((module, moduleIndex) => (
                        <div key={module.id} className="flex gap-3">
                          <CheckCircle2
                            size={17}
                            className="mt-0.5 shrink-0 text-success-600"
                          />
                          <div>
                            <p className="text-sm font-semibold text-ink-900">
                              {moduleIndex + 1}. {module.title}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-500">
                              {module.lessons.map((lesson) => lesson.title).join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <aside className="rounded-xl bg-brand-50 p-4">
                    <Sparkles size={18} className="text-brand-700" />
                    <p className="mt-3 text-sm font-semibold text-ink-900">
                      A safe draft will be created
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-600">
                      Nothing is visible to learners until you add content, review it, and publish it.
                    </p>
                    <dl className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-500">Modules</dt>
                        <dd className="font-semibold text-ink-900">{outline.length}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-500">Lessons</dt>
                        <dd className="font-semibold text-ink-900">
                          {outline.reduce(
                            (total, module) => total + module.lessons.length,
                            0,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-500">Format</dt>
                        <dd className="text-right font-semibold text-ink-900">
                          {selfPaced ? "eLearning" : "Guided cohort"}
                        </dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              )}
            </CreationWizard>
          </form>
          </FormPanel>
        )}

        {loading ? (
          <section className="rounded-xl bg-white shadow-soft">
            <TableSkeleton rows={5} />
          </section>
        ) : courses.length === 0 ? (
          <section className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center shadow-soft">
            <BookOpen className="mx-auto text-brand-600" size={30} />
            <h2 className="mt-4 font-display text-lg font-semibold text-ink-950">
              Create your first course
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">
              The guided setup creates a private draft, an organized outline, and a clear list of what to do next.
            </p>
            <button className="btn-primary mt-5" onClick={() => setWizardOpen(true)}>
              <Plus size={16} /> Start guided setup
            </button>
          </section>
        ) : selectedCourse ? (
          <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="card self-start p-3 xl:sticky xl:top-24">
              <div className="px-2 pb-2 pt-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Your courses
                </h2>
              </div>
              <div className="max-h-[34rem] space-y-1 overflow-y-auto pr-1">
                {courses.map((course) => {
                  const steps = getReadinessSteps(course);
                  const complete = steps.filter((item) => item.complete).length;
                  const selected = course.id === selectedCourse.id;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      className={`min-w-0 w-full overflow-hidden rounded-md border px-3 py-3 text-left transition ${
                        selected
                          ? "border-brand-200 bg-brand-50 text-brand-950 shadow-[inset_2px_0_0_#176fc4]"
                          : "border-transparent text-ink-700 hover:border-ink-200 hover:bg-ink-50"
                      }`}
                      onClick={() => setSearchParams({ course: course.id })}
                    >
                      <span className="block max-w-full truncate text-sm font-semibold">
                        {course.title}
                      </span>
                      <span
                        className={`mt-1 block text-xs ${
                          selected ? "text-brand-700" : "text-ink-500"
                        }`}
                      >
                        {complete} of {steps.length} ready
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="space-y-5">
              <section className="card overflow-hidden">
                <div className="grid gap-5 border-b border-ink-100 p-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          selectedCourse.is_published
                            ? "badge-success"
                            : "badge-neutral"
                        }
                      >
                        {selectedCourse.is_published ? "Published" : "Private draft"}
                      </span>
                      <span className="text-xs text-ink-500">
                        {selectedCourse.is_self_paced ? "eLearning" : "Cohort delivery"}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-xl font-semibold text-ink-950">
                      {selectedCourse.title}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
                      {selectedCourse.short_description ||
                        "Add a short description so learners understand the course outcome."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-xs font-semibold text-ink-700">
                        Course readiness
                      </span>
                      <span className="font-display text-2xl font-semibold text-ink-950">
                        {readinessPercent}%
                      </span>
                    </div>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100"
                      role="progressbar"
                      aria-label="Course readiness"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={readinessPercent}
                    >
                      <div
                        className="h-full rounded-full bg-brand-600 transition-[width]"
                        style={{ width: `${readinessPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink-500">
                      {completedSteps} of {readiness.length} areas ready
                    </p>
                  </div>
                </div>
                {nextStep ? (
                  <div className="flex flex-col gap-3 bg-ink-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <CircleDashed size={18} className="mt-0.5 text-brand-600" />
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          Recommended next: {nextStep.label}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {nextStep.description}
                        </p>
                      </div>
                    </div>
                    <Link to={nextStep.path} className="btn-primary shrink-0">
                      {nextStep.action} <ArrowRight size={15} />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-success-50 px-5 py-4 text-success-800">
                    <CheckCircle2 size={18} />
                    <p className="text-sm font-semibold">
                      This course is ready for learners.
                    </p>
                  </div>
                )}
              </section>

              <section className="card p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink-950">
                      Course checklist
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-ink-500">
                      Work from top to bottom. You can return here at any time.
                    </p>
                  </div>
                  <Link
                    to={`/courses/${selectedCourse.slug}`}
                    className="btn-secondary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Eye size={15} /> Catalog preview
                  </Link>
                </div>
                <ol className="mt-5 grid gap-3 lg:grid-cols-2">
                  {readiness.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.label}
                        className={`rounded-lg border p-4 ${
                          item.complete
                            ? "border-ink-200 bg-white"
                            : "border-brand-200 bg-brand-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${
                              item.complete
                                ? "bg-success-50 text-success-700 ring-success-200"
                                : "bg-white text-brand-700 ring-brand-200"
                            }`}
                          >
                            {item.complete ? <Check size={17} /> : <Icon size={17} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink-900">
                              {index + 1}. {item.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-ink-500">
                              {item.description}
                            </p>
                            <Link
                              to={item.path}
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900"
                            >
                              {item.complete ? "Review" : item.action}
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="card grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Modules", value: selectedCourse.moduleCount, icon: Layers },
                  { label: "Lessons", value: selectedCourse.lessonCount, icon: FileText },
                  { label: "Resources", value: selectedCourse.resourceCount, icon: BookOpen },
                  { label: "Active cohorts", value: selectedCourse.cohortCount, icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="border-b border-ink-100 p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-500">{label}</span>
                      <Icon size={16} className="text-brand-600" />
                    </div>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink-950">
                      {value}
                    </p>
                  </div>
                ))}
              </section>

              <details className="card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-ink-900">
                  Advanced course tools
                  <Settings2 size={16} className="text-ink-400" />
                </summary>
                <div className="grid gap-2 border-t border-ink-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Course record", `/admin/courses?edit=${selectedCourse.id}`],
                    ["Curriculum builder", `/admin/academic?course=${selectedCourse.id}`],
                    ["Course resources", `/admin/resources?course=${selectedCourse.id}`],
                    ["Content release", "/admin/release-rules"],
                    ["Cohorts", `/admin/cohorts?course=${selectedCourse.id}`],
                    ["Enrolments", "/admin/enrolments"],
                  ].map(([label, path]) => (
                    <Link
                      key={path}
                      to={path}
                      className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5 text-xs font-semibold text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                    >
                      {label} <ArrowRight size={13} />
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
