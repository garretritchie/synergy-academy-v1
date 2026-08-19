import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/format";
import type { Course, Lesson, LessonBlock, Module } from "@/types";

const UPLOAD_BLOCK_TYPES = ["image", "video", "resource"];
const MAX_ASSET_BYTES = 250 * 1024 * 1024;

type ModuleTree = Module & {
  lessons: Array<Lesson & { lesson_blocks: LessonBlock[] }>;
};
export function AdminAcademic() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [modules, setModules] = useState<ModuleTree[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonModule, setLessonModule] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonMinutes, setLessonMinutes] = useState(20);
  const [blockLesson, setBlockLesson] = useState("");
  const [blockType, setBlockType] = useState("text");
  const [blockContent, setBlockContent] = useState("");
  const [blockTitle, setBlockTitle] = useState("");
  const [blockAnswer, setBlockAnswer] = useState("");
  const [blockAlt, setBlockAlt] = useState("");
  const [blockCaption, setBlockCaption] = useState("");
  const [blockFile, setBlockFile] = useState<File | null>(null);
  const [blockStoredPath, setBlockStoredPath] = useState("");
  const [blockStoredName, setBlockStoredName] = useState("");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const loadCourses = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("courses")
      .select("*")
      .order("title");
    if (queryError) setError(queryError.message);
    else {
      const list = (data ?? []) as Course[];
      setCourses(list);
      setCourseId((current) => current || list[0]?.id || "");
    }
  }, []);
  const loadModules = useCallback(async () => {
    if (!courseId) {
      setModules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("modules")
      .select("*,lessons(*,lesson_blocks(*))")
      .eq("course_id", courseId)
      .order("display_order")
      .order("display_order", { referencedTable: "lessons" });
    if (queryError) setError(queryError.message);
    else setModules((data ?? []) as unknown as ModuleTree[]);
    setLoading(false);
  }, [courseId]);
  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);
  useEffect(() => {
    void loadModules();
  }, [loadModules]);
  const course = useMemo(
    () => courses.find((item) => item.id === courseId),
    [courses, courseId],
  );
  const addModule = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("modules").insert({
      course_id: courseId,
      title: moduleTitle,
      display_order: modules.length + 1,
      is_published: false,
      metadata: {},
    });
    if (insertError) setError(insertError.message);
    else {
      setModuleTitle("");
      await loadModules();
    }
    setSaving(false);
  };
  const addLesson = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const parent = modules.find((module) => module.id === lessonModule);
    const { error: insertError } = await supabase.from("lessons").insert({
      module_id: lessonModule,
      title: lessonTitle,
      estimated_minutes: lessonMinutes,
      display_order: (parent?.lessons.length ?? 0) + 1,
      is_published: false,
      metadata: {},
    });
    if (insertError) setError(insertError.message);
    else {
      setLessonTitle("");
      setLessonModule("");
      await loadModules();
    }
    setSaving(false);
  };
  const addBlock = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    if (
      UPLOAD_BLOCK_TYPES.includes(blockType) &&
      !blockFile &&
      !blockStoredPath
    ) {
      setError("Choose a file to upload for this lesson block.");
      setSaving(false);
      return;
    }
    if (blockFile && blockFile.size > MAX_ASSET_BYTES) {
      setError("Course media must be 250 MB or smaller.");
      setSaving(false);
      return;
    }
    const lesson = modules
      .flatMap((module) => module.lessons)
      .find((item) => item.id === blockLesson);
    const content: Record<string, string | undefined> =
      blockType === "text"
        ? { text: blockContent }
        : UPLOAD_BLOCK_TYPES.includes(blockType)
          ? {
              title: blockTitle || undefined,
              storage_path: blockStoredPath || undefined,
              file_name: blockStoredName || undefined,
              alt: blockType === "image" ? "Course illustration" : undefined,
            }
        : [
              "external_link",
              "assignment_reference",
              "quiz_reference",
            ].includes(blockType)
          ? {
              url: blockContent,
              title: blockTitle || undefined,
              alt: blockType === "image" ? "Course illustration" : undefined,
            }
          : blockType === "knowledge_check"
            ? {
                title: blockTitle || "Check your understanding",
                body: blockContent,
                answer: blockAnswer,
              }
          : blockType === "heading"
            ? { text: blockContent }
            : blockType === "divider"
              ? {}
          : {
              title: blockType === "callout" ? "Key point" : "Resource",
              body: blockContent,
            };
    if (blockType === "image") {
      content.alt = blockAlt;
      content.caption = blockCaption;
    }
    const blockId = editingBlockId || crypto.randomUUID();
    const result = editingBlockId
      ? await supabase
          .from("lesson_blocks")
          .update({ lesson_id: blockLesson, block_type: blockType, content })
          .eq("id", editingBlockId)
      : await supabase.from("lesson_blocks").insert({
          id: blockId,
          lesson_id: blockLesson,
          block_type: blockType,
          content,
          display_order: (lesson?.lesson_blocks.length ?? 0) + 1,
        });
    const insertError = result.error;
    if (insertError) setError(getErrorMessage(insertError));
    else {
      if (blockFile) {
        const safeName = blockFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const storagePath = `${courseId}/lesson-blocks/${blockId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("course-assets")
          .upload(storagePath, blockFile, {
            cacheControl: "3600",
            contentType: blockFile.type || undefined,
          });
        if (uploadError) {
          if (!editingBlockId) {
            await supabase.from("lesson_blocks").delete().eq("id", blockId);
          }
          setError(`The file could not be uploaded. ${getErrorMessage(uploadError)}`);
          setSaving(false);
          return;
        }
        const uploadedContent = {
          ...content,
          storage_path: storagePath,
          file_name: blockFile.name,
          mime_type: blockFile.type,
        };
        const { error: contentError } = await supabase
          .from("lesson_blocks")
          .update({ content: uploadedContent })
          .eq("id", blockId);
        if (contentError) {
          setError("The file uploaded, but the lesson block could not be updated. Please retry.");
          setSaving(false);
          return;
        }
        if (blockStoredPath && blockStoredPath !== storagePath) {
          await supabase.storage.from("course-assets").remove([blockStoredPath]);
        }
      }
      setBlockContent("");
      setBlockTitle("");
      setBlockAnswer("");
      setBlockLesson("");
      setBlockAlt("");
      setBlockCaption("");
      setBlockFile(null);
      setBlockStoredPath("");
      setBlockStoredName("");
      setEditingBlockId(null);
      await loadModules();
    }
    setSaving(false);
  };
  const editBlock = (lessonId: string, block: LessonBlock) => {
    const content = block.content as Record<string, string>;
    setEditingBlockId(block.id);
    setBlockLesson(lessonId);
    setBlockType(block.block_type);
    setBlockContent(
      content.url || content.text || content.html || content.body || "",
    );
    setBlockTitle(content.title || "");
    setBlockAnswer(content.answer || "");
    setBlockAlt(content.alt || "");
    setBlockCaption(content.caption || "");
    setBlockFile(null);
    setBlockStoredPath(content.storage_path || "");
    setBlockStoredName(content.file_name || "");
  };
  const deleteRecord = async (
    table: "modules" | "lessons" | "lesson_blocks",
    id: string,
    label: string,
  ) => {
    if (
      !window.confirm(
        `Delete “${label}”? Related content will also be removed.`,
      )
    )
      return;
    const storagePaths = modules
      .filter((module) => table !== "modules" || module.id === id)
      .flatMap((module) => module.lessons)
      .filter((lesson) => table !== "lessons" || lesson.id === id)
      .flatMap((lesson) => lesson.lesson_blocks)
      .filter((block) => table !== "lesson_blocks" || block.id === id)
      .map((block) => String(block.content.storage_path || ""))
      .filter(Boolean);
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      if (storagePaths.length) {
        await supabase.storage.from("course-assets").remove(storagePaths);
      }
      await loadModules();
    }
  };
  const moveBlock = async (
    blocks: LessonBlock[],
    index: number,
    direction: -1 | 1,
  ) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const current = blocks[index];
    const target = blocks[targetIndex];
    const [currentResult, targetResult] = await Promise.all([
      supabase
        .from("lesson_blocks")
        .update({ display_order: target.display_order })
        .eq("id", current.id),
      supabase
        .from("lesson_blocks")
        .update({ display_order: current.display_order })
        .eq("id", target.id),
    ]);
    const moveError = currentResult.error || targetResult.error;
    if (moveError) setError(moveError.message);
    else await loadModules();
  };
  const moveOrdered = async (
    table: "modules" | "lessons",
    rows: Array<{ id: string; display_order: number }>,
    index: number,
    direction: -1 | 1,
  ) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const current = rows[index];
    const target = rows[targetIndex];
    const [currentResult, targetResult] = await Promise.all([
      supabase
        .from(table)
        .update({ display_order: target.display_order })
        .eq("id", current.id),
      supabase
        .from(table)
        .update({ display_order: current.display_order })
        .eq("id", target.id),
    ]);
    const moveError = currentResult.error || targetResult.error;
    if (moveError) setError(moveError.message);
    else await loadModules();
  };
  const togglePublished = async (
    table: "modules" | "lessons",
    id: string,
    value: boolean,
  ) => {
    const { error: updateError } = await supabase
      .from(table)
      .update({ is_published: !value })
      .eq("id", id);
    if (updateError) setError(updateError.message);
    else await loadModules();
  };
  return (
    <AppLayout>
      <PageHeader
        title="Curriculum builder"
        subtitle="Arrange reusable modules, lessons, and lesson blocks before a cohort begins."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        <section className="rounded-xl bg-white p-5 shadow-soft">
          <Field label="Course">
            <select
              className="input max-w-xl"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              <option value="">Select a course</option>
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </Field>
        </section>
        {courseId && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="overflow-hidden rounded-xl bg-white shadow-soft">
              <div className="border-b border-ink-100 px-5 py-4">
                <h2 className="font-semibold text-ink-900">{course?.title}</h2>
                <p className="mt-0.5 text-sm text-ink-500">
                  Select a row to inspect its lessons.
                </p>
              </div>
              {loading ? (
                <TableSkeleton />
              ) : modules.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500">
                  <BookOpen className="mx-auto mb-2 text-ink-300" />
                  Add the first module to begin the curriculum.
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {modules.map((module, moduleIndex) => {
                    const isOpen = expanded.includes(module.id);
                    return (
                      <div key={module.id}>
                        <div className="flex items-center gap-3 px-5 py-4">
                          <button
                            className="btn-ghost !p-1"
                            aria-label={`${isOpen ? "Collapse" : "Expand"} ${module.title}`}
                            onClick={() =>
                              setExpanded((current) =>
                                isOpen
                                  ? current.filter((id) => id !== module.id)
                                  : [...current, module.id],
                              )
                            }
                          >
                            {isOpen ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink-900">
                              {module.display_order}. {module.title}
                            </p>
                            <p className="text-xs text-ink-500">
                              {module.lessons.length} lessons
                            </p>
                          </div>
                          <button
                            className="btn-ghost !p-1.5"
                            aria-label={`Move ${module.title} up`}
                            disabled={moduleIndex === 0}
                            onClick={() =>
                              void moveOrdered(
                                "modules",
                                modules,
                                moduleIndex,
                                -1,
                              )
                            }
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            className="btn-ghost !p-1.5"
                            aria-label={`Move ${module.title} down`}
                            disabled={moduleIndex === modules.length - 1}
                            onClick={() =>
                              void moveOrdered(
                                "modules",
                                modules,
                                moduleIndex,
                                1,
                              )
                            }
                          >
                            <ChevronDown size={15} />
                          </button>
                          <button
                            onClick={() =>
                              void togglePublished(
                                "modules",
                                module.id,
                                module.is_published,
                              )
                            }
                            className={
                              module.is_published
                                ? "badge-success"
                                : "badge-neutral"
                            }
                          >
                            {module.is_published ? "Published" : "Draft"}
                          </button>
                          <button
                            className="btn-ghost !p-2 text-danger-600"
                            aria-label={`Delete ${module.title}`}
                            onClick={() =>
                              void deleteRecord(
                                "modules",
                                module.id,
                                module.title,
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {isOpen && (
                          <div className="bg-ink-50 px-5 py-2">
                            {module.lessons.length === 0 ? (
                              <p className="py-4 pl-10 text-sm text-ink-500">
                                No lessons in this module.
                              </p>
                            ) : (
                              module.lessons.map((lesson, lessonIndex) => {
                                const blocks = [...lesson.lesson_blocks].sort(
                                  (left, right) =>
                                    left.display_order - right.display_order,
                                );
                                return (
                                  <div
                                    key={lesson.id}
                                    className="border-t border-ink-100 py-3 first:border-0"
                                  >
                                    <div className="flex items-center gap-3">
                                      <FileText
                                        className="ml-10 text-ink-400"
                                        size={17}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-ink-800">
                                          {lesson.display_order}. {lesson.title}
                                        </p>
                                        <p className="text-xs text-ink-500">
                                          {lesson.estimated_minutes ?? 0} min ·{" "}
                                          {blocks.length} blocks
                                        </p>
                                      </div>
                                      <button
                                        className="btn-ghost !p-1.5"
                                        aria-label={`Move ${lesson.title} up`}
                                        disabled={lessonIndex === 0}
                                        onClick={() =>
                                          void moveOrdered(
                                            "lessons",
                                            module.lessons,
                                            lessonIndex,
                                            -1,
                                          )
                                        }
                                      >
                                        <ChevronUp size={14} />
                                      </button>
                                      <button
                                        className="btn-ghost !p-1.5"
                                        aria-label={`Move ${lesson.title} down`}
                                        disabled={
                                          lessonIndex ===
                                          module.lessons.length - 1
                                        }
                                        onClick={() =>
                                          void moveOrdered(
                                            "lessons",
                                            module.lessons,
                                            lessonIndex,
                                            1,
                                          )
                                        }
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          void togglePublished(
                                            "lessons",
                                            lesson.id,
                                            lesson.is_published,
                                          )
                                        }
                                        className={
                                          lesson.is_published
                                            ? "badge-success"
                                            : "badge-neutral"
                                        }
                                      >
                                        {lesson.is_published
                                          ? "Published"
                                          : "Draft"}
                                      </button>
                                      <button
                                        className="btn-ghost !p-2 text-danger-600"
                                        aria-label={`Delete ${lesson.title}`}
                                        onClick={() =>
                                          void deleteRecord(
                                            "lessons",
                                            lesson.id,
                                            lesson.title,
                                          )
                                        }
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                    {blocks.length > 0 && (
                                      <div className="ml-20 mt-3 space-y-2">
                                        {blocks.map((block, blockIndex) => {
                                          const content =
                                            block.content as Record<
                                              string,
                                              string
                                            >;
                                          return (
                                            <div
                                              key={block.id}
                                              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-sm"
                                            >
                                              <span className="badge-neutral capitalize">
                                                {block.block_type}
                                              </span>
                                              <span className="min-w-0 flex-1 truncate text-ink-600">
                                                {content.url ||
                                                  content.text ||
                                                  content.html ||
                                                  content.body ||
                                                  "Empty block"}
                                              </span>
                                              <button
                                                className="btn-ghost !p-1.5"
                                                aria-label="Move block up"
                                                disabled={blockIndex === 0}
                                                onClick={() =>
                                                  void moveBlock(
                                                    blocks,
                                                    blockIndex,
                                                    -1,
                                                  )
                                                }
                                              >
                                                <ChevronUp size={14} />
                                              </button>
                                              <button
                                                className="btn-ghost !p-1.5"
                                                aria-label="Move block down"
                                                disabled={
                                                  blockIndex ===
                                                  blocks.length - 1
                                                }
                                                onClick={() =>
                                                  void moveBlock(
                                                    blocks,
                                                    blockIndex,
                                                    1,
                                                  )
                                                }
                                              >
                                                <ChevronDown size={14} />
                                              </button>
                                              <button
                                                className="btn-ghost !p-1.5"
                                                aria-label="Edit block"
                                                onClick={() =>
                                                  editBlock(lesson.id, block)
                                                }
                                              >
                                                <Pencil size={14} />
                                              </button>
                                              <button
                                                className="btn-ghost !p-1.5 text-danger-600"
                                                aria-label="Delete block"
                                                onClick={() =>
                                                  void deleteRecord(
                                                    "lesson_blocks",
                                                    block.id,
                                                    `${block.block_type} block`,
                                                  )
                                                }
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <aside className="space-y-4">
              <form
                onSubmit={addModule}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <h3 className="font-semibold text-ink-900">Add module</h3>
                <div className="mt-4 space-y-3">
                  <Field label="Title">
                    <input
                      required
                      className="input"
                      value={moduleTitle}
                      onChange={(event) => setModuleTitle(event.target.value)}
                    />
                  </Field>
                  <SubmitButton loading={saving} className="w-full">
                    <Plus size={16} />
                    Add module
                  </SubmitButton>
                </div>
              </form>
              <form
                onSubmit={addLesson}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <h3 className="font-semibold text-ink-900">Add lesson</h3>
                <div className="mt-4 space-y-3">
                  <Field label="Module">
                    <select
                      required
                      className="input"
                      value={lessonModule}
                      onChange={(event) => setLessonModule(event.target.value)}
                    >
                      <option value="">Select module</option>
                      {modules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Title">
                    <input
                      required
                      className="input"
                      value={lessonTitle}
                      onChange={(event) => setLessonTitle(event.target.value)}
                    />
                  </Field>
                  <Field label="Estimated minutes">
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={lessonMinutes}
                      onChange={(event) =>
                        setLessonMinutes(Number(event.target.value))
                      }
                    />
                  </Field>
                  <SubmitButton loading={saving} className="w-full">
                    <Plus size={16} />
                    Add lesson
                  </SubmitButton>
                </div>
              </form>
              <form
                onSubmit={addBlock}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <h3 className="font-semibold text-ink-900">
                  {editingBlockId ? "Edit lesson block" : "Add lesson block"}
                </h3>
                <div className="mt-4 space-y-3">
                  <Field label="Lesson">
                    <select
                      required
                      className="input"
                      value={blockLesson}
                      onChange={(event) => setBlockLesson(event.target.value)}
                    >
                      <option value="">Select lesson</option>
                      {modules.flatMap((module) =>
                        module.lessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            {module.title} - {lesson.title}
                          </option>
                        )),
                      )}
                    </select>
                  </Field>
                  <Field label="Block type">
                    <select
                      className="input"
                      value={blockType}
                      onChange={(event) => {
                        setBlockType(event.target.value);
                        setBlockFile(null);
                        if (!editingBlockId) {
                          setBlockStoredPath("");
                          setBlockStoredName("");
                        }
                      }}
                    >
                      <option value="text">Rich text</option>
                      <option value="heading">Heading</option>
                      <option value="video">Uploaded video</option>
                      <option value="image">Uploaded image</option>
                      <option value="callout">Key point</option>
                      <option value="quote">Quote</option>
                      <option value="checklist">Checklist</option>
                      <option value="list">List</option>
                      <option value="table">Table</option>
                      <option value="resource">Resource / download</option>
                      <option value="external_link">External link</option>
                      <option value="assignment_reference">Assignment reference</option>
                      <option value="quiz_reference">Quiz reference</option>
                      <option value="knowledge_check">Knowledge check</option>
                      <option value="prompt">Prompt with copy button</option>
                      <option value="divider">Divider</option>
                    </select>
                  </Field>
                  {UPLOAD_BLOCK_TYPES.includes(blockType) ? (
                    <Field
                      label={blockType === "image" ? "Image file" : blockType === "video" ? "Video file" : "Resource file"}
                      hint={blockStoredName ? `Current file: ${blockStoredName}. Choose another file to replace it.` : "Upload a private file up to 250 MB."}
                    >
                      <input
                        required={!editingBlockId && !blockStoredPath}
                        type="file"
                        className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
                        accept={blockType === "image" ? "image/*" : blockType === "video" ? "video/mp4,video/webm,video/quicktime" : undefined}
                        onChange={(event) => setBlockFile(event.target.files?.[0] || null)}
                      />
                    </Field>
                  ) : (
                    <Field
                    label={
                      [
                        "external_link",
                        "assignment_reference",
                        "quiz_reference",
                      ].includes(blockType)
                        ? "External link URL"
                        : blockType === "checklist"
                          ? "Items (one per line)"
                          : blockType === "list"
                            ? "Items (one per line)"
                            : blockType === "table"
                              ? "Rows (one per line, columns separated by |)"
                              : blockType === "knowledge_check"
                                ? "Question"
                          : "Content"
                    }
                    hint={
                      blockType === "text"
                        ? "Use blank lines for paragraphs, # for headings, and - or 1. for lists."
                        : undefined
                    }
                  >
                    <textarea
                      required={blockType !== "divider"}
                      disabled={blockType === "divider"}
                      className="input min-h-24"
                      value={blockContent}
                      onChange={(event) => setBlockContent(event.target.value)}
                    />
                    </Field>
                  )}
                  {[
                    "external_link",
                    "video",
                    "resource",
                    "assignment_reference",
                    "quiz_reference",
                    "knowledge_check",
                  ].includes(blockType) && (
                    <Field label={blockType === "knowledge_check" ? "Heading" : "Link label"}>
                      <input
                        className="input"
                        value={blockTitle}
                        onChange={(event) => setBlockTitle(event.target.value)}
                      />
                    </Field>
                  )}
                  {blockType === "knowledge_check" && (
                    <Field label="Suggested answer" hint="Learners reveal this after thinking through the question.">
                      <textarea
                        required
                        className="input min-h-24"
                        value={blockAnswer}
                        onChange={(event) => setBlockAnswer(event.target.value)}
                      />
                    </Field>
                  )}
                  {blockType === "image" && (
                    <>
                      <Field
                        label="Alt text"
                        hint="Describe the image for learners using assistive technology."
                      >
                        <input
                          required
                          className="input"
                          value={blockAlt}
                          onChange={(event) => setBlockAlt(event.target.value)}
                        />
                      </Field>
                      <Field
                        label="Caption"
                        hint="Optional visible context below the image."
                      >
                        <input
                          className="input"
                          value={blockCaption}
                          onChange={(event) =>
                            setBlockCaption(event.target.value)
                          }
                        />
                      </Field>
                    </>
                  )}
                  <SubmitButton loading={saving} className="w-full">
                    {editingBlockId ? <Pencil size={16} /> : <Plus size={16} />}
                    {editingBlockId ? "Save block" : "Add block"}
                  </SubmitButton>
                  {editingBlockId && (
                    <button
                      type="button"
                      className="btn-secondary w-full"
                      onClick={() => {
                        setEditingBlockId(null);
                        setBlockLesson("");
                        setBlockContent("");
                        setBlockTitle("");
                        setBlockAnswer("");
                        setBlockAlt("");
                        setBlockCaption("");
                        setBlockFile(null);
                        setBlockStoredPath("");
                        setBlockStoredName("");
                      }}
                    >
                      Cancel editing
                    </button>
                  )}
                </div>
              </form>
            </aside>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
