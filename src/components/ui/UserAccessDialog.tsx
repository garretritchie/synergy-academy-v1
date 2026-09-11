import { Modal } from "./Modal";
import { Alert } from "./Feedback";

export function UserAccessDialog({ name, email, active, saving, error, onClose, onConfirm }: {
  name: string; email: string; active: boolean; saving: boolean; error: string;
  onClose: () => void; onConfirm: () => void;
}) {
  return <Modal title={active ? "Disable user?" : "Enable user?"} onClose={() => { if (!saving) onClose(); }}>
    <p className="break-words font-semibold">{name}</p>
    <p className="mt-1 break-all text-sm text-ink-600">{email}</p>
    <p className="mt-4 text-sm leading-6 text-ink-700">{active
      ? "This removes access to protected academy courses and staff areas. Enrolments, submissions, grades, and messages stay on record. You can enable the user again at any time."
      : "This restores academy access using the account’s existing roles and enrolments."}</p>
    {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button>
      <button type="button" className={`btn-primary ${active ? "!bg-red-700 hover:!bg-red-800" : ""}`} disabled={saving} onClick={onConfirm}>
        {saving ? "Saving…" : active ? "Disable user" : "Enable user"}
      </button>
    </div>
  </Modal>;
}
