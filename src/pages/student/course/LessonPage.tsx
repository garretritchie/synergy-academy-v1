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
  PanelRight,
  PlayCircle,
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
  useEffect(() => {
    if (!cohortId || !lessonId || !user) return;
    setActiveNugget(0);
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
        const { data: availableLessons, error: navigationError } = await supabase
          .from("lessons")
          .select("id,title,display_order,module:modules!inner(course_id,display_order)")
          .eq("module.course_id", lessonRow.module.course_id)
          .eq("is_published", true);
        if (!navigationError && availableLessons) {
          const ordered = [...availableLessons].sort((left, right) => {
            const leftModule = left.module as unknown as { display_order: number };
            const rightModule = right.module as unknown as { display_order: number };
            return (
              leftModule.display_order - rightModule.display_order ||
              left.display_order - right.display_order
            );
          });
          const currentIndex = ordered.findIndex((item) => item.id === lessonId);
          setPreviousLesson(currentIndex > 0 ? ordered[currentIndex - 1] : null);
          setNextLesson(
            currentIndex >= 0 && currentIndex < ordered.length - 1
              ? ordered[currentIndex + 1]
              : null,
          );
        }
      }
      setLoading(false);
    })();
  }, [cohortId, lessonId, user]);
  const markComplete = async () => {
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
  return (
    <CourseLayout>
      {loading ? (
        <div className="rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : !lesson ? (
        <Alert>{error || "Lesson not found."}</Alert>
      ) : (
        <article className="mx-auto max-w-6xl space-y-5">
          <button
            className="btn-ghost -ml-2"
            onClick={() => navigate(`/student/courses/${cohortId}/learn`)}
          >
            <ArrowLeft size={16} />
            Curriculum
          </button>
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
                    <div className="mx-auto max-w-[72ch] space-y-5">
                      {activeBlocks.map((block) => (
                        <LessonBlockView
                          key={block.id}
                          block={block}
                          cohortId={cohortId || ""}
                          embedded
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className="btn-secondary w-full sm:w-auto"
                      disabled={activeNugget === 0}
                      onClick={() => setActiveNugget((current) => Math.max(0, current - 1))}
                    >
                      <ArrowLeft size={16} /> Previous part
                    </button>
                    {!isLastNugget ? (
                      <button
                        type="button"
                        className="btn-primary w-full sm:w-auto"
                        onClick={() =>
                          setActiveNugget((current) =>
                            Math.min(lessonWorkspace.nuggets.length - 1, current + 1),
                          )
                        }
                      >
                        Next part <ArrowRight size={16} />
                      </button>
                    ) : complete ? (
                      <span className="inline-flex items-center justify-center gap-2 text-sm font-medium text-success-700">
                        <CheckCircle2 size={18} /> Lesson completed
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        className="btn-primary w-full !bg-success-600 hover:!bg-success-700 sm:w-auto"
                        onClick={() => void markComplete()}
                      >
                        {saving ? "Saving..." : "Mark lesson complete"}
                      </button>
                    )}
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
          <footer className="flex flex-col gap-3 rounded-xl bg-[#0a1628] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-center gap-2">
              {previousLesson ? (
                <Link className="btn-secondary w-full sm:w-auto" to={`/student/courses/${cohortId}/learn/${previousLesson.id}`}>
                  <ArrowLeft size={16} /> Previous
                </Link>
              ) : (
                <Link className="btn-secondary w-full sm:w-auto" to={`/student/courses/${cohortId}/learn`}>
                  <ArrowLeft size={16} /> Curriculum
                </Link>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              {nextLesson && (
                <Link className="btn-primary w-full sm:w-auto" to={`/student/courses/${cohortId}/learn/${nextLesson.id}`}>
                  Next lesson <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </footer>
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
  let pendingStructure: LessonBlock[] = [];
  for (const block of ordered) {
    if (RAIL_BLOCK_TYPES.has(block.block_type)) {
      railBlocks.push(block);
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
