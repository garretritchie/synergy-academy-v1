import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BarChart3,
  CheckCircle2,
  Cloud,
  Database,
  Globe2,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DirectMessagesPanel } from "@/components/communication/DirectMessagesPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { formatDate, fullName } from "@/lib/format";
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
    const { error: insertError } = await supabase.from("announcements").insert({
      ...form,
      author_id: user?.id,
      published_at: form.is_published ? new Date().toISOString() : null,
    });
    if (insertError) setError(insertError.message);
    else {
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

export function AdminReporting() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [certificates, setCertificates] = useState<
    Array<{
      id: string;
      certificate_number: string;
      issued_date: string;
      status: "issued" | "revoked";
      revocation_reason: string | null;
      student: {
        first_name: string | null;
        last_name: string | null;
        email: string;
      };
      course: { title: string };
    }>
  >([]);
  const [revokingId, setRevokingId] = useState("");
  const [revocationReason, setRevocationReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
      setLoading(true);
      const tables = [
        "profiles",
        "courses",
        "cohorts",
        "enrolments",
        "live_sessions",
        "submissions",
        "certificates",
      ];
      const [results, certificateResult] = await Promise.all([
        Promise.all(tables.map((table) =>
          supabase.from(table).select("*", { count: "exact", head: true }),
        )),
        supabase
          .from("certificates")
          .select(
            "id,certificate_number,issued_date,status,revocation_reason,student:profiles!certificates_student_id_fkey(first_name,last_name,email),course:courses(title)",
          )
          .order("issued_date", { ascending: false })
          .limit(20),
      ]);
      const failed = results.find((result) => result.error) || certificateResult;
      if (failed?.error) setError(failed.error.message);
      else {
        setCounts(
          Object.fromEntries(
            tables.map((table, index) => [table, results[index].count ?? 0]),
          ),
        );
        setCertificates(
          (certificateResult.data ?? []) as unknown as typeof certificates,
        );
      }
      setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const revokeCertificate = async (certificateId: string) => {
    if (!user || !revocationReason.trim()) return;
    const { error: updateError } = await supabase
      .from("certificates")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revocation_reason: revocationReason.trim(),
      })
      .eq("id", certificateId);
    if (updateError) setError(updateError.message);
    else {
      setRevokingId("");
      setRevocationReason("");
      await load();
    }
  };
  const labels: Record<string, string> = {
    profiles: "Accounts",
    courses: "Courses",
    cohorts: "Cohorts",
    enrolments: "Enrolments",
    live_sessions: "Live sessions",
    submissions: "Submissions",
    certificates: "Certificates",
  };
  return (
    <AppLayout>
      <PageHeader
        title="Reporting"
        subtitle="A live operational snapshot from the academy database."
      />
      <div className="mt-6 space-y-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(counts).map(([key, value]) => (
              <div key={key} className="rounded-xl bg-white p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-500">{labels[key]}</p>
                  <BarChart3 size={17} className="text-brand-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-ink-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
        {!loading && certificates.length > 0 && (
          <section className="overflow-hidden rounded-xl bg-white shadow-soft">
            <div className="border-b border-ink-100 px-5 py-4">
              <h2 className="font-semibold text-ink-900">Recent certificates</h2>
              <p className="mt-1 text-xs text-ink-500">
                Revoke an issued record only when it was created in error; the change is audited.
              </p>
            </div>
            <div className="divide-y divide-ink-100">
              {certificates.map((certificate) => (
                <article key={certificate.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-ink-900">
                        {fullName(certificate.student) || certificate.student.email}
                      </h3>
                      <p className="text-xs text-ink-500">
                        {certificate.course.title} · {certificate.certificate_number} · {formatDate(certificate.issued_date)}
                      </p>
                    </div>
                    <span className={certificate.status === "revoked" ? "badge-danger" : "badge-success"}>
                      {certificate.status}
                    </span>
                    {certificate.status === "issued" && (
                      <button
                        type="button"
                        className="btn-ghost text-danger-700"
                        onClick={() => setRevokingId(certificate.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                  {certificate.status === "revoked" && certificate.revocation_reason && (
                    <p className="mt-2 text-xs text-danger-700">
                      {certificate.revocation_reason}
                    </p>
                  )}
                  {revokingId === certificate.id && (
                    <div className="mt-3 grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label="Revocation reason">
                        <input
                          className="input"
                          value={revocationReason}
                          onChange={(event) => setRevocationReason(event.target.value)}
                        />
                      </Field>
                      <button
                        type="button"
                        className="btn-primary !bg-danger-600 hover:!bg-danger-700"
                        disabled={!revocationReason.trim()}
                        onClick={() => void revokeCertificate(certificate.id)}
                      >
                        Confirm revocation
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

export function AdminSettings() {
  const [databaseStatus, setDatabaseStatus] = useState<
    "checking" | "ready" | "pending" | "unknown"
  >("checking");
  useEffect(() => {
    void (async () => {
      const { error: probeError } = await supabase.rpc("verify_certificate", {
        certificate_code: "settings-readiness-probe",
      });
      if (!probeError) setDatabaseStatus("ready");
      else if (
        probeError.message.toLowerCase().includes("verify_certificate") &&
        (probeError.message.toLowerCase().includes("schema cache") ||
          probeError.message.toLowerCase().includes("does not exist"))
      )
        setDatabaseStatus("pending");
      else setDatabaseStatus("unknown");
    })();
  }, []);
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
              ["Apply database changes", "Run migration 012 in Bolt Supabase and confirm the schema cache refreshes."],
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
