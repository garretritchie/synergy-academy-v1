import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  ListTree,
  LockKeyhole,
  PanelRight,
  PlayCircle,
  X,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/format";
import type { Lesson, LessonBlock } from "@/types";

type LessonRow = Lesson & {
  lesson_blocks: LessonBlock[];
  module: { title: string; course_id: string };
};
type LessonNavigation = { id: string; title: string };
type OutlineLesson = LessonNavigation & {
  display_order: number;
  estimated_minutes: number | null;
  module: {
    id: string;
    title: string;
    course_id: string;
    display_order: number;
  };
};
type OutlineModule = {
  id: string;
  title: string;
  display_order: number;
  lessons: OutlineLesson[];
};
export function LessonPage() {
  const { cohortId, lessonId } = useParams<{
    cohortId: string;
    lessonId: string;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [enrolmentId, setEnrolmentId] = useState("");
  const [complete, setComplete] = useState(false);
  const [previousLesson, setPreviousLesson] = useState<LessonNavigation | null>(null);
  const [nextLesson, setNextLesson] = useState<LessonNavigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeNugget, setActiveNugget] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineLessons, setOutlineLessons] = useState<OutlineLesson[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
  useEffect(() => {
    if (!cohortId || !lessonId || !user) return;
    setActiveNugget(0);
    setOutlineOpen(false);
    void (async () => {
      const [lessonResult, enrolmentResult] = await Promise.all([
        supabase
          .from("lessons")
          .select("*,module:modules(title,course_id),lesson_blocks(*)")
          .eq("id", lessonId)
          .single(),
        supabase
          .from("enrolments")
          .select("id")
          .eq("cohort_id", cohortId)
          .eq("student_id", user.id)
          .eq("status", "active")
          .single(),
      ]);
      const queryError = lessonResult.error || enrolmentResult.error;
      if (queryError) setError(queryError.message);
      else {
        const lessonRow = lessonResult.data as unknown as LessonRow;
        const storagePaths = lessonRow.lesson_blocks
          .map((block) => String(block.content.storage_path || ""))
          .filter(Boolean);
        if (storagePaths.length) {
          const { data: signedAssets } = await supabase.storage
            .from("course-assets")
            .createSignedUrls(storagePaths, 60 * 60);
          const urls = new Map(
            (signedAssets ?? [])
              .filter((asset) => asset.signedUrl)
              .map((asset) => [asset.path, asset.signedUrl]),
          );
          lessonRow.lesson_blocks = lessonRow.lesson_blocks.map((block) => ({
            ...block,
            content: {
              ...block.content,
              resolved_url: urls.get(String(block.content.storage_path || "")),
            },
          }));
        }
        setLesson(lessonRow);
        setEnrolmentId(enrolmentResult.data.id);
        const { data: progress } = await supabase
          .from("progress_records")
          .select("status")
          .eq("cohort_id", cohortId)
          .eq("lesson_id", lessonId)
          .eq("student_id", user.id)
          .maybeSingle();
        setComplete(progress?.status === "completed");
        if (!progress) {
          const { error: startError } = await supabase.from("progress_records").insert({
            enrolment_id: enrolmentResult.data.id,
            student_id: user.id,
            lesson_id: lessonId,
            cohort_id: cohortId,
            status: "in_progress",
            progress_percent: 0,
            last_accessed_at: new Date().toISOString(),
          });
          if (startError) setError(startError.message);
        }
        const [navigationResult, courseProgressResult, releaseResult] =
          await Promise.all([
            supabase
              .from("lessons")
              .select(
                "id,title,display_order,estimated_minutes,module:modules!inner(id,title,course_id,display_order)",
              )
              .eq("module.course_id", lessonRow.module.course_id)
              .eq("is_published", true),
            supabase
              .from("progress_records")
              .select("lesson_id,status")
              .eq("cohort_id", cohortId)
              .eq("student_id", user.id),
            supabase.rpc("get_released_lesson_ids", {
              cohort_uuid: cohortId,
            }),
          ]);
        if (!navigationResult.error && navigationResult.data) {
          const ordered = [...navigationResult.data].sort((left, right) => {
            const leftModule = left.module as unknown as { display_order: number };
            const rightModule = right.module as unknown as { display_order: number };
            return (
              leftModule.display_order - rightModule.display_order ||
              left.display_order - right.display_order
            );
          }) as unknown as OutlineLesson[];
          const released = releaseResult.error
            ? ordered.map((item) => item.id)
            : ((releaseResult.data ?? []) as string[]);
          const navigable = ordered.filter((item) => released.includes(item.id));
          const currentIndex = navigable.findIndex((item) => item.id === lessonId);
          setOutlineLessons(ordered);
          setReleasedLessonIds(released);
          setCompletedLessonIds(
            (courseProgressResult.data ?? [])
              .filter((record) => record.status === "completed")
              .map((record) => record.lesson_id),
          );
          setPreviousLesson(
            currentIndex > 0 ? navigable[currentIndex - 1] : null,
          );
          setNextLesson(
            currentIndex >= 0 && currentIndex < navigable.length - 1
              ? navigable[currentIndex + 1]
              : null,
          );
        }
      }
      setLoading(false);
    })();
  }, [cohortId, lessonId, user]);
  useEffect(() => {
    if (!outlineOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOutlineOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [outlineOpen]);
  const markComplete = async (continueToNext = false) => {
    if (!lessonId || !cohortId || !user) return;
    setSaving(true);
    setError("");
    try {
      const { error: upsertError } = await supabase
        .from("progress_records")
        .upsert(
          {
            enrolment_id: enrolmentId,
            student_id: user.id,
            lesson_id: lessonId,
            cohort_id: cohortId,
            status: "completed",
            progress_percent: 100,
            last_accessed_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
          { onConflict: "enrolment_id,lesson_id" },
        );
      if (upsertError) throw upsertError;
      setComplete(true);
      setCompletedLessonIds((current) =>
        current.includes(lessonId) ? current : [...current, lessonId],
      );
      if (continueToNext && nextLesson) {
        navigate(`/student/courses/${cohortId}/learn/${nextLesson.id}`);
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  const lessonWorkspace = useMemo(
    () => buildLessonWorkspace(lesson?.lesson_blocks ?? []),
    [lesson?.lesson_blocks],
  );
  const activeBlocks = lessonWorkspace.nuggets[activeNugget] ?? [];
  const isLastNugget =
    activeNugget === Math.max(0, lessonWorkspace.nuggets.length - 1);
  const lessonPartCount = Math.max(1, lessonWorkspace.nuggets.length);
  const outlineModules = useMemo(() => {
    const groups = new Map<
      string,
      OutlineModule
    >();
    for (const outlineLesson of outlineLessons) {
      const module = outlineLesson.module;
      if (!groups.has(module.id)) {
        groups.set(module.id, {
          id: module.id,
          title: module.title,
          display_order: module.display_order,
          lessons: [],
        });
      }
      groups.get(module.id)?.lessons.push(outlineLesson);
    }
    return [...groups.values()].sort(
      (left, right) => left.display_order - right.display_order,
    );
  }, [outlineLessons]);
  const currentLessonIndex = outlineLessons.findIndex(
    (item) => item.id === lessonId,
  );
  const completedOutlineCount = outlineLessons.filter((item) =>
    completedLessonIds.includes(item.id),
  ).length;
  return (
    <CourseLayout>
      {loading ? (
        <div className="rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : !lesson ? (
        <Alert>{error || "Lesson not found."}</Alert>
      ) : (
        <article className="mx-auto max-w-6xl space-y-5 pb-28 sm:pb-20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOutlineOpen(true)}
            >
              <ListTree size={16} />
              Course outline
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs tabular-nums text-brand-700">
                {completedOutlineCount}/{outlineLessons.length}
              </span>
            </button>
            {currentLessonIndex >= 0 && (
              <p className="text-xs font-medium text-ink-500">
                Lesson {currentLessonIndex + 1} of {outlineLessons.length}
              </p>
            )}
          </div>
          {error && <Alert>{error}</Alert>}
          <header className="rounded-2xl bg-[#0a1628] px-5 py-5 text-white shadow-[0_18px_45px_-32px_rgba(10,22,40,0.8)] sm:px-6 sm:py-6">
            <p className="text-xs font-semibold text-brand-200">
              {lesson.module.title}
            </p>
            <h1 className="mt-1.5 max-w-4xl text-2xl font-semibold tracking-[-0.025em] text-white">
              {lesson.title}
            </h1>
            {lesson.description && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                {lesson.description}
              </p>
            )}
          </header>
          <div className="grid items-start gap-4 rounded-2xl bg-[#eaf3ff] p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_19rem] xl:p-5">
            <section
              className="flex min-h-0 flex-col rounded-xl bg-white p-4 shadow-soft sm:min-h-[28rem] sm:p-6"
              aria-label="Lesson content"
            >
              {lessonWorkspace.nuggets.length > 0 ? (
                <>
                  <div className="flex flex-col items-start gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                      <p className="text-xs font-semibold text-ink-900">
                        Part {activeNugget + 1} of {lessonWorkspace.nuggets.length}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Focus on one idea, then continue when ready.
                      </p>
                    </div>
                    <div
                      className="flex w-full gap-1.5 sm:max-w-48 sm:flex-1"
                      role="progressbar"
                      aria-label="Lesson step progress"
                      aria-valuemin={1}
                      aria-valuemax={lessonWorkspace.nuggets.length}
                      aria-valuenow={activeNugget + 1}
                    >
                      {lessonWorkspace.nuggets.map((_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 flex-1 rounded-full ${
                            index <= activeNugget ? "bg-brand-600" : "bg-ink-100"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 py-5 sm:py-6">
                    <LessonPartContent
                      blocks={activeBlocks}
                      cohortId={cohortId || ""}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-center text-sm text-ink-500">
                  This lesson has no main content yet.
                </div>
              )}
            </section>

            <aside className="rounded-xl bg-[#dceafe] p-4 xl:sticky xl:top-4" aria-label="Lesson activities and supporting content">
              <div className="mb-3 flex items-center gap-2 px-0.5">
                <PanelRight size={17} className="text-brand-600" />
                <h2 className="text-sm font-semibold text-ink-900">Activities and key points</h2>
              </div>
              {lessonWorkspace.railBlocks.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {lessonWorkspace.railBlocks.map((block) => (
                    <LessonBlockView
                      key={block.id}
                      block={block}
                      cohortId={cohortId || ""}
                      rail
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-white p-4 text-xs leading-5 text-ink-500 shadow-soft">
                  No additional activities are attached to this lesson.
                </div>
              )}
            </aside>
          </div>
          <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy/95 px-3 py-3 shadow-elevated backdrop-blur-sm sm:px-6">
            <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
            <div>
              {activeNugget > 0 ? (
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() =>
                    setActiveNugget((current) => Math.max(0, current - 1))
                  }
                >
                  <ArrowLeft size={16} /> Previous part
                </button>
              ) : previousLesson ? (
                <Link
                  className="btn-secondary w-full sm:w-auto"
                  to={`/student/courses/${cohortId}/learn/${previousLesson.id}`}
                >
                  <ArrowLeft size={16} /> Previous lesson
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setOutlineOpen(true)}
                >
                  <ListTree size={16} /> Course outline
                </button>
              )}
            </div>
            <div className="order-first col-span-2 text-center sm:order-none sm:col-span-1">
              <p className="text-xs font-semibold text-white">
                Part {activeNugget + 1} of {lessonPartCount}
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                {complete ? "Lesson completed" : "Lesson in progress"}
              </p>
            </div>
            <div className="flex justify-end">
              {!isLastNugget ? (
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={() =>
                    setActiveNugget((current) =>
                      Math.min(
                        lessonWorkspace.nuggets.length - 1,
                        current + 1,
                      ),
                    )
                  }
                >
                  Next part <ArrowRight size={16} />
                </button>
              ) : !complete ? (
                <button
                  type="button"
                  disabled={saving}
                  className="btn-primary w-full !bg-success-600 hover:!bg-success-700 sm:w-auto"
                  onClick={() => void markComplete(Boolean(nextLesson))}
                >
                  {saving
                    ? "Saving..."
                    : nextLesson
                      ? "Complete and continue"
                      : "Complete lesson"}
                  {!saving && nextLesson && <ArrowRight size={16} />}
                </button>
              ) : nextLesson ? (
                <Link
                  className="btn-primary w-full sm:w-auto"
                  to={`/student/courses/${cohortId}/learn/${nextLesson.id}`}
                >
                  Next lesson <ArrowRight size={16} />
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setOutlineOpen(true)}
                >
                  Review course outline
                </button>
              )}
            </div>
            </div>
          </footer>
          {outlineOpen && (
            <CourseOutlineDrawer
              modules={outlineModules}
              currentLessonId={lessonId || ""}
              cohortId={cohortId || ""}
              completedLessonIds={completedLessonIds}
              releasedLessonIds={releasedLessonIds}
              onClose={() => setOutlineOpen(false)}
            />
          )}
        </article>
      )}
    </CourseLayout>
  );
}

const RAIL_BLOCK_TYPES = new Set([
  "assignment_reference",
  "quiz_reference",
  "knowledge_check",
  "resource",
  "external_link",
  "callout",
]);

function buildLessonWorkspace(blocks: LessonBlock[]) {
  const ordered = [...blocks].sort((a, b) => a.display_order - b.display_order);
  const railBlocks: LessonBlock[] = [];
  const nuggets: LessonBlock[][] = [];
  const groupedPartIndexes = new Map<string, number>();
  let pendingStructure: LessonBlock[] = [];
  for (const block of ordered) {
    if (RAIL_BLOCK_TYPES.has(block.block_type)) {
      railBlocks.push(block);
      continue;
    }
    const partId = String(block.content.part_id || "");
    if (partId) {
      const existingIndex = groupedPartIndexes.get(partId);
      if (existingIndex === undefined) {
        groupedPartIndexes.set(partId, nuggets.length);
        nuggets.push([...pendingStructure, block]);
      } else {
        nuggets[existingIndex].push(...pendingStructure, block);
      }
      pendingStructure = [];
      continue;
    }
    if (["heading", "divider"].includes(block.block_type)) {
      pendingStructure.push(block);
      continue;
    }
    nuggets.push([...pendingStructure, block]);
    pendingStructure = [];
  }
  if (pendingStructure.length) nuggets.push(pendingStructure);
  return { nuggets, railBlocks };
}

function LessonPartContent({
  blocks,
  cohortId,
}: {
  blocks: LessonBlock[];
  cohortId: string;
}) {
  const layout = String(
    blocks.find((block) => block.content.part_layout)?.content.part_layout ||
      "stacked",
  );
  const mediaBlocks = blocks.filter((block) =>
    ["image", "video"].includes(block.block_type),
  );
  const textBlocks = blocks.filter(
    (block) => !["image", "video"].includes(block.block_type),
  );
  const renderBlocks = (items: LessonBlock[]) => (
    <div className="space-y-5">
      {items.map((block) => (
        <LessonBlockView
          key={block.id}
          block={block}
          cohortId={cohortId}
          embedded
        />
      ))}
    </div>
  );

  if (layout === "split" && mediaBlocks.length > 0 && textBlocks.length > 0) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0">{renderBlocks(mediaBlocks)}</div>
        <div className="min-w-0">{renderBlocks(textBlocks)}</div>
      </div>
    );
  }

  return <div className="mx-auto max-w-[72ch]">{renderBlocks(blocks)}</div>;
}

function CourseOutlineDrawer({
  modules,
  currentLessonId,
  cohortId,
  completedLessonIds,
  releasedLessonIds,
  onClose,
}: {
  modules: OutlineModule[];
  currentLessonId: string;
  cohortId: string;
  completedLessonIds: string[];
  releasedLessonIds: string[];
  onClose: () => void;
}) {
  const totalLessons = modules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  );
  const completedLessons = modules
    .flatMap((module) => module.lessons)
    .filter((lesson) => completedLessonIds.includes(lesson.id)).length;
  const completionPercent = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-navy/55"
        aria-label="Close course outline"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-outline-title"
        className="relative flex h-full w-full max-w-md flex-col bg-canvas shadow-elevated"
      >
        <header className="border-b border-ink-200 bg-white px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
                Course progress
              </p>
              <h2 id="course-outline-title" className="mt-1 text-xl text-ink-950">
                Course outline
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {completedLessons} of {totalLessons} lessons complete
              </p>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
              aria-label="Close course outline"
              onClick={onClose}
            >
              <X size={19} />
            </button>
          </div>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100"
            role="progressbar"
            aria-label="Course completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionPercent}
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="space-y-4">
            {modules.map((module, moduleIndex) => {
              const moduleCompleted = module.lessons.filter((lesson) =>
                completedLessonIds.includes(lesson.id),
              ).length;
              return (
                <section
                  key={module.id}
                  className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft"
                >
                  <div className="border-b border-ink-100 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-brand-700">
                          Module {moduleIndex + 1}
                        </p>
                        <h3 className="mt-0.5 text-sm font-semibold text-ink-900">
                          {module.title}
                        </h3>
                      </div>
                      <span className="text-xs tabular-nums text-ink-400">
                        {moduleCompleted}/{module.lessons.length}
                      </span>
                    </div>
                  </div>
                  <div className="p-1.5">
                    {module.lessons.map((outlineLesson) => {
                      const completed = completedLessonIds.includes(
                        outlineLesson.id,
                      );
                      const released = releasedLessonIds.includes(
                        outlineLesson.id,
                      );
                      const current = outlineLesson.id === currentLessonId;
                      const content = (
                        <>
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              completed
                                ? "bg-success-50 text-success-700"
                                : current
                                  ? "bg-brand-600 text-white"
                                  : released
                                    ? "bg-brand-50 text-brand-700"
                                    : "bg-ink-100 text-ink-400"
                            }`}
                          >
                            {completed ? (
                              <CheckCircle2 size={16} />
                            ) : released ? (
                              <BookOpen size={15} />
                            ) : (
                              <LockKeyhole size={14} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink-800">
                              {outlineLesson.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-ink-400">
                              {completed
                                ? "Completed"
                                : current
                                  ? "Current lesson"
                                  : released
                                    ? `${outlineLesson.estimated_minutes ?? 0} minutes`
                                    : "Locked"}
                            </span>
                          </span>
                          {released && (
                            <ChevronRight size={16} className="text-ink-300" />
                          )}
                        </>
                      );
                      return released ? (
                        <Link
                          key={outlineLesson.id}
                          to={`/student/courses/${cohortId}/learn/${outlineLesson.id}`}
                          onClick={onClose}
                          aria-current={current ? "page" : undefined}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                            current
                              ? "bg-brand-50"
                              : "hover:bg-ink-50"
                          }`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div
                          key={outlineLesson.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-75"
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        <footer className="border-t border-ink-200 bg-white p-4">
          <Link
            className="btn-secondary w-full"
            to={`/student/courses/${cohortId}/learn`}
            onClick={onClose}
          >
            View curriculum page
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function LessonBlockView({
  block,
  cohortId,
  embedded = false,
  rail = false,
}: {
  block: LessonBlock;
  cohortId: string;
  embedded?: boolean;
  rail?: boolean;
}) {
  const content = block.content as Record<string, string>;
  const mediaUrl = content.resolved_url || safeExternalUrl(content.url);
  if (block.block_type === "heading")
    return <h2 className="pt-2 text-2xl font-semibold text-ink-900">{content.text}</h2>;
  if (block.block_type === "divider")
    return <hr className="border-ink-200" />;
  if (block.block_type === "video")
    return (
      <div className="overflow-hidden rounded-xl bg-ink-950 text-white shadow-soft">
        {content.resolved_url ? (
          <video className="aspect-video w-full bg-black" controls preload="metadata" src={mediaUrl}>
            Your browser does not support embedded video.
          </video>
        ) : (
        <div className="flex items-center gap-3 p-5">
          <PlayCircle size={24} />
          <div>
            <p className="font-medium">Video lesson</p>
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-brand-200 underline underline-offset-4"
            >
              Open video <ExternalLink size={14} />
            </a>
          </div>
        </div>
        )}
      </div>
    );
  if (block.block_type === "image")
    return (
      <figure className="overflow-hidden rounded-xl bg-white shadow-soft">
        <img
          src={mediaUrl}
          alt={content.alt || ""}
          className="h-auto w-full"
        />
        {content.caption && (
          <figcaption className="px-4 py-3 text-sm text-ink-600">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  if (block.block_type === "callout")
    return (
      <aside className={`rounded-xl ${rail ? "bg-[#fff4c2] p-4 text-[#493600]" : "bg-brand-50 p-5 text-brand-950"}`}>
        <h2 className={`${rail ? "text-sm" : ""} font-semibold`}>{content.title || "Key point"}</h2>
        <p className={`mt-2 ${rail ? "text-xs leading-5" : "leading-7"}`}>{content.body}</p>
      </aside>
    );
  if (block.block_type === "quote")
    return (
      <blockquote className="rounded-xl bg-brand-50 px-6 py-5 text-lg leading-8 text-ink-700">
        {content.body}
      </blockquote>
    );
  if (block.block_type === "checklist")
    return (
      <ul className={`space-y-2 rounded-xl p-6 ${embedded ? "bg-ink-50" : "bg-white shadow-soft"}`}>
        {(content.body || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-3 text-ink-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-600" />
              <span>{item.replace(/^[-*]\s*/, "")}</span>
            </li>
          ))}
      </ul>
    );
  if (block.block_type === "list")
    return (
      <ul className={`list-disc space-y-2 rounded-xl p-6 pl-10 text-ink-700 ${embedded ? "bg-ink-50" : "bg-white shadow-soft"}`}>
        {(content.body || "").split("\n").map((item) => item.trim()).filter(Boolean).map((item, index) => (
          <li key={`${item}-${index}`}>{item.replace(/^[-*]\s*/, "")}</li>
        ))}
      </ul>
    );
  if (block.block_type === "table") {
    const rows = (content.body || "").split("\n").map((row) => row.split("|").map((cell) => cell.trim())).filter((row) => row.some(Boolean));
    const [headings = [], ...body] = rows;
    return (
      <div className={`overflow-x-auto rounded-xl ${embedded ? "border border-ink-100 bg-ink-50" : "bg-white shadow-soft"}`}>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-ink-900"><tr>{headings.map((heading, index) => <th key={index} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100">{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-ink-700">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (block.block_type === "resource") {
    const destination = content.resolved_url || safeLinkUrl(content.url);
    return (
      <a href={destination} target="_blank" rel="noreferrer" className={`flex items-center justify-between gap-3 rounded-xl bg-white font-medium text-brand-700 shadow-soft hover:bg-brand-50 ${rail ? "p-4 text-xs" : "p-5"}`}>
        <span>{content.title || content.file_name || "Download resource"}</span><Download size={18} />
      </a>
    );
  }
  if (["assignment_reference", "quiz_reference"].includes(block.block_type)) {
    const destination = `/student/courses/${cohortId}/assignments`;
    const label =
      content.title ||
      (block.block_type === "quiz_reference" ? "Open quiz" : "Open assignment");
    return (
      <Link to={destination} className={`flex items-center justify-between gap-3 rounded-xl bg-white font-medium text-brand-700 shadow-soft hover:bg-brand-50 ${rail ? "p-4 text-xs" : "p-5"}`}>
        <span>{label}</span><ArrowRight size={18} />
      </Link>
    );
  }
  if (block.block_type === "knowledge_check")
    return <KnowledgeCheck title={content.title} question={content.body} answer={content.answer} compact={rail} />;
  if (block.block_type === "external_link")
    return (
      <a
        href={safeExternalUrl(content.url)}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center justify-between gap-3 rounded-xl bg-white font-medium text-brand-700 shadow-soft hover:bg-brand-50 ${rail ? "p-4 text-xs" : "p-5"}`}
      >
        {content.title || "Open supporting link"}
        <ExternalLink size={17} />
      </a>
    );
  if (block.block_type === "prompt")
    return (
      <div className="rounded-xl bg-ink-950 p-5 text-white shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-200 uppercase">
            Practice prompt
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20"
            onClick={() => void navigator.clipboard.writeText(content.body || "")}
          >
            <Copy size={14} /> Copy
          </button>
        </div>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-6 text-ink-100">
          {content.body}
        </pre>
      </div>
    );
  return (
    <div className={embedded ? "" : "rounded-xl bg-white p-6 shadow-soft"}>
      <SafeRichText text={content.text || content.html || content.body || ""} />
    </div>
  );
}

function KnowledgeCheck({ title, question, answer, compact = false }: { title?: string; question?: string; answer?: string; compact?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className={`rounded-xl border border-brand-200 bg-brand-50 text-brand-950 ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-center gap-2"><HelpCircle size={compact ? 17 : 20} /><h2 className={`${compact ? "text-sm" : ""} font-semibold`}>{title || "Check your understanding"}</h2></div>
      <p className={`mt-3 ${compact ? "text-xs leading-5" : "leading-7"}`}>{question}</p>
      <button type="button" className={`${compact ? "mt-3 min-h-10 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100" : "btn-secondary mt-4"}`} aria-expanded={revealed} onClick={() => setRevealed((value) => !value)}>
        {revealed ? "Hide suggested answer" : "Reveal suggested answer"}
      </button>
      {revealed && <div className={`mt-3 rounded-lg bg-white text-ink-700 ${compact ? "p-3 text-xs" : "p-4 text-sm"}`}><SafeRichText text={answer || ""} density="compact" /></div>}
    </section>
  );
}

function safeExternalUrl(value: string | undefined) {
  if (!value) return "#";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? value : "#";
  } catch {
    return "#";
  }
}

function safeLinkUrl(value: string | undefined) {
  if (value?.startsWith("/")) return value;
  return safeExternalUrl(value);
}

function SafeRichText({ text, density = "default" }: { text: string; density?: "default" | "compact" }) {
  return (
    <div className={`${density === "compact" ? "space-y-2 leading-5" : "space-y-4 leading-7"} text-ink-700`}>
      {text
        .split(/\n\s*\n/)
        .map((section) => section.trim())
        .filter(Boolean)
        .map((section, index) => {
          if (section.startsWith("## "))
            return (
              <h3 key={index} className="text-xl font-semibold text-ink-900">
                {section.slice(3)}
              </h3>
            );
          if (section.startsWith("# "))
            return (
              <h2 key={index} className="text-2xl font-semibold text-ink-900">
                {section.slice(2)}
              </h2>
            );
          const lines = section.split("\n").map((line) => line.trim());
          if (lines.every((line) => /^[-*]\s+/.test(line)))
            return (
              <ul key={index} className="list-disc space-y-1 pl-6">
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex}>{line.replace(/^[-*]\s+/, "")}</li>
                ))}
              </ul>
            );
          if (lines.every((line) => /^\d+\.\s+/.test(line)))
            return (
              <ol key={index} className="list-decimal space-y-1 pl-6">
                {lines.map((line, lineIndex) => (
                  <li key={lineIndex}>{line.replace(/^\d+\.\s+/, "")}</li>
                ))}
              </ol>
            );
          return (
            <p key={index} className="whitespace-pre-wrap">
              {section}
            </p>
          );
        })}
    </div>
  );
}
