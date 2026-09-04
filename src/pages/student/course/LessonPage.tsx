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
  NotebookPen,
  PanelRight,
  PlayCircle,
  Trash2,
  X,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { StoryboardScreen, type StoryboardContent } from "./StoryboardScreen";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/format";
import type { Lesson, LessonBlock } from "@/types";

type LessonRow = Lesson & {
  lesson_blocks: LessonBlock[];
  module: {
    id: string;
    title: string;
    course_id: string;
    display_order: number;
    metadata: Record<string, unknown>;
  };
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
type AssessmentGate = {
  id: string;
  module_id: string | null;
  passing_score: number | null;
  assessment_attempts: Array<{ status: string; percentage: number | null }>;
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
  const [previousLesson, setPreviousLesson] = useState<LessonNavigation | null>(
    null,
  );
  const [nextLesson, setNextLesson] = useState<LessonNavigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeNugget, setActiveNugget] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineLessons, setOutlineLessons] = useState<OutlineLesson[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [releasedLessonIds, setReleasedLessonIds] = useState<string[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [noteBackendAvailable, setNoteBackendAvailable] = useState(true);
  const [noteStatus, setNoteStatus] = useState("Saved");
  const [moduleCheckId, setModuleCheckId] = useState("");
  useEffect(() => {
    if (!cohortId || !lessonId || !user) return;
    setError("");
    setActiveNugget(0);
    setOutlineOpen(false);
    void (async () => {
      const [lessonResult, enrolmentResult] = await Promise.all([
        supabase
          .from("lessons")
          .select(
            "*,module:modules(id,title,course_id,display_order,metadata),lesson_blocks(*)",
          )
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
        const [
          navigationResult,
          courseProgressResult,
          releaseResult,
          assessmentGateResult,
        ] = await Promise.all([
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
          supabase
            .from("assessments")
            .select(
              "id,module_id,passing_score,assessment_attempts(status,percentage)",
            )
            .eq("cohort_id", cohortId)
            .eq("assessment_type", "practice")
            .eq("assessment_attempts.student_id", user.id),
        ]);
        if (!navigationResult.error && navigationResult.data) {
          const ordered = [...navigationResult.data].sort((left, right) => {
            const leftModule = left.module as unknown as {
              display_order: number;
            };
            const rightModule = right.module as unknown as {
              display_order: number;
            };
            return (
              leftModule.display_order - rightModule.display_order ||
              left.display_order - right.display_order
            );
          }) as unknown as OutlineLesson[];
          const databaseReleased = releaseResult.error
            ? ordered.map((item) => item.id)
            : ((releaseResult.data ?? []) as string[]);
          const completedIds = new Set(
            (courseProgressResult.data ?? [])
              .filter((record) => record.status === "completed")
              .map((record) => record.lesson_id),
          );
          const passedModuleIds = new Set(
            ((assessmentGateResult.data ?? []) as unknown as AssessmentGate[])
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
          const currentCheck = ((assessmentGateResult.data ?? []) as unknown as AssessmentGate[])
            .find((assessment) => assessment.module_id === lessonRow.module.id);
          setModuleCheckId(currentCheck?.id ?? "");
          const modulesByOrder = new Map<number, string>();
          for (const item of ordered)
            modulesByOrder.set(item.module.display_order, item.module.id);
          const introductionLesson = ordered.find(
            (item) => item.module.display_order === 0,
          );
          const pathwayReleased = ordered
            .filter((item) => {
              const order = item.module.display_order;
              if (order === 0) return true;
              if (order === 1)
                return Boolean(
                  introductionLesson && completedIds.has(introductionLesson.id),
                );
              const previousModuleId = modulesByOrder.get(order - 1);
              return Boolean(
                previousModuleId && passedModuleIds.has(previousModuleId),
              );
            })
            .map((item) => item.id);
          const released = databaseReleased.filter((id) =>
            pathwayReleased.includes(id),
          );
          if (!released.includes(lessonId)) {
            setLesson(null);
            setError(
              "This module is locked. Complete the previous learning module and its module check first.",
            );
          } else if (!progress) {
            const { error: startError } = await supabase
              .from("progress_records")
              .upsert(
                {
                  enrolment_id: enrolmentResult.data.id,
                  student_id: user.id,
                  lesson_id: lessonId,
                  cohort_id: cohortId,
                  status: "in_progress",
                  progress_percent: 0,
                  last_accessed_at: new Date().toISOString(),
                },
                {
                  onConflict: "enrolment_id,lesson_id",
                  ignoreDuplicates: true,
                },
              );
            if (startError) setError(startError.message);
          }
          const navigable = ordered.filter((item) =>
            released.includes(item.id),
          );
          const currentIndex = navigable.findIndex(
            (item) => item.id === lessonId,
          );
          setOutlineLessons(ordered);
          setReleasedLessonIds(released);
          setCompletedLessonIds([...completedIds]);
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
    if (!outlineOpen && !noteOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOutlineOpen(false);
        setNoteOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [noteOpen, outlineOpen]);

  const noteStorageKey = user && cohortId && lessonId
    ? `synergy-lesson-note:${user.id}:${cohortId}:${lessonId}:${activeNugget}`
    : "";

  const openNotes = async () => {
    if (!user || !cohortId || !lessonId || !noteStorageKey) return;
    setNoteOpen(true);
    setNoteLoaded(false);
    setNoteStatus("Loading...");
    const localDraft = window.localStorage.getItem(noteStorageKey) ?? "";
    if (!noteBackendAvailable) {
      setNoteBody(localDraft);
      setNoteLoaded(true);
      setNoteStatus("Saved on this device");
      return;
    }
    const { data, error: noteError } = await supabase
      .from("lesson_notes")
      .select("body")
      .eq("student_id", user.id)
      .eq("cohort_id", cohortId)
      .eq("lesson_id", lessonId)
      .eq("screen_index", activeNugget)
      .maybeSingle();
    if (noteError) {
      setNoteBackendAvailable(false);
      setNoteBody(localDraft);
      setNoteStatus("Saved on this device");
    } else {
      setNoteBody(data?.body ?? localDraft);
      setNoteStatus("Saved to your account");
    }
    setNoteLoaded(true);
  };

  useEffect(() => {
    if (!noteOpen || !noteLoaded || !noteStorageKey || !user || !cohortId || !lessonId) return;
    window.localStorage.setItem(noteStorageKey, noteBody);
    setNoteStatus("Saving...");
    const timer = window.setTimeout(() => {
      if (!noteBackendAvailable) {
        setNoteStatus("Saved on this device");
        return;
      }
      void supabase
        .from("lesson_notes")
        .upsert(
          {
            student_id: user.id,
            cohort_id: cohortId,
            lesson_id: lessonId,
            screen_index: activeNugget,
            body: noteBody,
          },
          { onConflict: "student_id,cohort_id,lesson_id,screen_index" },
        )
        .then(({ error: saveError }) => {
          if (saveError) {
            setNoteBackendAvailable(false);
            setNoteStatus("Saved on this device");
          } else {
            setNoteStatus("Saved to your account");
          }
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeNugget, cohortId, lessonId, noteBackendAvailable, noteBody, noteLoaded, noteOpen, noteStorageKey, user]);
  const markComplete = async (destination?: string) => {
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
      if (destination) navigate(destination);
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
    const groups = new Map<string, OutlineModule>();
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
  const isIntroduction = lesson?.module.display_order === 0;
  const completionDestination =
    isIntroduction && nextLesson
      ? `/student/courses/${cohortId}/learn/${nextLesson.id}`
      : moduleCheckId
        ? `/student/courses/${cohortId}/learn/check/${moduleCheckId}`
        : `/student/courses/${cohortId}/learn`;
  const completionLabel = isIntroduction
    ? "Complete and go to Module 1"
    : "Complete and start module check";
  const screenProgress = Math.round(
    ((activeNugget + 1) / lessonPartCount) * 100,
  );
  return (
    <CourseLayout>
      {loading ? (
        <div className="rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : !lesson ? (
        <Alert>{error || "Lesson not found."}</Alert>
      ) : (
        <article className="mx-auto max-w-5xl space-y-4 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void openNotes()}
              >
                <NotebookPen size={16} /> Notes
              </button>
            </div>
            {currentLessonIndex >= 0 && (
              <p className="text-xs font-medium text-ink-500">
                Lesson {currentLessonIndex + 1} of {outlineLessons.length}
              </p>
            )}
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="grid h-[calc(100dvh-13.5rem)] min-h-[30rem] max-h-[42rem] overflow-hidden rounded-2xl bg-white shadow-elevated lg:grid-cols-[15rem_minmax(0,1fr)]">
            <CourseModuleRail
              modules={outlineModules}
              currentLessonId={lessonId || ""}
              cohortId={cohortId || ""}
              completedLessonIds={completedLessonIds}
              releasedLessonIds={releasedLessonIds}
            />
            <div className="flex min-h-0 min-w-0 flex-col">
              <header className="border-b border-ink-200 bg-white px-5 py-3 sm:px-6">
                <p className="text-xs font-semibold text-brand-700">
                  {lesson.module.title}
                </p>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-[-0.025em] text-ink-950 sm:text-2xl">
                      {lesson.title}
                    </h1>
                    {lesson.description && (
                      <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-ink-500">
                        {lesson.description}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                    {screenProgress}%
                  </p>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100"
                  role="progressbar"
                  aria-label="Module screen progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={screenProgress}
                >
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
                    style={{ width: `${screenProgress}%` }}
                  />
                </div>
              </header>

              <section
                className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
                aria-label="Lesson content"
              >
                {lessonWorkspace.nuggets.length > 0 ? (
                  <>
                    <LessonPartContent
                      blocks={activeBlocks}
                      cohortId={cohortId || ""}
                    />
                    {lessonWorkspace.railBlocks.length > 0 && (
                      <div className="mt-7 border-t border-ink-100 pt-6">
                        <div className="mb-3 flex items-center gap-2">
                          <PanelRight size={17} className="text-brand-600" />
                          <h2 className="text-sm font-semibold text-ink-900">
                            Activities and key points
                          </h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {lessonWorkspace.railBlocks.map((block) => (
                            <LessonBlockView
                              key={block.id}
                              block={block}
                              cohortId={cohortId || ""}
                              rail
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-sm text-ink-500">
                    This lesson has no main content yet.
                  </div>
                )}
              </section>

              <footer className="border-t border-ink-200 bg-ink-50/90 px-4 py-3 sm:px-5">
                <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
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
                    <p className="text-xs font-semibold text-ink-700">
                      Screen {activeNugget + 1} of {lessonPartCount}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-brand-700">
                      {screenProgress}% complete
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
                        onClick={() => void markComplete(completionDestination)}
                      >
                        {saving ? "Saving..." : completionLabel}
                        {!saving && <ArrowRight size={16} />}
                      </button>
                    ) : (
                      <Link
                        className="btn-primary w-full sm:w-auto"
                        to={completionDestination}
                      >
                        {isIntroduction ? "Go to Module 1" : "Go to module check"}{" "}
                        <ArrowRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </footer>
            </div>
          </div>
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
          {noteOpen && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-navy/45 backdrop-blur-sm"
                aria-label="Close notes"
                onClick={() => setNoteOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="lesson-notes-title"
                className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-elevated"
              >
                <header className="border-b border-brand-100 bg-[linear-gradient(120deg,rgba(232,243,252,0.95),rgba(255,255,255,0.98))] px-6 py-5">
                  <button
                    type="button"
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-white"
                    aria-label="Close notes"
                    onClick={() => setNoteOpen(false)}
                  >
                    <X size={18} />
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
                      <NotebookPen size={19} />
                    </span>
                    <div className="min-w-0 pr-10">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
                        {lesson.module.title} · Screen {activeNugget + 1}
                      </p>
                      <h2 id="lesson-notes-title" className="truncate text-xl font-semibold text-ink-950">
                        Study notes
                      </h2>
                    </div>
                  </div>
                </header>
                <div className="min-h-0 flex-1 p-6">
                  <label htmlFor="lesson-note" className="sr-only">
                    Notes for this learning screen
                  </label>
                  <textarea
                    id="lesson-note"
                    autoFocus
                    maxLength={20000}
                    className="input min-h-[18rem] resize-none text-base leading-7"
                    placeholder="Write key ideas, examples, questions, or reminders from this screen..."
                    value={noteBody}
                    disabled={!noteLoaded}
                    onChange={(event) => setNoteBody(event.target.value)}
                  />
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50 px-6 py-4">
                  <p className="text-xs font-medium text-ink-500">{noteStatus}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-danger-600"
                      disabled={!noteBody}
                      onClick={() => setNoteBody("")}
                    >
                      <Trash2 size={15} /> Clear note
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setNoteOpen(false)}>
                      Done
                    </button>
                  </div>
                </footer>
              </section>
            </div>
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

function CourseModuleRail({
  modules,
  currentLessonId,
  cohortId,
  completedLessonIds,
  releasedLessonIds,
}: {
  modules: OutlineModule[];
  currentLessonId: string;
  cohortId: string;
  completedLessonIds: string[];
  releasedLessonIds: string[];
}) {
  const lessons = modules.flatMap((module) => module.lessons);
  const completedCount = lessons.filter((lesson) =>
    completedLessonIds.includes(lesson.id),
  ).length;
  const courseProgress = lessons.length
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;
  return (
    <aside
      className="hidden min-h-0 flex-col border-r border-ink-200 bg-ink-50 text-ink-900 lg:flex"
      aria-label="Course modules"
    >
      <div className="border-b border-ink-200 px-5 py-5">
        <p className="text-sm font-semibold">Course progress</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-200">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${courseProgress}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-brand-700">
            {courseProgress}%
          </span>
        </div>
      </div>
      <nav
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3"
        aria-label="Learning modules"
      >
        {modules.map((module) => {
          const moduleLesson = module.lessons[0];
          if (!moduleLesson) return null;
          const released = releasedLessonIds.includes(moduleLesson.id);
          const completed = completedLessonIds.includes(moduleLesson.id);
          const current = moduleLesson.id === currentLessonId;
          const label =
            module.display_order === 0
              ? "Introduction"
              : `Module ${module.display_order}`;
          const content = (
            <>
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${completed ? "bg-success-600 text-white" : current ? "bg-brand-600 text-white" : "border border-ink-200 bg-white text-ink-500"}`}
              >
                {completed ? (
                  <CheckCircle2 size={15} />
                ) : released ? (
                  module.display_order || "I"
                ) : (
                  <LockKeyhole size={13} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-900">
                  {label}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-ink-500">
                  {module.title.replace(/^Module \d+: /, "")}
                </span>
              </span>
            </>
          );
          return released ? (
            <Link
              key={module.id}
              to={`/student/courses/${cohortId}/learn/${moduleLesson.id}`}
              className={`mb-1 flex min-h-14 gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${current ? "bg-white shadow-[0_1px_3px_rgba(19,56,92,0.10)]" : "hover:bg-white/80"}`}
            >
              {content}
            </Link>
          ) : (
            <div
              key={module.id}
              className="mb-1 flex min-h-14 cursor-not-allowed gap-3 rounded-lg px-3 py-2.5 opacity-55"
            >
              {content}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-ink-200 px-5 py-4 text-xs leading-5 text-ink-500">
        Complete each module check to unlock the next module.
      </div>
    </aside>
  );
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
              <h2
                id="course-outline-title"
                className="mt-1 text-xl text-ink-950"
              >
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
                            current ? "bg-brand-50" : "hover:bg-ink-50"
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
  if (block.block_type === "storyboard_screen") {
    return <StoryboardScreen content={block.content as StoryboardContent} />;
  }
  const content = block.content as Record<string, string>;
  const mediaUrl = content.resolved_url || safeExternalUrl(content.url);
  if (block.block_type === "heading")
    return (
      <h2 className="pt-2 text-2xl font-semibold text-ink-900">
        {content.text}
      </h2>
    );
  if (block.block_type === "divider") return <hr className="border-ink-200" />;
  if (block.block_type === "video")
    return (
      <div className="overflow-hidden rounded-xl bg-ink-950 text-white shadow-soft">
        {content.resolved_url ? (
          <video
            className="aspect-video w-full bg-black"
            controls
            preload="metadata"
            src={mediaUrl}
          >
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
        <img src={mediaUrl} alt={content.alt || ""} className="h-auto w-full" />
        {content.caption && (
          <figcaption className="px-4 py-3 text-sm text-ink-600">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  if (block.block_type === "callout")
    return (
      <aside
        className={`rounded-xl border border-brand-200 bg-brand-50 text-brand-950 ${rail ? "p-4" : "p-5"}`}
      >
        <h2 className={`${rail ? "text-sm" : ""} font-semibold`}>
          {content.title || "Key point"}
        </h2>
        <p className={`mt-2 ${rail ? "text-xs leading-5" : "leading-7"}`}>
          {content.body}
        </p>
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
      <ul
        className={`space-y-2 rounded-xl p-6 ${embedded ? "bg-ink-50" : "bg-white shadow-soft"}`}
      >
        {(content.body || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-3 text-ink-700">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-brand-600"
              />
              <span>{item.replace(/^[-*]\s*/, "")}</span>
            </li>
          ))}
      </ul>
    );
  if (block.block_type === "list")
    return (
      <ul
        className={`list-disc space-y-2 rounded-xl p-6 pl-10 text-ink-700 ${embedded ? "bg-ink-50" : "bg-white shadow-soft"}`}
      >
        {(content.body || "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item, index) => (
            <li key={`${item}-${index}`}>{item.replace(/^[-*]\s*/, "")}</li>
          ))}
      </ul>
    );
  if (block.block_type === "table") {
    const rows = (content.body || "")
      .split("\n")
      .map((row) => row.split("|").map((cell) => cell.trim()))
      .filter((row) => row.some(Boolean));
    const [headings = [], ...body] = rows;
    return (
      <div
        className={`overflow-x-auto rounded-xl ${embedded ? "border border-ink-100 bg-ink-50" : "bg-white shadow-soft"}`}
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-ink-900">
            <tr>
              {headings.map((heading, index) => (
                <th key={index} className="px-4 py-3 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-ink-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.block_type === "resource") {
    const destination = content.resolved_url || safeLinkUrl(content.url);
    return (
      <a
        href={destination}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center justify-between gap-3 rounded-xl bg-white font-medium text-brand-700 shadow-soft hover:bg-brand-50 ${rail ? "p-4 text-xs" : "p-5"}`}
      >
        <span>{content.title || content.file_name || "Download resource"}</span>
        <Download size={18} />
      </a>
    );
  }
  if (["assignment_reference", "quiz_reference"].includes(block.block_type)) {
    const destination = `/student/courses/${cohortId}/assignments`;
    const label =
      content.title ||
      (block.block_type === "quiz_reference" ? "Open quiz" : "Open assignment");
    return (
      <Link
        to={destination}
        className={`flex items-center justify-between gap-3 rounded-xl bg-white font-medium text-brand-700 shadow-soft hover:bg-brand-50 ${rail ? "p-4 text-xs" : "p-5"}`}
      >
        <span>{label}</span>
        <ArrowRight size={18} />
      </Link>
    );
  }
  if (block.block_type === "knowledge_check")
    return (
      <KnowledgeCheck
        title={content.title}
        question={content.body}
        answer={content.answer}
        compact={rail}
      />
    );
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
            onClick={() =>
              void navigator.clipboard.writeText(content.body || "")
            }
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

function KnowledgeCheck({
  title,
  question,
  answer,
  compact = false,
}: {
  title?: string;
  question?: string;
  answer?: string;
  compact?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section
      className={`rounded-xl border border-brand-200 bg-brand-50/70 text-brand-950 ${compact ? "p-4" : "p-6"}`}
    >
      <div className="flex items-center gap-2">
        <HelpCircle size={compact ? 17 : 20} />
        <h2 className={`${compact ? "text-sm" : ""} font-semibold`}>
          {title || "Check your understanding"}
        </h2>
      </div>
      <p className={`mt-3 ${compact ? "text-xs leading-5" : "leading-7"}`}>
        {question}
      </p>
      <button
        type="button"
        className={`${compact ? "mt-3 min-h-10 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100" : "btn-secondary mt-4"}`}
        aria-expanded={revealed}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? "Hide suggested answer" : "Reveal suggested answer"}
      </button>
      {revealed && (
        <div
          className={`mt-3 rounded-lg bg-white text-ink-700 ${compact ? "p-3 text-xs" : "p-4 text-sm"}`}
        >
          <SafeRichText text={answer || ""} density="compact" />
        </div>
      )}
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

function SafeRichText({
  text,
  density = "default",
}: {
  text: string;
  density?: "default" | "compact";
}) {
  return (
    <div
      className={`${density === "compact" ? "space-y-2 leading-5" : "space-y-4 leading-7"} text-ink-700`}
    >
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
