import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Cloud,
  Database,
  Globe2,
  Mail,
  Megaphone,
  Power,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DirectMessagesPanel } from "@/components/communication/DirectMessagesPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

type CohortOption = { id: string; name: string; course: { title: string } };
type AnnouncementRow = {
  id: string;
  cohort_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string | null;
  cohort: CohortOption;
};

export function AdminCommunications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [open, setOpen] = useState(false);
  const [announcementStep, setAnnouncementStep] = useState(0);
  const [form, setForm] = useState({
    cohort_id: "",
    title: "",
    body: "",
    is_pinned: false,
    is_published: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deliveryNotice, setDeliveryNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [announcementResult, cohortResult] = await Promise.all([
      supabase
        .from("announcements")
        .select("*,cohort:cohorts(id,name,course:courses(title))")
        .order("created_at", { ascending: false }),
      supabase
        .from("cohorts")
        .select("id,name,course:courses(title)")
        .eq("is_active", true)
        .order("start_date", { ascending: false }),
    ]);
    const queryError = announcementResult.error || cohortResult.error;
    if (queryError) setError(queryError.message);
    else {
      setRows((announcementResult.data ?? []) as unknown as AnnouncementRow[]);
      setCohorts((cohortResult.data ?? []) as unknown as CohortOption[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setDeliveryNotice("");
    const { data: created, error: insertError } = await supabase
      .from("announcements")
      .insert({
        ...form,
        author_id: user?.id,
        published_at: form.is_published ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (insertError) setError(insertError.message);
    else {
      if (form.is_published && created) {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          "academy-email",
          { body: { type: "announcement", announcement_id: created.id } },
        );
        setDeliveryNotice(
          emailError
            ? "Announcement published, but the email request could not be processed."
            : emailResult?.suppressed
              ? "Announcement published. Email was suppressed by the testing kill switch."
              : `Announcement published and emailed to ${emailResult?.sent ?? 0} learner(s).`,
        );
      }
      setForm({
        cohort_id: "",
        title: "",
        body: "",
        is_pinned: false,
        is_published: true,
      });
      setOpen(false);
      setAnnouncementStep(0);
      await load();
    }
    setSaving(false);
  };
  return (
    <AppLayout>
      <PageHeader
        title="Communications"
        subtitle="Publish cohort announcements from one place."
      />
      <div className="mt-6 space-y-5">
        {deliveryNotice && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-xs leading-5 text-brand-800">
            {deliveryNotice}
          </div>
        )}
        <DirectMessagesPanel role="administrator" />
        <FormPanel
          title="New announcement"
          open={open}
          onToggle={() => setOpen(!open)}
          actionLabel="Write announcement"
        >
          <form onSubmit={save}>
            {error && <Alert>{error}</Alert>}
            <CreationWizard
              steps={["Choose audience", "Write message", "Review delivery"]}
              currentStep={announcementStep}
              canContinue={
                announcementStep === 0
                  ? Boolean(form.cohort_id)
                  : announcementStep === 1
                    ? Boolean(form.title.trim() && form.body.trim())
                    : true
              }
              saving={saving}
              finalAction="Publish announcement"
              onBack={() => setAnnouncementStep((step) => Math.max(0, step - 1))}
              onNext={() => setAnnouncementStep((step) => Math.min(2, step + 1))}
            >
            {announcementStep === 0 ? (
              <Field label="Cohort" hint="Only members of this cohort will receive the announcement.">
              <select
                required
                className="input"
                value={form.cohort_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cohort_id: event.target.value,
                  }))
                }
              >
                <option value="">Select cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.course.title} - {cohort.name}
                  </option>
                ))}
              </select>
              </Field>
            ) : announcementStep === 1 ? (
              <div className="space-y-4">
              <Field label="Title">
              <input
                required
                className="input"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
              </Field>
              <Field label="Message">
              <textarea
                required
                className="input min-h-28"
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
              />
              </Field>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-ink-50 p-4">
                  <p className="text-xs font-semibold text-ink-900">{form.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink-600">{form.body}</p>
                </div>
                <div className="flex gap-5 text-xs text-ink-700">
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_pinned: event.target.checked,
                    }))
                  }
                />{" "}
                Pin
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_published: event.target.checked,
                    }))
                  }
                />{" "}
                Publish now
              </label>
                </div>
              </div>
            )}
            </CreationWizard>
          </form>
        </FormPanel>
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              <Megaphone className="mx-auto mb-2 text-ink-300" />
              Announcements will appear here.
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {rows.map((row) => (
                <article key={row.id} className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-ink-900">{row.title}</h3>
                    {row.is_pinned && (
                      <span className="badge-warning">Pinned</span>
                    )}
                    <span
                      className={
                        row.is_published ? "badge-success" : "badge-neutral"
                      }
                    >
                      {row.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{row.body}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    {row.cohort.course.title} · {row.cohort.name} ·{" "}
                    {formatDate(row.published_at)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

export function AdminSettings() {
  const [databaseStatus, setDatabaseStatus] = useState<
    "checking" | "ready" | "pending" | "unknown"
  >("checking");
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    from_email: "academy@synergybahamas.com",
    from_name: "Synergy Academy",
    reply_to: "info@synergybahamas.com",
  });
  const [emailAvailable, setEmailAvailable] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  useEffect(() => {
    void (async () => {
      const [probe, emailResult] = await Promise.all([
        supabase.rpc("verify_certificate", {
          certificate_code: "settings-readiness-probe",
        }),
        supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "email_delivery")
          .maybeSingle(),
      ]);
      const probeError = probe.error;
      if (!probeError) setDatabaseStatus("ready");
      else if (
        probeError.message.toLowerCase().includes("verify_certificate") &&
        (probeError.message.toLowerCase().includes("schema cache") ||
          probeError.message.toLowerCase().includes("does not exist"))
      )
        setDatabaseStatus("pending");
      else setDatabaseStatus("unknown");
      if (emailResult.error) setEmailAvailable(false);
      else {
        const emailValue = emailResult.data?.value;
        if (emailValue)
          setEmailSettings((current) => ({ ...current, ...emailValue }));
      }
    })();
  }, []);
  const saveEmailSettings = async (event: FormEvent) => {
    event.preventDefault();
    setEmailSaving(true);
    setEmailMessage("");
    const { data, error: settingsError } = await supabase.rpc(
      "update_email_delivery_settings",
      {
        delivery_enabled: emailSettings.enabled,
        sender_email: emailSettings.from_email,
        sender_name: emailSettings.from_name,
        reply_address: emailSettings.reply_to,
      },
    );
    if (settingsError) setEmailMessage(settingsError.message);
    else {
      setEmailSettings(data as typeof emailSettings);
      setEmailMessage(
        emailSettings.enabled
          ? "Email delivery is enabled. SMTP2GO requests will now be sent from server-side functions."
          : "Email delivery is disabled. All application emails and password-reset requests are suppressed.",
      );
    }
    setEmailSaving(false);
  };
  const databaseLabel =
    databaseStatus === "checking"
      ? "Checking"
      : databaseStatus === "ready"
        ? "Ready"
        : databaseStatus === "pending"
          ? "Migration required"
          : "Unable to verify";
  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        subtitle="Authentication, database readiness, and the controlled publishing workflow."
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
        <section className="page-section overflow-hidden">
          <div className="border-b border-ink-100 bg-brand-50/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <Cloud size={17} className="text-brand-700" />
              <h2 className="font-display text-sm font-semibold text-ink-950">
                Academy environment
              </h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-600">
              Live checks use the configured Bolt Supabase project. Production publishing remains manual.
            </p>
          </div>
          <div className="grid gap-px bg-ink-100 sm:grid-cols-3">
            <EnvironmentStatus
              icon={<ShieldCheck size={17} />}
              label="Authentication"
              value="Configured"
              tone="ready"
            />
            <EnvironmentStatus
              icon={<Database size={17} />}
              label="Database"
              value={databaseLabel}
              tone={databaseStatus === "ready" ? "ready" : databaseStatus === "pending" ? "warning" : "neutral"}
            />
            <EnvironmentStatus
              icon={<Globe2 size={17} />}
              label="Production"
              value="Manual publish"
              tone="neutral"
            />
          </div>
        </section>

        <section className="page-section p-5 lg:row-span-2">
          <h2 className="font-display text-sm font-semibold text-ink-950">
            Release workflow
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            Follow this sequence to keep code, database, and production aligned.
          </p>
          <ol className="mt-5 space-y-4">
            {[
              ["Verify locally", "Run typecheck, lint, build, and role-based acceptance tests."],
              ["Sync GitHub", "Push reviewed application and migration changes. Prompts remain local."],
              ["Apply database changes", "Run all pending migrations through 014 and confirm the schema cache refreshes."],
              ["Publish production", "Use the manual Bolt publish workflow for academy.synergybahamas.com."],
            ].map(([title, description], index) => (
              <li key={title} className="grid grid-cols-[1.75rem_1fr] gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-ink-900">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="page-section p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={17} className="text-brand-700" />
            <h2 className="font-display text-sm font-semibold text-ink-950">Access model</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-600">
            One account can hold student, instructor, and administrator roles. Workspace switching happens after sign-in, while Supabase RLS enforces every data boundary.
          </p>
        </section>

        <section className="page-section overflow-hidden lg:col-span-2">
          <div className={`border-b px-5 py-4 ${emailSettings.enabled ? "border-success-200 bg-success-50" : "border-warning-200 bg-warning-50"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${emailSettings.enabled ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-800"}`}>
                  <Power size={17} />
                </span>
                <div>
                  <h2 className="font-display text-sm font-semibold text-ink-950">Email delivery kill switch</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-600">
                    {emailSettings.enabled ? "Live: announcements, reminders, invitations, welcomes, and password resets may send." : "Testing mode: application email and password-reset requests are blocked."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailSettings.enabled}
                disabled={!emailAvailable}
                onClick={() => setEmailSettings((current) => ({ ...current, enabled: !current.enabled }))}
                className={`relative h-8 w-14 rounded-full transition-colors ${emailSettings.enabled ? "bg-success-600" : "bg-ink-300"}`}
              >
                <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${emailSettings.enabled ? "translate-x-6" : "translate-x-0"}`} />
                <span className="sr-only">Toggle email delivery</span>
              </button>
            </div>
          </div>
          <form onSubmit={saveEmailSettings} className="grid gap-4 p-5 md:grid-cols-3 md:items-end">
            <Field label="Sender name">
              <input className="input" value={emailSettings.from_name} onChange={(event) => setEmailSettings((current) => ({ ...current, from_name: event.target.value }))} />
            </Field>
            <Field label="Sender email">
              <input required type="email" className="input" value={emailSettings.from_email} onChange={(event) => setEmailSettings((current) => ({ ...current, from_email: event.target.value }))} />
            </Field>
            <Field label="Reply-to email">
              <input required type="email" className="input" value={emailSettings.reply_to} onChange={(event) => setEmailSettings((current) => ({ ...current, reply_to: event.target.value }))} />
            </Field>
            <div className="md:col-span-2">
              {!emailAvailable ? (
                <p className="text-xs leading-5 text-warning-800">Apply migration 014 before configuring email. SMTP2GO credentials remain in the server-side Edge Function secret store.</p>
              ) : emailMessage ? (
                <p className="text-xs leading-5 text-ink-600">{emailMessage}</p>
              ) : (
                <p className="flex items-center gap-2 text-xs leading-5 text-ink-500"><Mail size={14} /> The API key is never sent to the browser or stored in this table.</p>
              )}
            </div>
            <div className="flex justify-end">
              <SubmitButton loading={emailSaving} disabled={!emailAvailable}>Save email settings</SubmitButton>
            </div>
          </form>
        </section>
      </div>
    </AppLayout>
  );
}

function EnvironmentStatus({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "ready" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "ready"
      ? "bg-success-50 text-success-700"
      : tone === "warning"
        ? "bg-warning-50 text-warning-800"
        : "bg-ink-100 text-ink-600";
  return (
    <div className="bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-ink-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={`mt-3 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}
