import { useInstructorCohorts } from "@/hooks/useInstructorCohorts";
import { CompanionAuthor } from "./CompanionAuthor";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert } from "@/components/ui/Feedback";
import { useRoleView } from "@/context/RoleViewContext";
import { supabase } from "@/lib/supabase";
import { componentLabels } from "./model";
import type { ComponentRecord } from "./ComponentPage";
import "./companion.css";
type Cohort = {
  id: string;
  name: string;
  course_id: string;
  metadata: Record<string, unknown>;
};
type Module = { id: string; title: string; display_order: number };
type Editable = ComponentRecord & {
  display_order: number;
  required: boolean;
  is_published: boolean;
};
type Choice = { id: string; title: string };
export function CompanionStudio() {
  const { activeRole } = useRoleView();
  const base = activeRole === "administrator" ? "/admin" : "/instructor";
  const { cohorts: assignedCohorts, error: cohortError } =
    useInstructorCohorts();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [components, setComponents] = useState<Editable[]>([]);
  const [editing, setEditing] = useState<Editable | null>(null);
  const [lessons, setLessons] = useState<Choice[]>([]);
  const [resources, setResources] = useState<Choice[]>([]);
  const [targets, setTargets] = useState<Choice[]>([]);
  const [bound, setBound] = useState<string[]>([]);
  const [release, setRelease] = useState("locked");
  const [date, setDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const cohort = cohorts.find((c) => c.id === cohortId);
  useEffect(() => {
    setCohorts(assignedCohorts as Cohort[]);
    setCohortId((v) =>
      assignedCohorts.some((c) => c.id === v)
        ? v
        : (assignedCohorts[0]?.id ?? ""),
    );
    if (cohortError) setError(cohortError);
  }, [assignedCohorts, cohortError]);
  const load = useCallback(async () => {
    if (!cohort) return;
    const m = await supabase
      .from("modules")
      .select("id,title,display_order")
      .eq("course_id", cohort.course_id)
      .order("display_order");
    if (m.error) {
      setError(m.error.message);
      return;
    }
    setModules(m.data ?? []);
    setSelectedModule((v) =>
      m.data?.some((x) => x.id === v) ? v : (m.data?.[0]?.id ?? ""),
    );
  }, [cohort]);
  useEffect(() => {
    void load();
  }, [load]);
  const loadModule = useCallback(async () => {
    if (!selectedModule) return;
    const [x, l, r, release] = await Promise.all([
      supabase
        .from("module_components")
        .select("*")
        .eq("module_id", selectedModule)
        .order("display_order"),
      supabase
        .from("lessons")
        .select("id,title")
        .eq("module_id", selectedModule),
      supabase
        .from("resources")
        .select("id,title")
        .eq("module_id", selectedModule)
        .is("cohort_id", null),
      supabase
        .from("module_releases")
        .select("*")
        .eq("module_id", selectedModule)
        .eq("cohort_id", cohortId)
        .maybeSingle(),
    ]);
    if (x.error || l.error || r.error || release.error)
      setError((x.error ?? l.error ?? r.error ?? release.error)!.message);
    setComponents(x.data ?? []);
    setLessons(l.data ?? []);
    setResources(r.data ?? []);
    setRelease(release.data?.mode ?? "locked");
    setDate(
      release.data?.release_at
        ? new Date(
            new Date(release.data.release_at).getTime() -
              new Date().getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : "",
    );
    setOffset(release.data?.days_offset ?? 0);
    setEditing(null);
  }, [selectedModule, cohortId]);
  useEffect(() => {
    void loadModule();
  }, [loadModule]);
  async function act(
    task: () => PromiseLike<{ error: { message: string } | null }>,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await task();
      if (r.error) throw r.error;
      setMessage(success);
      await loadModule();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function edit(c: Editable) {
    setEditing(c);
    setTargets([]);
    setBound([]);
    const table =
      c.type === "activity"
        ? "assignments"
        : c.type === "assessment"
          ? "assessments"
          : c.type === "live_session"
            ? "live_sessions"
            : null;
    if (!table) return;
    let query = supabase
      .from(table)
      .select("id,title")
      .eq("cohort_id", cohortId);
    if (table !== "live_sessions")
      query = query.eq("module_id", selectedModule);
    const [t, b] = await Promise.all([
      query,
      supabase
        .from("component_bindings")
        .select("*")
        .eq("component_id", c.id)
        .eq("cohort_id", cohortId),
    ]);
    if (t.error || b.error) {
      setError((t.error ?? b.error)!.message);
      return;
    }
    setTargets(t.data ?? []);
    setBound(
      (b.data ?? []).map(
        (v) => v.assignment_id ?? v.assessment_id ?? v.live_session_id,
      ),
    );
  }
  async function save() {
    if (!editing) return;
    await act(
      () =>
        supabase.rpc("companion_save_component", {
          cohort_uuid: cohortId,
          component_uuid: editing.id,
          component_data: {
            title: editing.title,
            description: editing.description,
            required: editing.required,
            is_published: editing.is_published,
            display_order: editing.display_order,
            lesson_id: editing.lesson_id,
            resource_id: editing.resource_id,
            requires_pass: editing.requires_pass,
          },
          target_ids: bound,
        }),
      "Component saved.",
    );
  }
  return (
    <AppLayout>
      <div className="companion-page">
        <header className="companion-heading">
          <h1>Module companion studio</h1>
          <p className="mt-2 text-ink-600">
            Prepare each section, then release the module to your cohort.
          </p>
        </header>
        {error && <Alert>{error}</Alert>}
        {message && (
          <p role="status" className="mb-4 text-success-700">
            {message}
          </p>
        )}
        <section className="companion-surface">
          <label className="block text-sm font-medium">
            Cohort
            <select
              className="input mt-2"
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn-secondary"
              disabled={busy || !cohortId}
              onClick={() =>
                void act(
                  () =>
                    supabase.rpc("companion_initialize", {
                      cohort_uuid: cohortId,
                    }),
                  "Draft component templates prepared. Review each before publishing.",
                )
              }
            >
              Prepare module templates
            </button>
            <button
              className="btn-primary"
              disabled={busy || !cohortId}
              onClick={async () => {
                const saved = await act(
                  () =>
                    supabase.rpc("companion_set_mode", {
                      cohort_uuid: cohortId,
                      enabled: !cohort?.metadata.companion_v2,
                    }),
                  "Delivery mode updated.",
                );
                if (saved)
                  setCohorts((v) =>
                    v.map((c) =>
                      c.id === cohortId
                        ? {
                            ...c,
                            metadata: {
                              ...c.metadata,
                              companion_v2: !c.metadata.companion_v2,
                            },
                          }
                        : c,
                    ),
                  );
              }}
            >
              {cohort?.metadata.companion_v2
                ? "Return cohort to v1 delivery"
                : "Enable v2 delivery"}
            </button>
          </div>
          <p className="companion-caption">
            Templates start unpublished and modules start locked. Switching
            delivery mode preserves academic records.
          </p>
        </section>
        <label className="mt-6 block text-sm font-medium">
          Module
          <select
            className="input mt-2"
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
          >
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        {selectedModule && (
          <>
            <section className="companion-surface mt-6">
              <h2>Release to this cohort</h2>
              <div className="companion-staff-grid mt-4">
                <label>
                  Release rule
                  <select
                    className="input"
                    value={release}
                    onChange={(e) => setRelease(e.target.value)}
                  >
                    <option value="locked">Locked</option>
                    <option value="released">Release now</option>
                    <option value="scheduled">Scheduled date/time</option>
                    <option value="relative">Days after cohort start</option>
                  </select>
                </label>
                {release === "scheduled" && (
                  <label>
                    Release time (your local time)
                    <input
                      className="input"
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                )}
                {release === "relative" && (
                  <label>
                    Days after start
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={offset}
                      onChange={(e) => setOffset(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                I understand that relocking removes content access but retains
                student records.
              </label>
              <button
                className="btn-primary mt-4"
                disabled={busy || (release === "scheduled" && !date)}
                onClick={() =>
                  void act(
                    () =>
                      supabase.rpc("companion_set_release", {
                        cohort_uuid: cohortId,
                        module_uuid: selectedModule,
                        release_mode: release,
                        release_date:
                          release === "scheduled"
                            ? new Date(date).toISOString()
                            : null,
                        offset_days: release === "relative" ? offset : null,
                        confirm_relock: confirm,
                      }),
                    "Release rule saved.",
                  )
                }
              >
                Save release
              </button>
            </section>
            <section className="companion-surface mt-6">
              <h2>Module sections</h2>
              {components.map((c) => (
                <div key={c.id} className="companion-row">
                  <div>
                    <strong>{c.title}</strong>
                    <p className="mt-1 text-sm text-ink-500">
                      {componentLabels[c.type]} ·{" "}
                      {c.is_published ? "Published" : "Draft"} ·{" "}
                      {c.required ? "Required" : "Optional"}
                    </p>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => void edit(c)}
                  >
                    Edit section
                  </button>
                </div>
              ))}
              {!components.length && (
                <p className="mt-4">Prepare module templates to get started.</p>
              )}
            </section>
            {editing && (
              <section className="companion-surface mt-6">
                <h2>Edit {componentLabels[editing.type]}</h2>
                <div className="companion-staff-grid mt-5">
                  <label>
                    Title
                    <input
                      className="input"
                      value={editing.title}
                      onChange={(e) =>
                        setEditing({ ...editing, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Display order
                    <input
                      className="input"
                      type="number"
                      value={editing.display_order}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          display_order: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="sm:col-span-2">
                    Description
                    <textarea
                      className="input"
                      value={editing.description ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, description: e.target.value })
                      }
                    />
                  </label>
                  {editing.type === "ebook_recap" && (
                    <label>
                      Recap lesson
                      <select
                        className="input"
                        value={editing.lesson_id ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            lesson_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Select recap content</option>
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {["video", "audio"].includes(editing.type) && (
                    <label>
                      Module media resource
                      <select
                        className="input"
                        value={editing.resource_id ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            resource_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Select media</option>
                        {resources.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-5">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editing.required}
                      onChange={(e) =>
                        setEditing({ ...editing, required: e.target.checked })
                      }
                    />
                    Required for completion
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editing.is_published}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          is_published: e.target.checked,
                        })
                      }
                    />
                    Published
                  </label>
                  {editing.type === "assessment" && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editing.requires_pass}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            requires_pass: e.target.checked,
                          })
                        }
                      />
                      Passing score required
                    </label>
                  )}
                </div>
                {targets.length > 0 && (
                  <fieldset className="mt-5">
                    <legend className="font-semibold">
                      Included items for this cohort
                    </legend>
                    {targets.map((t) => (
                      <label className="mt-3 flex gap-3" key={t.id}>
                        <input
                          type="checkbox"
                          checked={bound.includes(t.id)}
                          onChange={(e) =>
                            setBound((v) =>
                              e.target.checked
                                ? [...v, t.id]
                                : v.filter((id) => id !== t.id),
                            )
                          }
                        />
                        {t.title}
                      </label>
                    ))}
                  </fieldset>
                )}
                <div className="companion-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setEditing(null)}
                  >
                    Close editor
                  </button>
                  <button
                    className="btn-primary"
                    disabled={busy || !editing.title.trim()}
                    onClick={() => void save()}
                  >
                    Save section
                  </button>
                </div>
                {editing.type === "ebook_recap" && editing.lesson_id && (
                  <RecapEditor lessonId={editing.lesson_id} />
                )}
              </section>
            )}
            <CompanionAuthor
              cohortId={cohortId}
              moduleId={selectedModule}
              onSaved={loadModule}
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-secondary" to={`${base}/resources`}>
                Upload module media & resources
              </Link>
              <Link className="btn-secondary" to={`${base}/assignments`}>
                Activities & assessments
              </Link>
              <Link className="btn-secondary" to={`${base}/live-sessions`}>
                Schedule live classes
              </Link>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
function RecapEditor({ lessonId }: { lessonId: string }) {
  const [pages, setPages] = useState<
    Array<{
      id: string;
      content: {
        type?: string;
        title?: string;
        lead?: string;
        bullets?: string[];
      };
      display_order: number;
    }>
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase
      .from("lesson_blocks")
      .select("id,content,display_order")
      .eq("lesson_id", lessonId)
      .order("display_order")
      .then((r) => {
        setPages(r.data ?? []);
        setError(r.error?.message ?? "");
      });
  }, [lessonId]);
  return (
    <div className="mt-8 border-t border-ink-200 pt-6">
      <h2>Ordered recap pages</h2>
      <p className="companion-caption">
        Edit concise eBook summaries. Use the curriculum builder for rich
        diagrams and media.
      </p>
      {error && <Alert>{error}</Alert>}
      {pages.map((p, i) => (
        <div className="mt-5 space-y-2" key={p.id}>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={i === 0 || busy}
              onClick={() =>
                setPages((v) => {
                  const next = [...v];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  return next;
                })
              }
            >
              Move page {i + 1} up
            </button>
            <button
              className="btn-secondary"
              disabled={i === pages.length - 1 || busy}
              onClick={() =>
                setPages((v) => {
                  const next = [...v];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  return next;
                })
              }
            >
              Move page {i + 1} down
            </button>
          </div>
          <label className="block text-sm">
            Page {i + 1} title
            <input
              className="input"
              value={p.content.title ?? ""}
              onChange={(e) =>
                setPages((v) =>
                  v.map((x) =>
                    x.id === p.id
                      ? {
                          ...x,
                          content: { ...x.content, title: e.target.value },
                        }
                      : x,
                  ),
                )
              }
            />
          </label>
          <label className="block text-sm">
            Explanation
            <textarea
              className="input"
              value={p.content.lead ?? ""}
              onChange={(e) =>
                setPages((v) =>
                  v.map((x) =>
                    x.id === p.id
                      ? {
                          ...x,
                          content: { ...x.content, lead: e.target.value },
                        }
                      : x,
                  ),
                )
              }
            />
          </label>
          <label className="block text-sm">
            Key points (one per line)
            <textarea
              className="input"
              value={p.content.bullets?.join("\n") ?? ""}
              onChange={(e) =>
                setPages((v) =>
                  v.map((x) =>
                    x.id === p.id
                      ? {
                          ...x,
                          content: {
                            ...x.content,
                            bullets: e.target.value.split("\n"),
                          },
                        }
                      : x,
                  ),
                )
              }
            />
          </label>
        </div>
      ))}
      <div className="mt-5 flex gap-3">
        <button
          className="btn-secondary"
          onClick={() =>
            setPages((v) => [
              ...v,
              {
                id: crypto.randomUUID(),
                content: { title: "", lead: "", bullets: [] },
                display_order: v.length + 1,
              },
            ])
          }
        >
          Add recap page
        </button>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await supabase.from("lesson_blocks").upsert(
              pages.map((p, i) => ({
                ...p,
                lesson_id: lessonId,
                block_type: "storyboard_screen",
                display_order: i + 1,
                content: { ...p.content, type: p.content.type ?? "concept" },
              })),
            );
            setError(r.error?.message ?? "");
            setBusy(false);
          }}
        >
          Save recap pages
        </button>
      </div>
    </div>
  );
}
