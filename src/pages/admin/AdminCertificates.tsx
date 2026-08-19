import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, Check, Copy, Download, Eye, ImageUp, Mail, Pencil, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CreationWizard } from "@/components/ui/CreationWizard";
import { Field, FormPanel } from "@/components/ui/FormPanel";
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
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [templateResult, courseResult, certificateResult] = await Promise.all([
      supabase.from("certificate_templates").select("*").order("is_default", { ascending: false }).order("name"),
      supabase.from("courses").select("id,title,certificate_template_id,certificate_skills").order("title"),
      supabase.from("certificates").select("id,certificate_number,issued_date,status,revocation_reason,student_name_snapshot,course_title_snapshot,student:profiles!certificates_student_id_fkey(first_name,last_name,email),course:courses(title)").order("issued_date", { ascending: false }).limit(50),
    ]);
    const firstError = templateResult.error || courseResult.error || certificateResult.error;
    if (firstError) setError(`${firstError.message}. Apply migration 015 to activate certificate templates.`);
    if (!templateResult.error) setTemplates((templateResult.data ?? []) as unknown as CertificateTemplate[]);
    if (!courseResult.error) setCourses((courseResult.data ?? []) as unknown as CourseOption[]);
    if (!certificateResult.error) setIssued((certificateResult.data ?? []) as unknown as IssuedRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the certificate template");
    } finally { setSaving(false); }
  };

  const deleteTemplate = async (template: CertificateTemplate) => {
    if (!window.confirm(`Delete “${template.name}”? Issued certificates will keep their saved design snapshot.`)) return;
    const { error: deleteError } = await supabase.from("certificate_templates").delete().eq("id", template.id);
    if (deleteError) setError(deleteError.message); else await load();
  };

  const revokeCertificate = async (certificateId: string) => {
    if (!revocationReason.trim()) return;
    const { error: updateError } = await supabase.from("certificates").update({ status: "revoked", revocation_reason: revocationReason.trim(), revoked_at: new Date().toISOString(), revoked_by: user?.id }).eq("id", certificateId);
    if (updateError) setError(updateError.message); else { setRevokingId(""); setRevocationReason(""); await load(); }
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

  return (
    <AppLayout>
      <PageHeader title="Certificates & credentials" subtitle="Design reusable templates, choose the skills employers see, and manage issued credentials." actions={<Link className="btn-secondary" to="/verify" target="_blank"><ShieldCheck size={15} /> Public verifier</Link>} />
      <div className="mt-6 space-y-6">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Active templates" value={templates.filter((item) => item.is_active).length} />
          <Metric label="Issued certificates" value={issued.filter((item) => item.status === "issued").length} />
          <Metric label="Revoked" value={issued.filter((item) => item.status === "revoked").length} />
        </div>

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
                  <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Live preview</p><button type="button" className="btn-ghost" onClick={async () => { if (!previewRef.current) return; setNotice(""); try { await downloadCertificatePdf(previewRef.current, sampleCertificate.certificate_number); setNotice("Demo certificate PDF generated."); } catch (pdfError) { setError(pdfError instanceof Error ? pdfError.message : "PDF generation failed"); } }}><Download size={14} /> Test PDF</button></div><div className="overflow-auto rounded-xl bg-ink-100 p-3"><div className="min-w-[560px] shadow-card"><CertificateRenderer ref={previewRef} certificate={preview} /></div></div></div>
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
                  <div className="overflow-auto rounded-xl bg-ink-100 p-3"><div className="min-w-[640px] shadow-card"><CertificateRenderer certificate={{ ...preview, skills: skillsText.split(/\n|,/).map((item) => item.trim()).filter(Boolean) }} /></div></div>
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

        <section className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft">
          <div className="border-b border-ink-100 px-5 py-4"><h2 className="font-display font-semibold text-ink-900">Issued certificates</h2><p className="mt-1 text-xs text-ink-500">View, email, copy verification links, or revoke credentials issued in error.</p></div>
          {loading ? <TableSkeleton /> : issued.length === 0 ? <div className="p-6 text-center text-sm text-ink-500">Certificates will appear here after eligible course completions.</div> : (
            <div className="divide-y divide-ink-100">{issued.map((certificate) => {
              const studentName = certificate.student_name_snapshot || [certificate.student.first_name, certificate.student.last_name].filter(Boolean).join(" ") || certificate.student.email;
              const courseTitle = certificate.course_title_snapshot || certificate.course.title;
              return <article key={certificate.id} className="px-5 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-ink-900">{studentName}</h3><span className={`badge ${certificate.status === "issued" ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>{certificate.status}</span></div><p className="mt-1 text-xs text-ink-500">{courseTitle} · {certificate.certificate_number} · {formatDate(certificate.issued_date)}</p></div><div className="flex flex-wrap gap-2"><Link className="btn-secondary" to={`/verify/${certificate.certificate_number}`} target="_blank"><Eye size={14} /> View</Link><button className="btn-secondary" onClick={() => void copyVerificationLink(certificate.certificate_number)}><Copy size={14} /> Copy link</button>{certificate.status === "issued" && <button className="btn-secondary" onClick={() => void emailCertificate(certificate.id)}><Mail size={14} /> Email</button>}{certificate.status === "issued" && <button className="btn-ghost text-danger-700" onClick={() => setRevokingId(certificate.id)}>Revoke</button>}</div></div>{revokingId === certificate.id && <div className="mt-3 flex flex-col gap-2 rounded-lg bg-danger-50 p-3 sm:flex-row"><input className="input flex-1" value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} placeholder="Required revocation reason" /><button className="btn-primary !bg-danger-600" disabled={!revocationReason.trim()} onClick={() => void revokeCertificate(certificate.id)}>Confirm revocation</button><button className="btn-secondary" onClick={() => setRevokingId("")}>Cancel</button></div>}</article>;
            })}</div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-soft"><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-2 font-display text-3xl font-semibold text-ink-900">{value}</p></div>;
}
