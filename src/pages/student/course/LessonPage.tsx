import { Modal } from '@/components/ui/Modal';
import { buildLearningPath } from '@/lib/learningPath';
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  ListTree,
  PanelRight,
  PlayCircle,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { StudyNotes } from "./StudyNotes";
import { useLearningPath } from "@/hooks/useLearningPath";
import { PathNavigation } from "./PathNavigation";
import { LearningFlow } from "./LearningFlow";
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
type AssessmentGate = {
  id: string;
  title: string;
  module_id: string | null;
  passing_score: number | null;
  assessment_attempts: Array<{ status: string; percentage: number | null }>;
};
type ActivityGate = {
  id: string;
  title: string;
  module_id: string | null;
  submissions: Array<{ status: string }>;
};
export function LessonPage() {
  const { cohortId, lessonId } = useParams<{
    cohortId: string;
    lessonId: string;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const path=useLearningPath(cohortId);
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
  const [, setCompletedLessonIds] = useState<string[]>([]);
  const [, setReleasedLessonIds] = useState<string[]>([]);
  const [moduleCheckId, setModuleCheckId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [, setModuleChecks] = useState<AssessmentGate[]>([]);
  const [, setModuleActivities] = useState<ActivityGate[]>([]);
  useEffect(() => {
    if (!cohortId || !lessonId || !user) return;
    setError("");
    setLoading(true);
    setActiveNugget(Number(localStorage.getItem(`academy-position:${user.id}:${cohortId}:${lessonId}`) ?? 0));
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
          activityResult,
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
              "id,title,module_id,passing_score,assessment_attempts(status,percentage)",
            )
            .eq("cohort_id", cohortId)
            .eq("assessment_type", "practice")
            .eq("assessment_attempts.student_id", user.id),
          supabase
            .from("assignments")
            .select("id,title,module_id,submissions(status)")
            .eq("cohort_id", cohortId)
            .eq("assignment_type", "activity")
            .eq("is_published", true)
            .eq("submissions.student_id", user.id),
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
            ? []
            : ((releaseResult.data ?? []) as string[]);
          const completedIds = new Set(
            (courseProgressResult.data ?? [])
              .filter((record) => record.status === "completed")
              .map((record) => record.lesson_id),
          );
          const checks = (assessmentGateResult.data ?? []) as unknown as AssessmentGate[];
          setModuleChecks(checks);
          const currentCheck = checks
            .find((assessment) => assessment.module_id === lessonRow.module.id);
          setModuleCheckId(currentCheck?.id ?? "");
          const activities = (activityResult.data ?? []) as unknown as ActivityGate[];
          setModuleActivities(activities);
          setActivityId(activities.find((activity) => activity.module_id === lessonRow.module.id)?.id ?? "");
          const groups=Array.from(new Map(ordered.map(l=>[l.module.id,{id:l.module.id,title:l.module.title,display_order:l.module.display_order,lessons:ordered.filter(x=>x.module.id===l.module.id)}])).values());
          const localPath=buildLearningPath(cohortId,groups,activities,checks,completedIds,new Set(databaseReleased));
          const released=localPath.filter(s=>s.kind==='learn'&&s.available).map(s=>s.id);
          if (!released.includes(lessonId)) {
            setLesson(null);
            setError(
              "This module is locked. Complete the previous available learning steps first.",
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
      await path.refresh();
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
  useEffect(()=>{if(user&&cohortId&&lessonId&&lesson?.id===lessonId&&!loading)localStorage.setItem(`academy-position:${user.id}:${cohortId}:${lessonId}`,String(activeNugget));},[activeNugget,user,cohortId,lessonId,lesson?.id,loading]);
  useEffect(()=>{if(!loading)setActiveNugget(n=>Number.isFinite(n)?Math.max(0,Math.min(n,Math.max(0,lessonWorkspace.nuggets.length-1))):0);},[loading,lessonWorkspace.nuggets.length]);
  const activeBlocks = lessonWorkspace.nuggets[activeNugget] ?? [];
  const isLastNugget =
    activeNugget === Math.max(0, lessonWorkspace.nuggets.length - 1);
  const lessonPartCount = Math.max(1, lessonWorkspace.nuggets.length);
  const currentLessonIndex = outlineLessons.findIndex(
    (item) => item.id === lessonId,
  );
  const completedCourseStepCount=path.completed, totalCourseSteps=path.total;
  const isIntroduction = lesson?.module.display_order === 0;
  const completionDestination =
    path.steps.find(s=>s.id===lessonId) && path.steps[path.steps.findIndex(s=>s.id===lessonId)+1]
      ? path.steps[path.steps.findIndex(s=>s.id===lessonId)+1].href
      : isIntroduction && nextLesson
      ? `/student/courses/${cohortId}/learn/${nextLesson.id}`
      : activityId
        ? `/student/courses/${cohortId}/learn/activity/${activityId}`
      : moduleCheckId
        ? `/student/courses/${cohortId}/learn/check/${moduleCheckId}`
        : `/student/courses/${cohortId}/learn`;
  const completionLabel = isIntroduction
    ? "Complete and go to Module 1"
    : activityId
      ? "Complete and start activity"
      : moduleCheckId
        ? "Complete and start module check"
        : "Complete module";
  const completionLinkLabel = isIntroduction
    ? "Go to Module 1"
    : activityId
      ? "Go to activity"
      : moduleCheckId
        ? "Go to module check"
        : "Return to learning path";
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
                className="btn-secondary hidden lg:inline-flex"
                onClick={() => setOutlineOpen(true)}
              >
                <ListTree size={16} />
                Course outline
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs tabular-nums text-brand-700">
                  {completedCourseStepCount}/{totalCourseSteps}
                </span>
              </button>
              <StudyNotes cohortId={cohortId ?? ""} lessonId={lessonId ?? ""} screen={activeNugget}/>
            </div>
            {currentLessonIndex >= 0 && (
              <div className="text-right">
                <p className="text-xs font-medium text-ink-500">Lesson {currentLessonIndex + 1} of {outlineLessons.length}</p>
              </div>
            )}
          </div>
          {!isIntroduction && <LearningFlow active="learn" hasActivity={Boolean(activityId)} hasAssessment={Boolean(moduleCheckId)} />}
          {error && <Alert>{error}</Alert>}
          <div className="learning-player grid overflow-hidden rounded-2xl bg-white shadow-elevated lg:grid-cols-[15rem_minmax(0,1fr)]">
            <PathNavigation cohortId={cohortId ?? ""} />
            <div className="flex min-h-0 min-w-0 flex-col">
              <header className="border-b border-ink-200 bg-white px-5 py-2 sm:px-6">
                <p className="text-xs font-semibold text-brand-700">
                  {lesson.module.title.split(":")[0]}
                </p>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold tracking-[-0.025em] text-ink-950 sm:text-xl">
                      {lesson.module.title.replace(/^Module \d+: /, "")}
                    </h1>
                    {lesson.description && (
                      <p className="mt-0.5 line-clamp-1 max-w-3xl text-xs leading-5 text-ink-500 sm:text-sm">
                        {lesson.description}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                    {screenProgress}%
                  </p>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100"
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
                        {completionLinkLabel}{" "}
                        <ArrowRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </footer>
            </div>
          </div>
          {outlineOpen && (
            <Modal title="Course outline" onClose={()=>setOutlineOpen(false)}><PathNavigation cohortId={cohortId??""} contentOnly onNavigate={()=>setOutlineOpen(false)}/></Modal>
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
