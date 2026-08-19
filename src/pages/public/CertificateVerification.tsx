import { FormEvent, useEffect, useRef, useState } from "react";
import { Award, CheckCircle2, Download, Search, ShieldCheck, ShieldX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";
import { CertificateRenderer } from "@/features/certificates/CertificateRenderer";
import { downloadCertificatePdf } from "@/features/certificates/pdf";
import type { CertificateViewModel } from "@/features/certificates/types";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export function CertificateVerification() {
  const { certificateNumber = "" } = useParams<{ certificateNumber: string }>();
  const navigate = useNavigate();
  const certificateRef = useRef<HTMLElement>(null);
  const [code, setCode] = useState(certificateNumber);
  const [record, setRecord] = useState<CertificateViewModel | null>(null);
  const [loading, setLoading] = useState(Boolean(certificateNumber));
  const [error, setError] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    setCode(certificateNumber);
    setShowCertificate(false);
    if (!certificateNumber) {
      setRecord(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void (async () => {
      const { data, error: queryError } = await supabase.rpc("verify_certificate", { certificate_code: certificateNumber });
      if (queryError) setError(`${queryError.message}. Certificate verification requires migration 015.`);
      else setRecord((data as CertificateViewModel | null) ?? null);
      setLoading(false);
    })();
  }, [certificateNumber]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized) navigate(`/verify/${encodeURIComponent(normalized)}`);
  };

  const downloadPdf = async () => {
    if (!certificateRef.current || !record) return;
    setPdfBusy(true);
    try { await downloadCertificatePdf(certificateRef.current, record.certificate_number); }
    catch (pdfError) { setError(pdfError instanceof Error ? pdfError.message : "PDF generation failed"); }
    finally { setPdfBusy(false); }
  };

  return (
    <main className="min-h-[100dvh] bg-canvas px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/signin" aria-label="Synergy Academy sign in"><img src="/brand/synergy-bahamas-logo-full-color.png" alt="Synergy Bahamas" className="h-auto w-52" /></Link>
          <AcademyBrandMark compact />
        </header>

        <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-ink-100 bg-white p-6 shadow-elevated sm:p-9">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck size={22} /></div>
            <div><h1 className="font-display text-2xl font-semibold text-ink-900">Verify a certificate</h1><p className="mt-0.5 text-sm text-ink-500">Confirm a Synergy Academy credential instantly.</p></div>
          </div>
          <form className="mt-6 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
            <label className="sr-only" htmlFor="certificate-code">Certificate code</label>
            <input id="certificate-code" className="input flex-1 font-mono uppercase" value={code} onChange={(event) => setCode(event.target.value)} placeholder="SYN-2026-XXXXXXXXXXXX" autoComplete="off" />
            <button className="btn-primary" type="submit" disabled={!code.trim()}><Search size={15} /> Verify code</button>
          </form>

          <div className="mt-6">
            {error && <Alert>{error}</Alert>}
            {loading ? <TableSkeleton rows={3} /> : certificateNumber && !record ? (
              <div className="rounded-xl bg-warning-50 p-5 text-warning-900"><div className="flex items-center gap-2 font-semibold"><ShieldX size={20} /> Certificate not found</div><p className="mt-1 text-sm">Check the code carefully or contact Synergy Bahamas for assistance.</p></div>
            ) : record ? (
              <div>
                <div className={`flex items-start gap-3 rounded-xl p-4 ${record.status === "issued" ? "bg-success-50 text-success-800" : "bg-danger-50 text-danger-800"}`}>
                  {record.status === "issued" ? <CheckCircle2 className="mt-0.5 shrink-0" size={24} /> : <ShieldX className="mt-0.5 shrink-0" size={24} />}
                  <div><p className="font-semibold">{record.status === "issued" ? "Valid Synergy Academy certificate" : "Certificate revoked"}</p><p className="mt-0.5 text-sm opacity-80">{record.status === "issued" ? "The certificate code and learner record match our official records." : record.revocation_reason || "This credential is no longer valid."}</p></div>
                </div>
                <dl className="mt-5 divide-y divide-ink-100 rounded-xl border border-ink-100 px-4">
                  {[["Learner", record.student_name], ["Course", record.course_title], ["Issued", formatDate(record.issued_date)], ["Certificate", record.certificate_number]].map(([label, value]) => (
                    <div key={label} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]"><dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt><dd className="text-sm font-medium text-ink-900">{value}</dd></div>
                  ))}
                </dl>
                {record.status === "issued" && record.skills?.length > 0 && (
                  <div className="mt-5 rounded-xl bg-brand-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Skills and key topics</p><ul className="mt-3 grid gap-2 text-sm text-ink-700 sm:grid-cols-2">{record.skills.map((skill) => <li key={skill} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-brand-600" size={15} />{skill}</li>)}</ul></div>
                )}
                {record.status === "issued" && (
                  <button className="btn-secondary mt-5" onClick={() => setShowCertificate((value) => !value)}><Award size={15} /> {showCertificate ? "Hide certificate" : "View full certificate"}</button>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-ink-50 p-5 text-sm text-ink-600">Enter the unique code printed on a Synergy Academy certificate. Verification does not require an account.</div>
            )}
          </div>
        </section>

        {record?.status === "issued" && showCertificate && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-ink-900">Digital certificate</h2><button className="btn-primary" disabled={pdfBusy} onClick={() => void downloadPdf()}><Download size={15} /> {pdfBusy ? "Generating..." : "Generate PDF"}</button></div>
            <div className="overflow-auto rounded-xl border border-ink-200 bg-ink-100 p-3 sm:p-6"><div className="mx-auto min-w-[720px] max-w-6xl shadow-elevated"><CertificateRenderer ref={certificateRef} certificate={record} /></div></div>
          </section>
        )}

        <footer className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-xs text-ink-500"><a href="https://www.synergybahamas.com" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:text-brand-800">Visit Synergy Bahamas</a><a href="mailto:info@synergybahamas.com">info@synergybahamas.com</a><a href="tel:+12423230727">(242) 323-0727</a></footer>
      </div>
    </main>
  );
}
