import { useEffect, useRef, useState } from "react";
import { Trash2, ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";
import { Alert } from "./Feedback";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/format";

const recordLabels = {
  live_sessions: "live session", assignments: "assignment", assessments: "assessment",
  announcements: "announcement", cohorts: "cohort", course_categories: "category",
};
type Review = { allowed: boolean; title: string; dependencies: { source: string; count: number }[] };
type Props = { table: keyof typeof recordLabels; id: string; title: string; onDeleted: () => void | Promise<void> };

export function DeleteRecordButton(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="btn-ghost min-h-11 shrink-0 !text-red-700 hover:!bg-red-50" aria-label={`Delete ${props.title}`} onClick={() => setOpen(true)}><Trash2 size={16} /> Delete</button>
    {open && <DeletionDialog {...props} onClose={() => setOpen(false)} />}
  </>;
}

function DeletionDialog({ table, id, title, onDeleted, onClose }: Props & { onClose: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const { data, error: checkError } = await supabase.rpc("preview_record_deletion", { record_table: table, record_id: id });
        if (checkError) throw checkError;
        if (!cancelled) setReview(data as Review);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err).includes("preview_record_deletion")
          ? "Deletion controls require database migration 031. Ask your administrator to apply it, then try again."
          : getErrorMessage(err));
      } finally { if (!cancelled) setLoading(false); }
    }
    void check();
    return () => { cancelled = true; };
  }, [table, id]);
  async function remove() {
    if (!review?.allowed || confirmation !== "DELETE" || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const { error: deleteError } = await supabase.rpc("delete_staff_record", { record_table: table, record_id: id, expected_title: review.title });
      if (deleteError) throw deleteError;
      setDeleted(true);
      try { await onDeleted(); onClose(); }
      catch { setError("The record was deleted, but the list could not refresh. Close this dialog and refresh the page."); }
    } catch (err) { setError(getErrorMessage(err)); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <Modal title={`Delete ${recordLabels[table]}?`} onClose={() => { if (!inFlight.current) onClose(); }}>
    <p className="break-words font-semibold">{review?.title || title}</p>
    {loading && <p role="status" className="mt-4 text-sm text-ink-600">Checking permissions and linked records…</p>}
    {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    {review && !review.allowed && <div className="mt-4 space-y-3 text-sm text-ink-700">
      <p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> This record is protected</p>
      <p>Linked records must be preserved. {table === "live_sessions" ? "Cancel this session instead to keep its attendance history." : "Keep this record, or unpublish/deactivate it where available."}</p>
      <ul className="list-disc space-y-1 pl-5">{review.dependencies.map((item, i) => <li key={`${item.source}-${i}`}>{item.count} linked {item.source}</li>)}</ul>
    </div>}
    {review?.allowed && !deleted && <div className="mt-4 space-y-4 text-sm leading-6 text-ink-700">
      <p>This permanently removes the {recordLabels[table]} from the LMS. There is no undo.</p>
      {table === "live_sessions" && <p>Linked lessons and resources are kept. Uploaded recordings are not purged. This does not cancel the external Zoom meeting.</p>}
      {table === "assessments" && <p>The assessment’s questions are also removed. Any attempts or student results block deletion.</p>}
      {table === "announcements" && <p>Previously delivered emails cannot be recalled.</p>}
      {table === "cohorts" && <p>Instructor assignments to this empty cohort are removed; instructor accounts are kept.</p>}
      <label className="block font-medium">Type DELETE to confirm
        <input className="input mt-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={saving} />
      </label>
    </div>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>{deleted || review?.allowed === false ? "Close" : "Cancel"}</button>
      {review?.allowed && !deleted && <button type="button" className="btn-primary !bg-red-700 hover:!bg-red-800" disabled={saving || confirmation !== "DELETE"} onClick={() => void remove()}><Trash2 size={16} /> {saving ? "Deleting…" : "Delete permanently"}</button>}
    </div>
  </Modal>;
}
