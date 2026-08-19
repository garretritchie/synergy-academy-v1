import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Mail, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { CertificateRenderer } from "@/features/certificates/CertificateRenderer";
import { downloadCertificatePdf } from "@/features/certificates/pdf";
import type { CertificateViewModel, CertificateWithSnapshot } from "@/features/certificates/types";
import { supabase } from "@/lib/supabase";

export function StudentCertificateDetail() {
  const { certificateId = "" } = useParams();
  const certificateRef = useRef<HTMLElement>(null);
  const [record, setRecord] = useState<CertificateWithSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase.from("certificates").select("*").eq("id", certificateId).single();
      if (queryError) setError(queryError.message);
      else setRecord(data as unknown as CertificateWithSnapshot);
      setLoading(false);
    })();
  }, [certificateId]);

  const downloadPdf = async () => {
    if (!certificateRef.current || !record) return;
    setPdfBusy(true);
    setError("");
    try { await downloadCertificatePdf(certificateRef.current, record.certificate_number); }
    catch (pdfError) { setError(pdfError instanceof Error ? pdfError.message : "PDF generation failed"); }
    finally { setPdfBusy(false); }
  };

  if (loading) return <AppLayout><TableSkeleton /></AppLayout>;
  if (!record) return <AppLayout><Alert>{error || "Certificate not found"}</Alert></AppLayout>;

  const model: CertificateViewModel = {
    certificate_number: record.certificate_number,
    student_name: record.student_name_snapshot || "Synergy Academy learner",
    course_title: record.course_title_snapshot || record.title,
    certificate_title: record.title,
    issued_date: record.issued_date,
    status: record.status,
    revocation_reason: record.revocation_reason,
    final_grade: record.final_grade,
    letter_grade: record.letter_grade,
    skills: record.skills_snapshot ?? [],
    template: record.template_snapshot,
  };
  const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(record.certificate_number)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(`Synergy Academy certificate - ${model.course_title}`)}&body=${encodeURIComponent(`View and verify this Synergy Academy certificate: ${verificationUrl}`)}`;

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 border-b border-ink-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/student/certificates" className="text-xs font-semibold text-brand-700 hover:text-brand-800">← Back to certificates</Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">Your digital certificate</h1>
          <p className="mt-1 text-sm text-ink-500">Download a PDF or share the public verification link.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={verificationUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Verify</a>
          <a className="btn-secondary" href={emailHref}><Mail size={15} /> Share by email</a>
          <button className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <button className="btn-primary" disabled={pdfBusy} onClick={() => void downloadPdf()}><Download size={15} /> {pdfBusy ? "Generating..." : "Generate PDF"}</button>
        </div>
      </div>
      {error && <div className="mt-5"><Alert>{error}</Alert></div>}
      <div className="certificate-preview-shell mt-6 overflow-auto rounded-xl border border-ink-200 bg-ink-100 p-3 shadow-inner sm:p-6">
        <div className="mx-auto min-w-[720px] max-w-6xl shadow-elevated"><CertificateRenderer ref={certificateRef} certificate={model} /></div>
      </div>
    </AppLayout>
  );
}
