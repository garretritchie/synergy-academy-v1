import { useEffect, useState } from "react";
import { Award, CheckCircle2, ShieldX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

type Verification = {
  certificate_number: string;
  student_name: string;
  course_title: string;
  issued_date: string;
  status: "issued" | "revoked";
  revocation_reason: string | null;
};

export function CertificateVerification() {
  const { certificateNumber = "" } = useParams<{
    certificateNumber: string;
  }>();
  const [record, setRecord] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const { data, error: queryError } = await supabase.rpc(
        "verify_certificate",
        { certificate_code: certificateNumber },
      );
      if (queryError)
        setError(
          `${queryError.message}. Certificate verification requires migration 012.`,
        );
      else setRecord((data as Verification | null) ?? null);
      setLoading(false);
    })();
  }, [certificateNumber]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-ink-50 p-5">
      <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-elevated sm:p-9">
        <Link to="/signin" aria-label="Synergy Academy sign in">
          <img
            src="/brand/synergy-bahamas-logo-full-color.png"
            alt="Synergy Bahamas"
            className="h-auto w-52"
          />
        </Link>
        <div className="mt-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Award size={22} />
          </div>
          <div>
            <AcademyBrandMark compact className="mb-1" />
            <h1 className="text-2xl font-semibold text-ink-900">
              Certificate verification
            </h1>
          </div>
        </div>
        <div className="mt-7">
          {error && <Alert>{error}</Alert>}
          {loading ? (
            <TableSkeleton rows={3} />
          ) : !record ? (
            <div className="rounded-xl bg-warning-50 p-5 text-warning-900">
              <p className="font-semibold">Certificate not found</p>
              <p className="mt-1 text-sm">
                Check the verification address or contact Synergy Bahamas.
              </p>
            </div>
          ) : (
            <div>
              <div
                className={`flex items-center gap-3 rounded-xl p-4 ${record.status === "issued" ? "bg-success-50 text-success-800" : "bg-danger-50 text-danger-800"}`}
              >
                {record.status === "issued" ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldX size={22} />
                )}
                <p className="font-semibold">
                  {record.status === "issued"
                    ? "Valid certificate"
                    : "Certificate revoked"}
                </p>
              </div>
              <dl className="mt-5 divide-y divide-ink-100 rounded-xl border border-ink-100 px-4">
                {[
                  ["Learner", record.student_name],
                  ["Course", record.course_title],
                  ["Issued", formatDate(record.issued_date)],
                  ["Certificate", record.certificate_number],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr]">
                    <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                      {label}
                    </dt>
                    <dd className="text-sm font-medium text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
              {record.status === "revoked" && record.revocation_reason && (
                <p className="mt-4 text-sm text-danger-700">
                  {record.revocation_reason}
                </p>
              )}
            </div>
          )}
        </div>
        <a
          href="https://www.synergybahamas.com"
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Visit Synergy Bahamas
        </a>
      </section>
    </main>
  );
}
