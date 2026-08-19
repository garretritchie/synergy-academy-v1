import { useEffect, useState } from "react";
import { Building2, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { EmptyState } from "@/components/ui/Spinner";
import { formatDate, fullName } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Course, Profile } from "@/types";

type ContractRow = {
  id: string;
  seat_limit: number;
  starts_at: string;
  ends_at: string;
  status: string;
  organization: { name: string; primary_contact: Profile | null };
  offering: { name: string; access_scope: string; course: { title: string } | null };
  seat_assignments: Array<{ id: string; status: string }>;
};

const today = () => new Date().toISOString().slice(0, 10);
const futureDate = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
};

export function AdminAccess() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    organization_name: "",
    organization_slug: "",
    contact_user_uuid: "",
    offering_name: "",
    offering_scope: "course",
    offering_course_uuid: "",
    offering_commerce_model: "subscription",
    offering_term_months: 6,
    contract_seat_limit: 5,
    contract_starts_at: today(),
    contract_ends_at: futureDate(6),
    activate_contract: true,
  });

  const load = async () => {
    setLoading(true);
    const [profileResult, courseResult, contractResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_active", true).order("email"),
      supabase.from("courses").select("*").order("title"),
      supabase
        .from("access_contracts")
        .select(
          "id,seat_limit,starts_at,ends_at,status,organization:organizations(name,primary_contact:profiles!organizations_primary_contact_id_fkey(*)),offering:access_offerings(name,access_scope,course:courses(title)),seat_assignments(id,status)",
        )
        .order("created_at", { ascending: false }),
    ]);
    const requiredError = profileResult.error || courseResult.error;
    if (requiredError) setError(requiredError.message);
    else {
      setProfiles((profileResult.data ?? []) as Profile[]);
      setCourses((courseResult.data ?? []) as Course[]);
      if (contractResult.error) {
        const missing = contractResult.error.message.toLowerCase().includes("schema cache");
        setError(
          missing
            ? "Organization access is not enabled in the connected database yet. Apply migration 013, then refresh this page."
            : contractResult.error.message,
        );
      } else setContracts((contractResult.data ?? []) as unknown as ContractRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("create_organization_contract", {
      ...form,
      offering_course_uuid:
        form.offering_scope === "course" ? form.offering_course_uuid : null,
      contract_starts_at: new Date(`${form.contract_starts_at}T00:00:00`).toISOString(),
      contract_ends_at: new Date(`${form.contract_ends_at}T23:59:59`).toISOString(),
    });
    if (rpcError) setError(rpcError.message);
    else {
      setOpen(false);
      setStep(0);
      setForm({
        organization_name: "",
        organization_slug: "",
        contact_user_uuid: "",
        offering_name: "",
        offering_scope: "course",
        offering_course_uuid: "",
        offering_commerce_model: "subscription",
        offering_term_months: 6,
        contract_seat_limit: 5,
        contract_starts_at: today(),
        contract_ends_at: futureDate(6),
        activate_contract: true,
      });
      await load();
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Access & organizations"
        subtitle="Configure company contacts, course or platform terms, and capped learner seats."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title="Create organization access"
          description="The main contact receives a company-seat workspace without platform-administrator privileges."
          open={open}
          onToggle={() => {
            setOpen(!open);
            setStep(0);
          }}
          actionLabel="New organization plan"
        >
          <form onSubmit={save}>
            {error && <Alert>{error}</Alert>}
            <CreationWizard
              steps={["Add organization", "Choose access", "Set contract"]}
              currentStep={step}
              canContinue={
                step === 0
                  ? Boolean(
                      form.organization_name.trim() &&
                        form.organization_slug.trim() &&
                        form.contact_user_uuid,
                    )
                  : step === 1
                    ? Boolean(
                        form.offering_name.trim() &&
                          (form.offering_scope === "platform" ||
                            form.offering_course_uuid),
                      )
                    : Boolean(
                        form.contract_seat_limit > 0 &&
                          form.contract_starts_at &&
                          form.contract_ends_at,
                      )
              }
              saving={saving}
              finalAction="Create access contract"
              onBack={() => setStep((current) => Math.max(0, current - 1))}
              onNext={() => setStep((current) => Math.min(2, current + 1))}
            >
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Organization name">
                    <input
                      required
                      className="input"
                      value={form.organization_name}
                      onChange={(event) => {
                        const name = event.target.value;
                        setForm((current) => ({
                          ...current,
                          organization_name: name,
                          organization_slug: name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, ""),
                        }));
                      }}
                    />
                  </Field>
                  <Field label="Account key">
                    <input
                      required
                      className="input"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={form.organization_slug}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          organization_slug: event.target.value.toLowerCase(),
                        }))
                      }
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Main point of contact">
                      <select
                        required
                        className="input"
                        value={form.contact_user_uuid}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            contact_user_uuid: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select an existing account</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {fullName(profile)} ({profile.email})
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plan name">
                    <input
                      required
                      className="input"
                      placeholder="Business Essentials team access"
                      value={form.offering_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          offering_name: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Access scope">
                    <select
                      className="input"
                      value={form.offering_scope}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          offering_scope: event.target.value,
                        }))
                      }
                    >
                      <option value="course">Single course</option>
                      <option value="platform">Entire platform</option>
                    </select>
                  </Field>
                  {form.offering_scope === "course" && (
                    <Field label="Course">
                      <select
                        required
                        className="input"
                        value={form.offering_course_uuid}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            offering_course_uuid: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select course</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="Purchase model">
                    <select
                      className="input"
                      value={form.offering_commerce_model}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          offering_commerce_model: event.target.value,
                        }))
                      }
                    >
                      <option value="subscription">Membership subscription</option>
                      <option value="one_time">One-off term</option>
                    </select>
                  </Field>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Term">
                    <select
                      className="input"
                      value={form.offering_term_months}
                      onChange={(event) => {
                        const months = Number(event.target.value);
                        setForm((current) => ({
                          ...current,
                          offering_term_months: months,
                          contract_ends_at: futureDate(months),
                        }));
                      }}
                    >
                      <option value="3">3 months</option>
                      <option value="6">6 months</option>
                      <option value="12">12 months</option>
                    </select>
                  </Field>
                  <Field label="Seat cap">
                    <input
                      type="number"
                      min="1"
                      required
                      className="input"
                      value={form.contract_seat_limit}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contract_seat_limit: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Starts">
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.contract_starts_at}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contract_starts_at: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Ends">
                    <input
                      type="date"
                      required
                      className="input"
                      value={form.contract_ends_at}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contract_ends_at: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2 lg:col-span-4">
                    <input
                      type="checkbox"
                      checked={form.activate_contract}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          activate_contract: event.target.checked,
                        }))
                      }
                    />
                    Activate access immediately
                  </label>
                </div>
              )}
            </CreationWizard>
          </form>
        </FormPanel>

        {loading ? (
          <div className="rounded-xl bg-white shadow-soft"><TableSkeleton /></div>
        ) : contracts.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<Building2 size={30} />}
              title="No organization contracts"
              description="Create a company plan to designate its contact and seat cap."
            />
          </div>
        ) : (
          <div className="divide-y divide-ink-100 overflow-hidden rounded-xl bg-white shadow-soft">
            {contracts.map((contract) => {
              const used = contract.seat_assignments.filter((seat) => seat.status === "active").length;
              return (
                <article key={contract.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <Building2 size={18} className="text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-ink-900">{contract.organization.name}</h2>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {contract.offering.name} · through {formatDate(contract.ends_at)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                    <Users size={14} /> {used}/{contract.seat_limit} seats
                  </span>
                  <span className={contract.status === "active" ? "badge-success" : "badge-neutral"}>
                    {contract.status}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
