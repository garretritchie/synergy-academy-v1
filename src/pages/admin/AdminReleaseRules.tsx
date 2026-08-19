/* The page-local loader is reused after release-rule mutations. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type FormEvent } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import type { Cohort, ContentReleaseRule, Lesson, Module } from "@/types";

type CohortRow = Cohort & { course: { title: string } };
type ModuleRow = Module & { lessons: Lesson[] };
export function AdminReleaseRules() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [cohortId, setCohortId] = useState("");
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [rules, setRules] = useState<ContentReleaseRule[]>([]);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [releaseType, setReleaseType] = useState("immediate");
  const [releaseDate, setReleaseDate] = useState("");
  const [daysOffset, setDaysOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("cohorts")
        .select("*,course:courses(title)")
        .order("start_date", { ascending: false });
      if (queryError) setError(queryError.message);
      else {
        const list = (data ?? []) as unknown as CohortRow[];
        setCohorts(list);
        setCohortId(list[0]?.id ?? "");
      }
      setLoading(false);
    })();
  }, []);
  const load = async () => {
    const cohort = cohorts.find((item) => item.id === cohortId);
    if (!cohort) return;
    setLoading(true);
    const [moduleResult, ruleResult] = await Promise.all([
      supabase
        .from("modules")
        .select("*,lessons(*)")
        .eq("course_id", cohort.course_id)
        .order("display_order")
        .order("display_order", { referencedTable: "lessons" }),
      supabase
        .from("content_release_rules")
        .select("*")
        .eq("cohort_id", cohortId)
        .order("created_at"),
    ]);
    const queryError = moduleResult.error || ruleResult.error;
    if (queryError) setError(queryError.message);
    else {
      setModules((moduleResult.data ?? []) as unknown as ModuleRow[]);
      setRules((ruleResult.data ?? []) as ContentReleaseRule[]);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (cohortId && cohorts.length) void load();
  }, [cohortId, cohorts.length]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const isLesson = target.startsWith("lesson:");
    const id = target.split(":")[1];
    const payload = {
      cohort_id: cohortId,
      module_id: isLesson
        ? modules.find((module) =>
            module.lessons.some((lesson) => lesson.id === id),
          )?.id
        : id,
      lesson_id: isLesson ? id : null,
      release_type: releaseType,
      release_date:
        releaseType === "scheduled" && releaseDate
          ? new Date(releaseDate).toISOString()
          : null,
      days_offset: releaseType === "days_from_start" ? daysOffset : null,
    };
    const existing = rules.find((rule) =>
      isLesson
        ? rule.lesson_id === id
        : rule.module_id === id && !rule.lesson_id,
    );
    const result = existing
      ? await supabase
          .from("content_release_rules")
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("content_release_rules").insert(payload);
    if (result.error) setError(result.error.message);
    else {
      setOpen(false);
      setTarget("");
      await load();
    }
    setSaving(false);
  };
  const remove = async (id: string) => {
    const { error: deleteError } = await supabase
      .from("content_release_rules")
      .delete()
      .eq("id", id);
    if (deleteError) setError(deleteError.message);
    else await load();
  };
  const targetName = (rule: ContentReleaseRule) => {
    if (rule.lesson_id)
      return (
        modules
          .flatMap((module) => module.lessons)
          .find((lesson) => lesson.id === rule.lesson_id)?.title ?? "Lesson"
      );
    return (
      modules.find((module) => module.id === rule.module_id)?.title ?? "Module"
    );
  };
  return (
    <AppLayout>
      <PageHeader
        title="Content release"
        subtitle="Open curriculum immediately, by date, from cohort start, or after the previous lesson."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        <section className="rounded-xl bg-white p-5 shadow-soft">
          <Field label="Cohort">
            <select
              className="input max-w-2xl"
              value={cohortId}
              onChange={(event) => setCohortId(event.target.value)}
            >
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.course.title} - {cohort.name}
                </option>
              ))}
            </select>
          </Field>
        </section>
        <FormPanel
          title="Add release rule"
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel="New rule"
        >
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Module or lesson">
                <select
                  required
                  className="input"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Select content</option>
                  {modules.map((module) => (
                    <optgroup key={module.id} label={module.title}>
                      <option value={`module:${module.id}`}>
                        Entire module
                      </option>
                      {module.lessons.map((lesson) => (
                        <option key={lesson.id} value={`lesson:${lesson.id}`}>
                          {lesson.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Release method">
                <select
                  className="input"
                  value={releaseType}
                  onChange={(event) => setReleaseType(event.target.value)}
                >
                  <option value="immediate">Immediately</option>
                  <option value="scheduled">Scheduled date</option>
                  <option value="days_from_start">
                    Days from cohort start
                  </option>
                  <option value="after_previous">After previous lesson</option>
                </select>
              </Field>
            </div>
            {releaseType === "scheduled" && (
              <Field label="Release date and time">
                <input
                  required
                  type="datetime-local"
                  className="input max-w-sm"
                  value={releaseDate}
                  onChange={(event) => setReleaseDate(event.target.value)}
                />
              </Field>
            )}
            {releaseType === "days_from_start" && (
              <Field label="Days after cohort start">
                <input
                  required
                  type="number"
                  min="0"
                  className="input max-w-sm"
                  value={daysOffset}
                  onChange={(event) =>
                    setDaysOffset(Number(event.target.value))
                  }
                />
              </Field>
            )}
            <div className="flex justify-end">
              <SubmitButton loading={saving}>Save release rule</SubmitButton>
            </div>
          </form>
        </FormPanel>
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {loading ? (
            <TableSkeleton />
          ) : rules.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              <Clock3 className="mx-auto mb-2 text-ink-300" />
              No release rules. Published lessons are available immediately.
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {rules.map((rule) => (
                <article
                  key={rule.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <Clock3 size={18} className="text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-ink-900">
                      {targetName(rule)}
                    </h2>
                    <p className="text-xs text-ink-500">
                      {rule.release_type.replace(/_/g, " ")}
                      {rule.release_date
                        ? ` · ${formatDateTime(rule.release_date)}`
                        : ""}
                      {rule.days_offset != null
                        ? ` · day ${rule.days_offset}`
                        : ""}
                    </p>
                  </div>
                  <button
                    className="btn-ghost !p-2 text-danger-600"
                    onClick={() => void remove(rule.id)}
                    aria-label={`Delete rule for ${targetName(rule)}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
