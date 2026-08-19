import { useEffect, useState } from "react";
import { Award, Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import type { Certificate, Course } from "@/types";

type CertificateRow = Certificate & { course: Course };
export function StudentCertificates() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("certificates")
        .select("*,course:courses(*)")
        .eq("student_id", user.id)
        .order("issued_date", { ascending: false });
      if (queryError) setError(queryError.message);
      else setRows((data ?? []) as unknown as CertificateRow[]);
      setLoading(false);
    })();
  }, [user]);
  const printCertificate = (row: CertificateRow) => {
    const printWindow = window.open("", "_blank", "width=1100,height=760");
    if (!printWindow) {
      setError("Allow pop-ups to print or save this certificate as a PDF.");
      return;
    }
    printWindow.opener = null;
    const escapeHtml = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (character) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
          })[character] ?? character,
      );
    const studentName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ");
    const logoUrl = `${window.location.origin}/brand/synergy-bahamas-logo-full-color.png`;
    const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(row.certificate_number)}`;
    const qrUrl = `https://quickchart.io/qr?size=180&margin=1&text=${encodeURIComponent(verificationUrl)}`;
    printWindow.document
      .write(`<!doctype html><html><head><title>${escapeHtml(row.certificate_number)}</title><style>
      @page{size:landscape;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#0a1628;background:#eef2f7}.certificate{width:100vw;height:100vh;padding:54px;display:grid;place-items:center}.frame{position:relative;width:100%;height:100%;background:#fff;border:3px solid #0a1628;outline:10px solid #1677c8;outline-offset:-18px;padding:48px 58px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}.logo{width:270px;height:auto;margin-bottom:24px}.title{font-size:44px;margin:12px 0 10px}.presented{font-size:16px;color:#60708a}.name{font-size:33px;color:#1677c8;margin:14px 0;border-bottom:1px solid #aab5c5;padding:0 36px 10px}.course{font-size:23px;font-weight:700;margin:14px 0}.meta{font-size:12px;color:#60708a;margin-top:22px;line-height:1.65}.verification{position:absolute;right:40px;bottom:34px;width:116px;text-align:center}.qr{display:block;width:92px;height:92px;margin:0 auto 5px}.verification-label{font-size:9px;line-height:1.25;color:#60708a}@media print{body{background:#fff}}
    </style></head><body><main class="certificate"><section class="frame"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Synergy Bahamas"><h1 class="title">Certificate of Completion</h1><p class="presented">This certificate is presented to</p><p class="name">${escapeHtml(studentName || profile?.email || "Student")}</p><p class="presented">for successfully completing</p><p class="course">${escapeHtml(row.course.title)}</p><p class="meta">Issued ${escapeHtml(formatDate(row.issued_date))}<br>${escapeHtml(row.certificate_number)}<br>Verify: ${escapeHtml(verificationUrl)}</p><div class="verification"><img class="qr" src="${escapeHtml(qrUrl)}" alt="Scan to verify certificate"><div class="verification-label">Scan to verify</div></div></section></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))</script></body></html>`);
    printWindow.document.close();
  };
  return (
    <AppLayout>
      <PageHeader
        title="Certificates"
        subtitle="Verified records issued after successful course completion."
      />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<Award size={30} />}
              title="No certificates yet"
              description="Completed course certificates will appear here when issued by your teaching team."
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => (
              <article
                key={row.id}
                className={`rounded-xl bg-white p-6 shadow-soft ${row.status === "revoked" ? "opacity-70" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
                    <Award size={23} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                      Synergy Academy certificate
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-ink-900">
                      {row.title || row.course.title}
                    </h2>
                    <p className="mt-2 text-sm text-ink-600">
                      Issued {formatDate(row.issued_date)}
                    </p>
                    <p className="mt-3 font-mono text-xs text-ink-500">
                      {row.certificate_number}
                    </p>
                    {row.status === "revoked" ? (
                      <div className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                        Certificate revoked
                        {row.revocation_reason
                          ? `: ${row.revocation_reason}`
                          : ""}
                      </div>
                    ) : (
                      <button
                        className="btn-secondary mt-4"
                        onClick={() => printCertificate(row)}
                      >
                        <Download size={15} /> Print / save PDF
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
