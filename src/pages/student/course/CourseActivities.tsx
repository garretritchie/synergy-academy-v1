import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListChecks,
  LockKeyhole,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { CourseLayout } from "./CourseLayout";
import { moduleLabel, parseStructuredInstructions } from "./courseFormatting";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Assignment, ProgressRecord, Submission } from "@/types";

type ActivityRow = Assignment & {
  module: { title: string; display_order: number } | null;
  submissions: Submission[];
};

export function CourseActivities() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [enrolmentId, setEnrolmentId] = useState("");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [openId, setOpenId] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cohortId || !user) return;
    setLoading(true);
    const enrolmentResult = await supabase
      .from("enrolments")
      .select("id")
      .eq("cohort_id", cohortId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .single();
    if (enrolmentResult.error) {
      setError(enrolmentResult.error.message);
      setLoading(false);
      return;
    }
    setEnrolmentId(enrolmentResult.data.id);
    const [activityResult, progressResult] = await Promise.all([
      supabase
        .from("assignments")
        .select("*,module:modules(title,display_order),submissions(*)")
        .eq("cohort_id", cohortId)
        .eq("assignment_type", "activity")
        .eq("is_published", true)
        .eq("submissions.enrolment_id", enrolmentResult.data.id),
      supabase
        .from("progress_records")
        .select("*")
        .eq("cohort_id", cohortId)
        .eq("student_id", user.id),
    ]);
    const queryError = activityResult.error || progressResult.error;
    if (queryError) setError(queryError.message);
    else {
      setActivities(
        ((activityResult.data ?? []) as unknown as ActivityRow[]).sort(
          (a, b) =>
            (a.module?.display_order ?? 99) - (b.module?.display_order ?? 99),
        ),
      );
      setProgress((progressResult.data ?? []) as ProgressRecord[]);
    }
    setLoading(false);
  }, [cohortId, user]);

  useEffect(() => {
    void load();
  }, [load]);
  const completedLessons = useMemo(
    () =>
      new Set(
        progress
          .filter((item) => item.status === "completed")
          .map((item) => item.lesson_id),
      ),
    [progress],
  );
  const markComplete = async (activity: ActivityRow, checked: boolean[]) => {
    if (!user || !checked.every(Boolean)) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase
      .from("submissions")
      .upsert(
        {
          assignment_id: activity.id,
          enrolment_id: enrolmentId,
          student_id: user.id,
          content: JSON.stringify({
            selfCheck: checked,
            completedAt: new Date().toISOString(),
          }),
          status: "submitted",
          submitted_at: new Date().toISOString(),
          is_late: false,
          max_grade: 0,
        },
        { onConflict: "assignment_id,enrolment_id" },
      );
    if (saveError) setError(saveError.message);
    else await load();
    setSaving(false);
  };

  return (
    <CourseLayout>
      <PageHeader
        title="Activities"
        subtitle="Practise one module skill at a time, then use the self-check to confirm your work."
      />
      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {loading ? (
        <div className="mt-6 rounded-xl bg-white shadow-soft">
          <TableSkeleton />
        </div>
      ) : activities.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white shadow-soft">
          <EmptyState
            icon={<ListChecks size={30} />}
            title="No activities yet"
            description="Module activities will appear here."
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          {activities.map((activity) => {
            const unlocked =
              !activity.lesson_id || completedLessons.has(activity.lesson_id);
            const done = activity.submissions.some((submission) =>
              ["submitted", "graded"].includes(submission.status),
            );
            const structured = parseStructuredInstructions(
              activity.description,
            );
            const selected =
              checks[activity.id] ?? structured.checklist.map(() => false);
            const open = openId === activity.id;
            return (
              <article
                key={activity.id}
                className={`overflow-hidden rounded-2xl border border-ink-200/80 border-t-4 border-t-brand-500 bg-white shadow-soft ${open ? "lg:col-span-2" : ""}`}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-4 p-5 text-left hover:bg-ink-50 disabled:cursor-not-allowed"
                  disabled={!unlocked}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? "" : activity.id)}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${done ? "bg-success-50 text-success-700" : unlocked ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-400"}`}
                  >
                    {done ? (
                      <CheckCircle2 size={20} />
                    ) : unlocked ? (
                      <ListChecks size={20} />
                    ) : (
                      <LockKeyhole size={18} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
                      {moduleLabel(activity.module)}
                    </span>
                    <span className="mt-1 block font-semibold text-ink-950">
                      {activity.title}
                    </span>
                    <span className="mt-1 block text-sm text-ink-500">
                      {done
                        ? "Completed"
                        : unlocked
                          ? "Open the activity and check your work."
                          : "Complete the matching learning module first."}
                    </span>
                  </span>
                  {unlocked &&
                    (open ? (
                      <ChevronUp size={19} />
                    ) : (
                      <ChevronDown size={19} />
                    ))}
                </button>
                {open && unlocked && (
                  <div className="border-t border-ink-100 p-5 sm:p-6">
                    <h3 className="font-semibold text-ink-950">Directions</h3>
                    <ol className="mt-3 space-y-3 text-sm leading-6 text-ink-700">
                      {structured.instructions.map((step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
                      <h3 className="font-semibold text-brand-950">
                        Self-check
                      </h3>
                      <p className="mt-1 text-sm text-brand-800">
                        Check each statement only after you can show the
                        evidence.
                      </p>
                      <div className="mt-4 space-y-2">
                        {structured.checklist.map((item, index) => (
                          <label
                            key={item}
                            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-3 text-sm text-ink-700"
                          >
                            <input
                              className="mt-0.5"
                              type="checkbox"
                              checked={selected[index] || done}
                              disabled={done}
                              onChange={(event) => {
                                const next = [...selected];
                                next[index] = event.target.checked;
                                setChecks((current) => ({
                                  ...current,
                                  [activity.id]: next,
                                }));
                              }}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn-primary mt-4"
                        disabled={done || saving || !selected.every(Boolean)}
                        onClick={() => void markComplete(activity, selected)}
                      >
                        {done
                          ? "Activity complete"
                          : saving
                            ? "Saving..."
                            : "Mark activity complete"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </CourseLayout>
  );
}
