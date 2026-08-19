import { useEffect, useState } from "react";
import { Award, Eye, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import type { CertificateWithSnapshot } from "@/features/certificates/types";

export function StudentCertificates() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CertificateWithSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("certificates")
        .select("*")
        .eq("student_id", user.id)
        .order("issued_date", { ascending: false });
      if (queryError) setError(queryError.message);
      else setRows((data ?? []) as unknown as CertificateWithSnapshot[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <AppLayout>
      <PageHeader title="Certificates" subtitle="Your verified Synergy Academy credentials, ready to view, download, or share." />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft"><TableSkeleton /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState icon={<Award size={30} />} title="No certificates yet" description="A digital certificate will appear here automatically when you complete an eligible course." />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((row) => (
              <article key={row.id} className={`overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft ${row.status === "revoked" ? "opacity-70" : ""}`}>
                <div className="h-1.5 bg-brand-600" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Award size={23} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Digital credential</p>
                        {row.status === "issued" && <span className="badge bg-success-50 text-success-700"><ShieldCheck size={12} /> Verified</span>}
                      </div>
                      <h2 className="mt-1 font-display text-lg font-semibold text-ink-900">{row.course_title_snapshot || row.title}</h2>
                      <p className="mt-2 text-sm text-ink-600">Issued {formatDate(row.issued_date)}</p>
                      <p className="mt-2 font-mono text-xs text-ink-500">{row.certificate_number}</p>
                      {row.skills_snapshot?.length > 0 && <p className="mt-3 line-clamp-2 text-xs leading-5 text-ink-500">Skills: {row.skills_snapshot.join(" · ")}</p>}
                      {row.status === "revoked" ? (
                        <div className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">Certificate revoked{row.revocation_reason ? `: ${row.revocation_reason}` : ""}</div>
                      ) : (
                        <Link to={`/student/certificates/${row.id}`} className="btn-primary mt-4"><Eye size={15} /> View certificate</Link>
                      )}
                    </div>
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
