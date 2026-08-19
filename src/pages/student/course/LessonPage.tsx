import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
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
  useEffect(() => {
    if (!cohortId || !lessonId || !user) return;
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
  return (
    <CourseLayout>
      {loading ? (
        <div className="rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : !lesson ? (
        <Alert>{error || "Lesson not found."}</Alert>
      ) : (
        <article className="mx-auto max-w-3xl">
          <div
            className="sticky top-0 z-20 -mx-4 mb-5 h-1 overflow-hidden bg-ink-100 sm:mx-0 sm:rounded-full"
            aria-label="Lesson reading progress"
          >
            <div className="lesson-reading-progress h-full bg-brand-600" />
          </div>
          <button
            className="btn-ghost -ml-2 mb-4"
            onClick={() => navigate(`/student/courses/${cohortId}/learn`)}
          >
            <ArrowLeft size={16} />
            Curriculum
          </button>
          {error && <Alert>{error}</Alert>}
          <header className="mb-8">
            <p className="text-sm font-medium text-brand-700">
              {lesson.module.title}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink-950">
              {lesson.title}
            </h1>
            {lesson.description && (
              <p className="mt-3 text-base leading-7 text-ink-600">
                {lesson.description}
              </p>
            )}
          </header>
          <div className="space-y-6">
            {lesson.lesson_blocks
              .sort((a, b) => a.display_order - b.display_order)
              .map((block) => (
                <LessonBlockView key={block.id} block={block} cohortId={cohortId || ""} />
              ))}
            {lesson.lesson_blocks.length === 0 && (
              <div className="rounded-xl bg-white p-8 text-center text-sm text-ink-500 shadow-soft">
                This lesson has no content blocks yet.
              </div>
            )}
          </div>
          <footer className="sticky bottom-0 z-20 -mx-4 mt-10 border-t border-ink-200 bg-canvas/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex sm:items-center sm:justify-between sm:px-0">
            <div className="flex items-center gap-2">
              {previousLesson ? (
                <Link className="btn-secondary" to={`/student/courses/${cohortId}/learn/${previousLesson.id}`}>
                  <ArrowLeft size={16} /> Previous
                </Link>
              ) : (
                <Link className="btn-secondary" to={`/student/courses/${cohortId}/learn`}>
                  <ArrowLeft size={16} /> Curriculum
                </Link>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end gap-3 sm:mt-0">
            {complete ? (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-success-700">
                <CheckCircle2 size={18} />
                Lesson completed
              </span>
            ) : (
              <button
                type="button"
                disabled={saving}
                className="btn-primary !bg-success-600 hover:!bg-success-700"
                onClick={() => void markComplete()}
              >
                {saving ? "Saving…" : "Mark complete"}
              </button>
            )}
              {nextLesson && (
                <Link className="btn-primary" to={`/student/courses/${cohortId}/learn/${nextLesson.id}`}>
                  Next <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </footer>
        </article>
      )}
    </CourseLayout>
  );
}

function LessonBlockView({ block, cohortId }: { block: LessonBlock; cohortId: string }) {
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
      <aside className="rounded-xl bg-brand-50 p-5 text-brand-950">
        <h2 className="font-semibold">{content.title || "Key point"}</h2>
        <p className="mt-2 leading-7">{content.body}</p>
      </aside>
    );
  if (block.block_type === "quote")
    return (
      <blockquote className="border-l-4 border-brand-500 bg-white px-6 py-5 text-lg leading-8 text-ink-700 shadow-soft">
        {content.body}
      </blockquote>
    );
  if (block.block_type === "checklist")
    return (
      <ul className="space-y-2 rounded-xl bg-white p-6 shadow-soft">
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
      <ul className="list-disc space-y-2 rounded-xl bg-white p-6 pl-10 text-ink-700 shadow-soft">
        {(content.body || "").split("\n").map((item) => item.trim()).filter(Boolean).map((item, index) => (
          <li key={`${item}-${index}`}>{item.replace(/^[-*]\s*/, "")}</li>
        ))}
      </ul>
    );
  if (block.block_type === "table") {
    const rows = (content.body || "").split("\n").map((row) => row.split("|").map((cell) => cell.trim())).filter((row) => row.some(Boolean));
    const [headings = [], ...body] = rows;
    return (
      <div className="overflow-x-auto rounded-xl bg-white shadow-soft">
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
      <a href={destination} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl bg-white p-5 font-medium text-brand-700 shadow-soft hover:bg-brand-50">
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
      <Link to={destination} className="flex items-center justify-between gap-3 rounded-xl bg-white p-5 font-medium text-brand-700 shadow-soft hover:bg-brand-50">
        <span>{label}</span><ArrowRight size={18} />
      </Link>
    );
  }
  if (block.block_type === "knowledge_check")
    return <KnowledgeCheck title={content.title} question={content.body} answer={content.answer} />;
  if (block.block_type === "external_link")
    return (
      <a
        href={safeExternalUrl(content.url)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-xl bg-white p-5 font-medium text-brand-700 shadow-soft hover:bg-brand-50"
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
    <div className="rounded-xl bg-white p-6 shadow-soft">
      <SafeRichText text={content.text || content.html || content.body || ""} />
    </div>
  );
}

function KnowledgeCheck({ title, question, answer }: { title?: string; question?: string; answer?: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-brand-950">
      <div className="flex items-center gap-2"><HelpCircle size={20} /><h2 className="font-semibold">{title || "Check your understanding"}</h2></div>
      <p className="mt-3 leading-7">{question}</p>
      <button type="button" className="btn-secondary mt-4" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)}>
        {revealed ? "Hide suggested answer" : "Reveal suggested answer"}
      </button>
      {revealed && <div className="mt-4 rounded-lg bg-white p-4 leading-7 text-ink-700"><SafeRichText text={answer || ""} /></div>}
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

function SafeRichText({ text }: { text: string }) {
  return (
    <div className="space-y-4 leading-7 text-ink-700">
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
