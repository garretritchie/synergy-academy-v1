import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert } from "@/components/ui/Feedback";
import { CompanionShell } from "./CompanionShell";
import { useCompanion } from "./useCompanion";
import {
  resourceUrl,
  ResourceList,
  SessionDetails,
  type Session,
} from "./StudentCompanion";
import { youtubeEmbed, type ComponentType } from "./model";
import {
  StoryboardScreen,
  type StoryboardContent,
} from "@/pages/student/course/StoryboardScreen";
import { ComponentActivity } from "./ComponentActivity";
import { ComponentAssessment } from "./ComponentAssessment";
import type { LessonBlock, Resource } from "@/types";
import "./companion.css";

export interface ComponentRecord {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  type: ComponentType;
  lesson_id: string | null;
  resource_id: string | null;
  requires_pass: boolean;
}
export interface Binding {
  id: string;
  assignment_id: string | null;
  assessment_id: string | null;
  live_session_id: string | null;
}
export function ComponentPage() {
  const data = useCompanion();
  const { moduleId, componentId } = useParams();
  const module = data.outline?.modules.find((m) => m.id === moduleId);
  const summary = module?.components.find((c) => c.id === componentId);
  const [record, setRecord] = useState<ComponentRecord | null>(null);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!data.outline || !module?.available || !componentId) return;
    let live = true;
    setLoading(true);
    setError("");
    setRecord(null);
    void (async () => {
      try {
        const [x, b, p] = await Promise.all([
          supabase
            .from("module_components")
            .select("*")
            .eq("id", componentId)
            .eq("module_id", module.id)
            .single(),
          supabase
            .from("component_bindings")
            .select("*")
            .eq("component_id", componentId)
            .eq("cohort_id", data.cohortId),
          supabase
            .from("component_progress")
            .select("position,status")
            .eq("component_id", componentId)
            .eq("enrolment_id", data.outline!.enrolment_id)
            .maybeSingle(),
        ]);
        if (x.error || b.error || p.error) throw x.error ?? b.error ?? p.error;
        if (!live) return;
        const row = x.data as ComponentRecord;
        setRecord(row);
        setBindings(b.data ?? []);
        setPosition(Number(p.data?.position ?? 0));
        setDone(summary?.status === "completed");
        if (row.type === "ebook_recap" && row.lesson_id) {
          const r = await supabase
            .from("lesson_blocks")
            .select("*")
            .eq("lesson_id", row.lesson_id)
            .order("display_order");
          if (r.error) throw r.error;
          if (live) setBlocks(r.data ?? []);
        }
        if (["video", "audio", "resources"].includes(row.type)) {
          const r = await supabase.rpc("get_available_course_resources", {
            cohort_uuid: data.cohortId,
          });
          if (r.error) throw r.error;
          if (live)
            setResources(
              (r.data ?? []).filter((v: Resource) =>
                row.type === "resources"
                  ? v.module_id === module.id
                  : v.id === row.resource_id,
              ),
            );
        }
        if (row.type === "live_session") {
          const ids = (b.data ?? [])
            .map((v) => v.live_session_id)
            .filter(Boolean);
          if (ids.length) {
            const r = await supabase
              .from("live_sessions")
              .select(
                "*,instructor:profiles!live_sessions_instructor_id_fkey(*)",
              )
              .in("id", ids);
            if (r.error) throw r.error;
            if (live) setSessions(r.data as Session[]);
          } else setSessions([]);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [
    componentId,
    data.cohortId,
    data.outline,
    module?.id,
    module?.available,
    summary?.status,
  ]);
  const save = useCallback(
    async (nextPosition: number, complete = false) => {
      if (!componentId) return;
      setSaving(true);
      setError("");
      try {
        const r = await supabase.rpc("companion_save_progress", {
          component_uuid: componentId,
          cohort_uuid: data.cohortId,
          new_position: nextPosition,
          complete,
        });
        if (r.error) throw r.error;
        setPosition(nextPosition);
        if (complete) setDone(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [componentId, data.cohortId],
  );
  const page = Math.min(Math.floor(position), Math.max(0, blocks.length - 1));
  const back = `/student/courses/${data.cohortId}/modules/${moduleId}`;
  const mark = (
    <button
      className="btn-primary"
      disabled={saving || done}
      onClick={() => void save(position, true)}
    >
      {done ? (
        <>
          <CheckCircle2 size={17} />
          Completed
        </>
      ) : (
        "Mark complete"
      )}
    </button>
  );
  return (
    <CompanionShell
      data={data}
      title={summary?.title ?? "Module component"}
      back={back}
      moduleContext={
        module
          ? `${module.title} · ${module.components.filter((c) => c.required && (c.status === "completed" || (c.id === componentId && done))).length} of ${module.components.filter((c) => c.required).length} required items complete`
          : undefined
      }
    >
      {!module?.available || !summary ? (
        <Alert>
          This component is not available. Return to the module overview for
          release information.
        </Alert>
      ) : loading ? (
        <p role="status">Loading component…</p>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          {record?.description && (
            <p className="mb-6 max-w-prose whitespace-pre-wrap leading-7 text-ink-600">
              {record.description}
            </p>
          )}
          {record?.type === "ebook_recap" &&
            (blocks.length ? (
              <>
                <p className="mb-4 text-sm text-ink-500">
                  Page {page + 1} of {blocks.length} · A recap of your eBook
                </p>
                <article className="companion-recap">
                  {blocks[page].block_type === "storyboard_screen" ? (
                    <StoryboardScreen
                      content={
                        {
                          ...blocks[page].content,
                          eyebrow: "",
                        } as StoryboardContent
                      }
                    />
                  ) : (
                    <div>
                      <h2>{String(blocks[page].content.title ?? "")}</h2>
                      <p className="mt-4 whitespace-pre-wrap leading-7">
                        {String(
                          blocks[page].content.text ??
                            blocks[page].content.body ??
                            "",
                        )}
                      </p>
                    </div>
                  )}
                  {Boolean(blocks[page].content.eyebrow) && (
                    <p className="mt-6 text-sm text-ink-500">
                      Source: {String(blocks[page].content.eyebrow)}
                    </p>
                  )}
                </article>
                <div className="companion-actions">
                  <button
                    className="btn-secondary"
                    disabled={page === 0 || saving}
                    onClick={() => void save(page - 1)}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  {page === blocks.length - 1 ? (
                    <button
                      className="btn-primary"
                      disabled={saving || done}
                      onClick={() => void save(page, true)}
                    >
                      {done ? "Recap completed" : "Complete recap"}
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      disabled={saving}
                      onClick={() => void save(page + 1)}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="companion-empty">
                Your instructor is preparing the recap.
              </div>
            ))}
          {record &&
            ["video", "audio"].includes(record.type) &&
            (resources[0] ? (
              <>
                <ComponentMedia
                  key={record.id}
                  resource={resources[0]}
                  kind={record.type as "video" | "audio"}
                  position={position}
                  onPosition={(p) => void save(p)}
                />
                <div className="companion-actions">
                  <p className="text-sm text-ink-600">
                    When you have finished, mark this component complete.
                  </p>
                  {mark}
                </div>
              </>
            ) : (
              <div className="companion-empty">
                The media has not been posted yet.
              </div>
            ))}
          {record?.type === "resources" && (
            <>
              <section className="companion-surface">
                <ResourceList resources={resources} />
                {resources
                  .filter((r) => youtubeEmbed(r.url ?? ""))
                  .map((r) => (
                    <div className="companion-media mt-5" key={r.id}>
                      <iframe
                        src={youtubeEmbed(r.url!)}
                        title={r.title}
                        allowFullScreen
                      />
                    </div>
                  ))}
              </section>
              <div className="companion-actions">
                <p className="text-sm text-ink-600">
                  Review the module materials, then record your progress.
                </p>
                {resources.length > 0 && mark}
              </div>
            </>
          )}
          {record?.type === "activity" && (
            <ComponentActivity
              bindings={bindings}
              enrolmentId={data.outline!.enrolment_id}
            />
          )}
          {record?.type === "assessment" && (
            <ComponentAssessment
              bindings={bindings}
              enrolmentId={data.outline!.enrolment_id}
            />
          )}
          {record?.type === "live_session" && (
            <>
              <section className="companion-surface">
                <h2>Prepare for class</h2>
                <p className="mt-3">
                  You have completed{" "}
                  {
                    module.components.filter(
                      (c) =>
                        c.type !== "live_session" &&
                        c.required &&
                        c.status === "completed",
                    ).length
                  }{" "}
                  of{" "}
                  {
                    module.components.filter(
                      (c) => c.type !== "live_session" && c.required,
                    ).length
                  }{" "}
                  recommended module items.
                </p>
                <p className="companion-caption">
                  Live class completion is recorded by your instructor through
                  attendance.
                </p>
              </section>
              <div className="mt-6 space-y-5">
                {sessions.map((s) => (
                  <section key={s.id} className="companion-surface">
                    <SessionDetails session={s} />
                  </section>
                ))}
                {!sessions.length && (
                  <p>Session details have not been posted yet.</p>
                )}
              </div>
              <p className="mt-5 font-medium">
                {summary.status === "completed"
                  ? "Attendance recorded — component complete"
                  : "Attendance pending"}
              </p>
            </>
          )}
        </>
      )}
    </CompanionShell>
  );
}
function ComponentMedia({
  resource,
  kind,
  position,
  onPosition,
}: {
  resource: Resource;
  kind: "audio" | "video";
  position: number;
  onPosition: (p: number) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const last = useRef(0);
  const media = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    let live = true;
    void resourceUrl(resource)
      .then((u) => {
        if (live) setUrl(u);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [resource]);
  const retry = async () => {
    setError("");
    if (media.current) onPosition(media.current.currentTime);
    try {
      setUrl(await resourceUrl(resource));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const embed = youtubeEmbed(url);
  const props = {
    controls: true,
    preload: "metadata",
    src: url,
    onError: () =>
      setError("The media could not load. Refresh the link to try again."),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (Number.isFinite(e.currentTarget.duration))
        e.currentTarget.currentTime = Math.min(
          position,
          e.currentTarget.duration,
        );
    },
    onPause: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      onPosition(e.currentTarget.currentTime),
    onEnded: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      onPosition(e.currentTarget.currentTime),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const p = e.currentTarget.currentTime;
      if (Math.abs(p - last.current) > 15) {
        last.current = p;
        onPosition(p);
      }
    },
  };
  return (
    <>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
          <button className="btn-secondary mt-3" onClick={() => void retry()}>
            Refresh media link
          </button>
        </div>
      )}
      {url ? (
        <>
          <div className="companion-media">
            {embed ? (
              <iframe src={embed} title={resource.title} allowFullScreen />
            ) : kind === "video" ? (
              <video
                {...props}
                ref={(e) => {
                  media.current = e;
                }}
              />
            ) : (
              <audio
                {...props}
                ref={(e) => {
                  media.current = e;
                }}
              />
            )}
          </div>
          {!embed && (
            <label className="mt-4 flex items-center gap-3 text-sm">
              Playback speed
              <select
                className="input w-auto"
                defaultValue="1"
                onChange={(e) => {
                  if (media.current)
                    media.current.playbackRate = Number(e.target.value);
                }}
              >
                {[0.75, 1, 1.25, 1.5, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </label>
          )}
          {resource.is_downloadable && (
            <a
              className="btn-secondary mt-4"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <Download size={16} />
              Open media file
            </a>
          )}
        </>
      ) : (
        !error && <p role="status">Loading media…</p>
      )}
    </>
  );
}
