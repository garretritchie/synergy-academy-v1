import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/format";
import { DeleteRecordButton } from "@/components/ui/DeleteRecordButton";
import { Alert } from "@/components/ui/Feedback";
import type { InstructorCohort } from "@/hooks/useInstructorCohorts";

type AssessmentRow = { id: string; title: string; assessment_type: string; is_published: boolean };
export function AssessmentRecords({ cohorts, revision }: { cohorts: InstructorCohort[]; revision: number }) {
  const [cohortId, setCohortId] = useState("");
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selected = cohorts.some(cohort => cohort.id === cohortId) ? cohortId : cohorts[0]?.id;
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setRows([]);
      setError("");
      if (!selected) return;
      setLoading(true);
      try {
        const { data, error: queryError } = await supabase.from("assessments")
          .select("id,title,assessment_type,is_published").eq("cohort_id", selected).order("title");
        if (queryError) throw queryError;
        if (!cancelled) setRows(data ?? []);
      } catch (err) { if (!cancelled) setError(getErrorMessage(err)); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [selected, revision]);
  return <details className="rounded-xl bg-white p-4 shadow-soft">
    <summary className="cursor-pointer py-2 font-semibold text-ink-900">Manage assessments</summary>
    <p className="mt-2 text-sm text-ink-600">Remove a quiz or module check created by mistake. Records with attempts or results are protected.</p>
    <select aria-label="Assessment cohort" className="input my-3" value={selected ?? ""} onChange={event => setCohortId(event.target.value)}>
      {!cohorts.length && <option value="">No cohorts available</option>}
      {cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.course.title} · {cohort.name}</option>)}
    </select>
    {error && <Alert>{error}</Alert>}
    {loading ? <p role="status" className="py-4 text-sm text-ink-600">Loading assessments…</p> : <div className="divide-y divide-ink-100">
      {!rows.length && !error && <p className="py-4 text-sm text-ink-600">No assessments in this cohort.</p>}
      {rows.map(row => <div key={row.id} className="flex items-center gap-3 py-3">
        <ClipboardCheck size={18} className="shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{row.title}</p><p className="text-xs text-ink-600">{row.assessment_type === "practice" ? "Module check" : "Graded assessment"} · {row.is_published ? "Published" : "Draft"}</p></div>
        <DeleteRecordButton table="assessments" id={row.id} title={row.title} onDeleted={() => setRows(current => current.filter(item => item.id !== row.id))} />
      </div>)}
    </div>}
  </details>;
}
