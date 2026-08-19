import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  ImageUp,
  Mail,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { PageTabs } from "@/components/ui/PageTabs";
import { CertificateRenderer } from "@/features/certificates/CertificateRenderer";
import { downloadCertificatePdf } from "@/features/certificates/pdf";
import {
  defaultCertificateDesign,
  type CertificateDesign,
  type CertificateTemplate,
  type CertificateType,
  type CertificateViewModel,
} from "@/features/certificates/types";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type CourseOption = {
  id: string;
  title: string;
  certificate_template_id: string | null;
  certificate_skills: string[];
};

type IssuedRow = {
  id: string;
  certificate_number: string;
  issued_date: string;
  status: "issued" | "revoked";
  revocation_reason: string | null;
  student_name_snapshot: string | null;
  course_title_snapshot: string | null;
  student: { first_name: string | null; last_name: string | null; email: string };
  course: { title: string };
};

type CertificateStatusFilter = "all" | "issued" | "revoked";
type CertificateSort = "newest" | "oldest" | "student" | "course";
type CertificateWorkspaceTab = "directory" | "templates";

const PAGE_SIZE = 25;
const CERTIFICATE_SELECT = "id,certificate_number,issued_date,status,revocation_reason,student_name_snapshot,course_title_snapshot,student:profiles!certificates_student_id_fkey(first_name,last_name,email),course:courses(title)";
const certificateSorts: Record<CertificateSort, { column: string; ascending: boolean }> = {
  newest: { column: "issued_date", ascending: false },
  oldest: { column: "issued_date", ascending: true },
  student: { column: "student_name_snapshot", ascending: true },
  course: { column: "course_title_snapshot", ascending: true },
};

function sanitizeCertificateSearch(value: string) {
  return value.replace(/[,%_()]/g, " ").replace(/\s+/g, " ").trim();
}

function dateAfter(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function studentName(certificate: IssuedRow) {
  return certificate.student_name_snapshot
    || [certificate.student.first_name, certificate.student.last_name].filter(Boolean).join(" ")
    || certificate.student.email;
}

function courseTitle(certificate: IssuedRow) {
  return certificate.course_title_snapshot || certificate.course.title;
}

const emptyTemplate = {
  name: "Synergy Blue Completion",
  description: "A branded landscape certificate for successful course completion.",
  certificate_type: "completion" as CertificateType,
  is_default: false,
  is_active: true,
  design: defaultCertificateDesign,
};

const sampleCertificate: CertificateViewModel = {
  certificate_number: "SYN-2026-DEMO4A7F92C1",
  student_name: "Alexandra Johnson",
  course_title: "Fundamentals of AI for Business Professionals",
  certificate_title: "Certificate of Completion",
  issued_date: new Date().toISOString(),
  status: "issued",
  final_grade: 94,
  letter_grade: "A",
  skills: ["AI fundamentals", "Responsible AI", "Prompt design", "Workplace automation"],
};

export function AdminCertificateManagement() {
  const { user } = useAuth();
  const previewRef = useRef<HTMLElement>(null);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [issued, setIssued] = useState<IssuedRow[]>([]);
  const [activeTab, setActiveTab] = useState<CertificateWorkspaceTab>("directory");
  const [loading, setLoading] = useState(true);
  const [issuedLoading, setIssuedLoading] = useState(true);
  const [issuedCount, setIssuedCount] = useState(0);
  const [issuedTotals, setIssuedTotals] = useState({ issued: 0, revoked: 0 });
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CertificateStatusFilter>("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [issuedFrom, setIssuedFrom] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [sort, setSort] = useState<CertificateSort>("newest");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTemplate);
  const [courseId, setCourseId] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [revocationReason, setRevocationReason] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    const [templateResult, courseResult] = await Promise.all([
      supabase.from("certificate_templates").select("*").order("is_default", { ascending: false }).order("name"),
      supabase.from("courses").select("id,title,certificate_template_id,certificate_skills").order("title"),
    ]);
    const firstError = templateResult.error || courseResult.error;
    if (firstError) setError(`${firstError.message}. Apply migration 015 to activate certificate templates.`);
    if (!templateResult.error) setTemplates((templateResult.data ?? []) as unknown as CertificateTemplate[]);
    if (!courseResult.error) setCourses((courseResult.data ?? []) as unknown as CourseOption[]);
    setLoading(false);
  }, []);

  const loadCertificateTotals = useCallback(async () => {
    const [issuedResult, revokedResult] = await Promise.all([
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("status", "issued"),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("status", "revoked"),
    ]);
    const totalsError = issuedResult.error || revokedResult.error;
    if (totalsError) {
      setError(`${totalsError.message}. Apply migrations 015 and 016 to activate the certificate directory.`);
      return;
    }
    setIssuedTotals({ issued: issuedResult.count ?? 0, revoked: revokedResult.count ?? 0 });
  }, []);

  const loadIssued = useCallback(async () => {
    setIssuedLoading(true);
    setError("");
    const safeSearch = sanitizeCertificateSearch(debouncedSearch);
    const rangeStart = (page - 1) * PAGE_SIZE;
    const sortConfig = certificateSorts[sort];
    let query = supabase
      .from("certificates")
      .select(CERTIFICATE_SELECT, { count: "exact" });

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (courseFilter) query = query.eq("course_id", courseFilter);
    if (issuedFrom) query = query.gte("issued_date", `${issuedFrom}T00:00:00`);
    if (issuedTo) query = query.lt("issued_date", `${dateAfter(issuedTo)}T00:00:00`);
    if (safeSearch) {
      query = query.or(
        `certificate_number.ilike.%${safeSearch}%,student_name_snapshot.ilike.%${safeSearch}%,course_title_snapshot.ilike.%${safeSearch}%`,
      );
    }

    const result = await query
      .order(sortConfig.column, { ascending: sortConfig.ascending, nullsFirst: false })
      .order("id", { ascending: sortConfig.ascending })
      .range(rangeStart, rangeStart + PAGE_SIZE - 1);

    if (result.error) {
      setError(`${result.error.message}. Apply migrations 015 and 016 to activate the certificate directory.`);
      setIssued([]);
      setIssuedCount(0);
    } else {
      setIssued((result.data ?? []) as unknown as IssuedRow[]);
      setIssuedCount(result.count ?? 0);
    }
    setIssuedLoading(false);
  }, [courseFilter, debouncedSearch, issuedFrom, issuedTo, page, sort, statusFilter]);

  useEffect(() => {
    void Promise.all([loadCatalog(), loadCertificateTotals()]);
  }, [loadCatalog, loadCertificateTotals]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => { void loadIssued(); }, [loadIssued]);

  const totalPages = Math.max(1, Math.ceil(issuedCount / PAGE_SIZE));
  const resultStart = issuedCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const resultEnd = Math.min(page * PAGE_SIZE, issuedCount);
  const filtersActive = Boolean(debouncedSearch || statusFilter !== "all" || courseFilter || issuedFrom || issuedTo);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setRevokingId("");
    setRevocationReason("");
  }, [courseFilter, debouncedSearch, issuedFrom, issuedTo, page, sort, statusFilter]);

  const preview = useMemo<CertificateViewModel>(() => ({
    ...sampleCertificate,
    template: { design: form.design },
  }), [form.design]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyTemplate, design: { ...defaultCertificateDesign } });
    setCourseId("");
    setSkillsText("");
    setBackgroundFile(null);
    setLogoFile(null);
    setStep(0);
    setNotice("");
  };

  const editTemplate = (template: CertificateTemplate) => {
    setActiveTab("templates");
    setEditingId(template.id);
    setForm({
      name: template.name,
      description: template.description ?? "",
      certificate_type: template.certificate_type,
      is_default: template.is_default,
      is_active: template.is_active,
      design: { ...defaultCertificateDesign, ...template.design },
    });
    const assignedCourse = courses.find((course) => course.certificate_template_id === template.id);
    setCourseId(assignedCourse?.id ?? "");
    setSkillsText((assignedCourse?.certificate_skills ?? []).join("\n"));
    setStep(0);
    setPanelOpen(true);
    setError("");
  };

  const updateDesign = <K extends keyof CertificateDesign>(key: K, value: CertificateDesign[K]) => {
    setForm((current) => ({ ...current, design: { ...current.design, [key]: value } }));
  };

  const uploadAsset = async (file: File, kind: "background" | "logo") => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `templates/${editingId || crypto.randomUUID()}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("certificate-assets").upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    return path;
  };

  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const existing = templates.find((template) => template.id === editingId);
      const backgroundPath = backgroundFile ? await uploadAsset(backgroundFile, "background") : existing?.background_path ?? null;
      const logoPath = logoFile ? await uploadAsset(logoFile, "logo") : existing?.logo_path ?? null;
      const payload = { ...form, background_path: backgroundPath, logo_path: logoPath, created_by: user.id };
      const result = editingId
        ? await supabase.from("certificate_templates").update(payload).eq("id", editingId).select("id").single()
        : await supabase.from("certificate_templates").insert(payload).select("id").single();
      if (result.error) throw result.error;
      if (courseId) {
        const skills = skillsText.split(/\n|,/).map((skill) => skill.trim()).filter(Boolean).slice(0, 12);
        const { error: courseError } = await supabase.from("courses").update({ certificate_template_id: result.data.id, certificate_skills: skills }).eq("id", courseId);
        if (courseError) throw courseError;
      }
      setNotice(editingId ? "Certificate template updated." : "Certificate template created and ready to use.");
      setPanelOpen(false);
      resetForm();
      await loadCatalog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the certificate template");
    } finally { setSaving(false); }
  };

  const deleteTemplate = async (template: CertificateTemplate) => {
    if (!window.confirm(`Delete “${template.name}”? Issued certificates will keep their saved design snapshot.`)) return;
    const { error: deleteError } = await supabase.from("certificate_templates").delete().eq("id", template.id);
    if (deleteError) setError(deleteError.message); else await loadCatalog();
  };

  const revokeCertificate = async (certificateId: string) => {
    if (!revocationReason.trim()) return;
    const { error: updateError } = await supabase.from("certificates").update({ status: "revoked", revocation_reason: revocationReason.trim(), revoked_at: new Date().toISOString(), revoked_by: user?.id }).eq("id", certificateId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setRevokingId("");
      setRevocationReason("");
      await Promise.all([loadIssued(), loadCertificateTotals()]);
    }
  };

  const emailCertificate = async (certificateId: string) => {
    setNotice("");
    const { data, error: emailError } = await supabase.functions.invoke("academy-email", { body: { type: "certificate", certificate_id: certificateId } });
    setNotice(emailError ? emailError.message : data?.message || "Certificate email request processed.");
  };

  const copyVerificationLink = async (certificateNumber: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/verify/${certificateNumber}`);
    setNotice("Public verification link copied.");
  };

  const resetCertificateFilters = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setCourseFilter("");
    setIssuedFrom("");
    setIssuedTo("");
    setSort("newest");
    setPage(1);
  };

  const certificateBeingRevoked = issued.find((certificate) => certificate.id === revokingId);

  return (
    <AppLayout>
      <PageHeader title="Certificates & credentials" subtitle="Design reusable templates, choose the skills employers see, and manage issued credentials." actions={<Link className="btn-secondary" to="/verify" target="_blank"><ShieldCheck size={15} /> Public verifier</Link>} />
      <div className="mt-6 space-y-6">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Active templates" value={templates.filter((item) => item.is_active).length} />
          <Metric label="Issued certificates" value={issuedTotals.issued} />
          <Metric label="Revoked" value={issuedTotals.revoked} />
        </div>

        <PageTabs
          ariaLabel="Certificate management views"
          baseId="certificate-workspace"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { id: "directory", label: "Issued directory", icon: <Award size={15} />, count: issuedTotals.issued + issuedTotals.revoked },
            { id: "templates", label: "Templates & setup", icon: <ImageUp size={15} />, count: templates.filter((item) => item.is_active).length },
          ]}
        />

        {activeTab === "templates" && (
          <div
            id="certificate-workspace-templates-panel"
            role="tabpanel"
            aria-labelledby="certificate-workspace-templates-tab"
            className="space-y-6 motion-safe:animate-fade-in"
          >
        <FormPanel title="Certificate template studio" description="A guided setup for branding, wording, automatic issuance, and public skills." open={panelOpen} actionLabel="Create template" onToggle={() => { if (panelOpen) resetForm(); setPanelOpen((value) => !value); }}>
          <form onSubmit={saveTemplate}>
            <CreationWizard steps={["Template basics", "Design & branding", "Issuance & preview"]} currentStep={step} canContinue={step === 0 ? Boolean(form.name.trim()) : true} saving={saving} finalAction={editingId ? "Save changes" : "Create template"} onBack={() => setStep((value) => Math.max(0, value - 1))} onNext={() => setStep((value) => Math.min(2, value + 1))}>
              {step === 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Template name"><input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
                  <Field label="Credential type"><select className="input" value={form.certificate_type} onChange={(event) => setForm((current) => ({ ...current, certificate_type: event.target.value as CertificateType }))}><option value="completion">Course completion</option><option value="attendance">Attendance</option><option value="achievement">Achievement</option></select></Field>
                  <div className="md:col-span-2"><Field label="Internal description"><textarea className="input min-h-20" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field></div>
                  <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} /> Make this the default for new completions</label>
                  <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Template is available for use</label>
                </div>
              )}
              {step === 1 && (
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="grid content-start gap-4 sm:grid-cols-2">
                    <Field label="Main title"><input className="input" value={form.design.title} onChange={(event) => updateDesign("title", event.target.value)} /></Field>
                    <Field label="Subtitle"><input className="input" value={form.design.subtitle} onChange={(event) => updateDesign("subtitle", event.target.value)} /></Field>
                    <Field label="Presented wording"><input className="input" value={form.design.presented_text} onChange={(event) => updateDesign("presented_text", event.target.value)} /></Field>
                    <Field label="Completion wording"><input className="input" value={form.design.completion_text} onChange={(event) => updateDesign("completion_text", event.target.value)} /></Field>
                    <Field label="Accent colour"><input className="input h-11 p-1" type="color" value={form.design.accent_color} onChange={(event) => updateDesign("accent_color", event.target.value)} /></Field>
                    <Field label="Heading colour"><input className="input h-11 p-1" type="color" value={form.design.navy_color} onChange={(event) => updateDesign("navy_color", event.target.value)} /></Field>
                    <Field label="Signature name"><input className="input" value={form.design.signer_one_name} onChange={(event) => updateDesign("signer_one_name", event.target.value)} /></Field>
                    <Field label="Signature title"><input className="input" value={form.design.signer_one_title} onChange={(event) => updateDesign("signer_one_title", event.target.value)} /></Field>
                    <Field label="Upload background" hint="Optional PNG, JPG, WebP or SVG up to 20 MB."><input className="input py-2" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)} /></Field>
                    <Field label="Upload alternate logo" hint="Leave blank to use the Synergy Bahamas logo."><input className="input py-2" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} /></Field>
                    <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.design.show_signatures} onChange={(event) => updateDesign("show_signatures", event.target.checked)} /> Show signature area</label>
                    <button type="button" className="btn-ghost justify-self-start" onClick={() => setForm((current) => ({ ...current, design: { ...defaultCertificateDesign } }))}><RotateCcw size={15} /> Reset design</button>
                  </div>
                  <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Live preview</p><button type="button" className="btn-ghost" onClick={async () => { if (!previewRef.current) return; setNotice(""); try { await downloadCertificatePdf(previewRef.current, sampleCertificate.certificate_number); setNotice("Demo certificate PDF generated."); } catch (pdfError) { setError(pdfError instanceof Error ? pdfError.message : "PDF generation failed"); } }}><Download size={14} /> Test PDF</button></div><div className="overflow-hidden rounded-xl bg-ink-100 p-3"><div className="mx-auto w-full max-w-[720px] shadow-card"><CertificateRenderer ref={previewRef} certificate={preview} /></div></div></div>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="space-y-4">
                    <Field label="Assign to a course" hint="Optional. Courses without a selection use the default completion template."><select className="input" value={courseId} onChange={(event) => { const selected = courses.find((course) => course.id === event.target.value); setCourseId(event.target.value); setSkillsText((selected?.certificate_skills ?? []).join("\n")); }}><option value="">Use as an unassigned template</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></Field>
                    <Field label="Skills and key topics" hint="One per line. These appear on public verification and, if enabled, the certificate."><textarea className="input min-h-36" value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder={"AI fundamentals\nResponsible AI\nPrompt design"} /></Field>
                    <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.design.show_skills} onChange={(event) => updateDesign("show_skills", event.target.checked)} /> Show skills on certificate</label>
                    <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" checked={form.design.show_grade} onChange={(event) => updateDesign("show_grade", event.target.checked)} /> Show final grade publicly</label>
                    <Alert tone="info">Certificates are created automatically when an enrolment is marked complete. Issued records keep a snapshot of this design and the course skills.</Alert>
                  </div>
                  <div className="overflow-hidden rounded-xl bg-ink-100 p-3"><div className="mx-auto w-full max-w-[780px] shadow-card"><CertificateRenderer certificate={{ ...preview, skills: skillsText.split(/\n|,/).map((item) => item.trim()).filter(Boolean) }} /></div></div>
                </div>
              )}
            </CreationWizard>
          </form>
        </FormPanel>

        <section className="rounded-xl border border-ink-100 bg-white shadow-soft">
          <div className="border-b border-ink-100 px-5 py-4"><h2 className="font-display font-semibold text-ink-900">Templates</h2><p className="mt-1 text-xs text-ink-500">Create as many certificate styles as you need for different courses and programs.</p></div>
          {loading ? <TableSkeleton /> : templates.length === 0 ? (
            <div className="p-6 text-center"><ImageUp className="mx-auto text-brand-600" /><p className="mt-3 font-semibold text-ink-900">Start with the Synergy demo template</p><p className="mt-1 text-sm text-ink-500">Migration 015 creates a default completion template, or you can create one above.</p></div>
          ) : (
            <div className="grid gap-4 p-5 lg:grid-cols-2">{templates.map((template) => (
              <article key={template.id} className="rounded-xl border border-ink-200 p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Award size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink-900">{template.name}</h3>{template.is_default && <span className="badge bg-brand-50 text-brand-700"><Check size={11} /> Default</span>}{!template.is_active && <span className="badge bg-ink-100 text-ink-600">Inactive</span>}</div><p className="mt-1 text-xs text-ink-500">{template.description}</p><p className="mt-2 text-xs font-medium capitalize text-ink-600">{template.certificate_type} certificate</p><div className="mt-4 flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => editTemplate(template)}><Pencil size={14} /> Edit</button><button className="btn-ghost text-danger-700" disabled={template.is_default} onClick={() => void deleteTemplate(template)}><Trash2 size={14} /> Delete</button></div></div></div></article>
            ))}</div>
          )}
        </section>

          </div>
        )}

        {activeTab === "directory" && (
        <section
          id="certificate-workspace-directory-panel"
          role="tabpanel"
          aria-labelledby="certificate-workspace-directory-tab"
          className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft motion-safe:animate-fade-in"
        >
          <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="issued-certificates-title" className="font-display font-semibold text-ink-900">Issued certificate directory</h2>
              <p className="mt-1 text-xs text-ink-500">Search, review, email, verify, or revoke every credential from one scalable directory.</p>
            </div>
            <span className="badge-neutral self-start">{(issuedTotals.issued + issuedTotals.revoked).toLocaleString()} total records</span>
          </div>

          <div className="border-b border-ink-100 bg-gradient-to-b from-ink-50/80 to-white px-5 py-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-700">
              <SlidersHorizontal size={15} className="text-brand-700" />
              Search and filters
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(16rem,1.5fr)_9rem_minmax(12rem,1fr)_9.5rem_9.5rem_10.5rem]">
              <label className="block">
                <span className="sr-only">Search certificates</span>
                <span className="relative block">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="search"
                    className="input pl-10"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Name, course, or certificate code"
                  />
                </span>
              </label>
              <label>
                <span className="sr-only">Certificate status</span>
                <select className="input" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as CertificateStatusFilter); setPage(1); }}>
                  <option value="all">All statuses</option>
                  <option value="issued">Issued</option>
                  <option value="revoked">Revoked</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Course</span>
                <select className="input" value={courseFilter} onChange={(event) => { setCourseFilter(event.target.value); setPage(1); }}>
                  <option value="">All courses</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Issued from</span>
                <input className="input" type="date" value={issuedFrom} onChange={(event) => { setIssuedFrom(event.target.value); setPage(1); }} title="Issued from" />
              </label>
              <label>
                <span className="sr-only">Issued through</span>
                <input className="input" type="date" value={issuedTo} min={issuedFrom || undefined} onChange={(event) => { setIssuedTo(event.target.value); setPage(1); }} title="Issued through" />
              </label>
              <label>
                <span className="sr-only">Sort certificates</span>
                <select className="input" value={sort} onChange={(event) => { setSort(event.target.value as CertificateSort); setPage(1); }}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="student">Student A-Z</option>
                  <option value="course">Course A-Z</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <p aria-live="polite">
                {issuedLoading ? "Updating results..." : `Showing ${resultStart.toLocaleString()}-${resultEnd.toLocaleString()} of ${issuedCount.toLocaleString()} matching records`}
              </p>
              {filtersActive && (
                <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800" onClick={resetCertificateFilters}>
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>
          </div>

          <div aria-busy={issuedLoading}>
            {issuedLoading ? (
              <TableSkeleton rows={6} />
            ) : issued.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Award className="mx-auto text-brand-500" size={28} />
                <p className="mt-3 font-semibold text-ink-900">{filtersActive ? "No certificates match these filters" : "No certificates issued yet"}</p>
                <p className="mt-1 text-sm text-ink-500">{filtersActive ? "Adjust or clear the search criteria to see more records." : "Certificates will appear here after eligible course completions."}</p>
                {filtersActive && <button type="button" className="btn-secondary mt-4" onClick={resetCertificateFilters}>Clear filters</button>}
              </div>
            ) : (
              <>
                <div className="hidden xl:block">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[25%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[17%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="px-5 py-3 text-xs">Student</th>
                        <th className="px-4 py-3 text-xs">Course</th>
                        <th className="px-4 py-3 text-xs">Issued</th>
                        <th className="px-4 py-3 text-xs">Status</th>
                        <th className="px-4 py-3 text-xs">Certificate code</th>
                        <th className="px-5 py-3 text-right text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {issued.map((certificate) => (
                        <tr key={certificate.id}>
                          <td className="px-5 py-3.5">
                            <p className="truncate font-semibold text-ink-900" title={studentName(certificate)}>{studentName(certificate)}</p>
                            <p className="mt-0.5 truncate text-xs text-ink-500" title={certificate.student.email}>{certificate.student.email}</p>
                          </td>
                          <td className="max-w-xs px-4 py-3.5 text-ink-700"><span className="line-clamp-2">{courseTitle(certificate)}</span></td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-ink-600">{formatDate(certificate.issued_date)}</td>
                          <td className="px-4 py-3.5"><CertificateStatus status={certificate.status} /></td>
                          <td className="px-4 py-3.5"><span className="block truncate whitespace-nowrap font-mono text-xs text-ink-600" title={certificate.certificate_number}>{certificate.certificate_number}</span></td>
                          <td className="px-3 py-3.5"><CertificateActions certificate={certificate} onCopy={copyVerificationLink} onEmail={emailCertificate} onRevoke={setRevokingId} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-ink-100 xl:hidden">
                  {issued.map((certificate) => (
                    <article key={certificate.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-ink-900">{studentName(certificate)}</h3>
                          <p className="mt-0.5 truncate text-xs text-ink-500">{certificate.student.email}</p>
                        </div>
                        <CertificateStatus status={certificate.status} />
                      </div>
                      <dl className="mt-3 grid gap-2 text-xs">
                        <div><dt className="font-semibold text-ink-500">Course</dt><dd className="mt-0.5 text-ink-700">{courseTitle(certificate)}</dd></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><dt className="font-semibold text-ink-500">Issued</dt><dd className="mt-0.5 text-ink-700">{formatDate(certificate.issued_date)}</dd></div>
                          <div><dt className="font-semibold text-ink-500">Code</dt><dd className="mt-0.5 truncate font-mono text-ink-700">{certificate.certificate_number}</dd></div>
                        </div>
                      </dl>
                      <div className="mt-3"><CertificateActions certificate={certificate} onCopy={copyVerificationLink} onEmail={emailCertificate} onRevoke={setRevokingId} mobile /></div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>

          {certificateBeingRevoked && (
            <div className="border-t border-danger-100 bg-danger-50/80 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor="revocation-reason">Revoke {certificateBeingRevoked.certificate_number}</label>
                  <input id="revocation-reason" className="input" value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} placeholder="Required revocation reason" autoFocus />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-danger" disabled={!revocationReason.trim()} onClick={() => void revokeCertificate(certificateBeingRevoked.id)}>Confirm revocation</button>
                  <button className="btn-secondary" onClick={() => { setRevokingId(""); setRevocationReason(""); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {issuedCount > 0 && !issuedLoading && (
            <div className="flex flex-col gap-3 border-t border-ink-100 bg-ink-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-500">Page {page.toLocaleString()} of {totalPages.toLocaleString()}</p>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary !min-h-9 px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={14} /> Previous</button>
                <button type="button" className="btn-secondary !min-h-9 px-3 py-1.5 text-xs" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </section>
        )}
      </div>
    </AppLayout>
  );
}

function CertificateStatus({ status }: { status: IssuedRow["status"] }) {
  return (
    <span className={status === "issued" ? "badge-success capitalize" : "badge-danger capitalize"}>
      {status}
    </span>
  );
}

function CertificateActions({
  certificate,
  onCopy,
  onEmail,
  onRevoke,
  mobile = false,
}: {
  certificate: IssuedRow;
  onCopy: (certificateNumber: string) => Promise<void>;
  onEmail: (certificateId: string) => Promise<void>;
  onRevoke: (certificateId: string) => void;
  mobile?: boolean;
}) {
  const className = mobile
    ? "btn-secondary !min-h-9 px-3 py-1.5 text-xs"
    : "btn-ghost !min-h-9 !w-9 p-0";

  return (
    <div className={`flex flex-wrap items-center gap-1 ${mobile ? "" : "justify-end"}`}>
      <Link className={className} to={`/verify/${certificate.certificate_number}`} target="_blank" rel="noreferrer" title="View certificate">
        <Eye size={15} />
        <span className={mobile ? "" : "sr-only"}>View</span>
      </Link>
      <button type="button" className={className} onClick={() => void onCopy(certificate.certificate_number)} title="Copy verification link">
        <Copy size={15} />
        <span className={mobile ? "" : "sr-only"}>Copy link</span>
      </button>
      {certificate.status === "issued" && (
        <button type="button" className={className} onClick={() => void onEmail(certificate.id)} title="Email certificate">
          <Mail size={15} />
          <span className={mobile ? "" : "sr-only"}>Email</span>
        </button>
      )}
      {certificate.status === "issued" && (
        <button type="button" className={`${className} text-danger-700 hover:bg-danger-50 hover:text-danger-800`} onClick={() => onRevoke(certificate.id)} title="Revoke certificate">
          <X size={15} />
          <span className={mobile ? "" : "sr-only"}>Revoke</span>
        </button>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-soft"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-2 font-display text-3xl font-semibold text-ink-900">{value}</p></div>;
}
