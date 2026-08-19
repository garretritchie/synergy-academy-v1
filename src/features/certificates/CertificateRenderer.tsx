import { forwardRef } from "react";
import { Award, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  certificateAssetUrl,
  resolveCertificateDesign,
  type CertificateViewModel,
} from "./types";

interface CertificateRendererProps {
  certificate: CertificateViewModel;
  className?: string;
}

export const CertificateRenderer = forwardRef<HTMLElement, CertificateRendererProps>(
  function CertificateRenderer({ certificate, className = "" }, ref) {
    const snapshot = certificate.template ?? {};
    const design = resolveCertificateDesign(snapshot.design);
    const backgroundUrl = certificateAssetUrl(snapshot.background_path);
    const logoUrl =
      certificateAssetUrl(snapshot.logo_path) ??
      "/brand/synergy-bahamas-logo-full-color.png";
    const visibleSkills = design.show_skills ? certificate.skills.slice(0, 6) : [];

    return (
      <section
        ref={ref}
        className={`certificate-sheet relative isolate aspect-[11/8.5] w-full overflow-hidden bg-white text-ink-900 [container-type:inline-size] ${className}`}
        style={{
          borderColor: design.navy_color,
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
        aria-label={`${design.title} ${design.subtitle} for ${certificate.student_name}`}
      >
        {!backgroundUrl && (
          <div className="absolute inset-0" aria-hidden="true">
            <div
              className="absolute inset-y-0 left-0 w-[17%]"
              style={{ backgroundColor: design.accent_color }}
            />
            <div
              className="absolute inset-y-0 left-[15.5%] w-[1.3%] bg-white/90"
            />
            <div
              className="absolute inset-y-0 left-[18.2%] w-[0.45%]"
              style={{ backgroundColor: `${design.accent_color}55` }}
            />
            <div
              className="absolute bottom-0 left-[17%] right-0 h-[4.5%]"
              style={{ backgroundColor: design.accent_color }}
            />
          </div>
        )}

        <div className="relative z-10 ml-[18%] flex h-full flex-col px-[6%] pb-[6.5%] pt-[3.8%] text-center">
          <div className="flex min-h-[12%] items-start justify-end">
            <img
              src={logoUrl}
              alt="Synergy Bahamas"
              className="h-auto w-[25%] max-w-[250px] object-contain"
              crossOrigin="anonymous"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-[0.5%]">
            <p
              className="font-display text-[6.2cqw] font-bold uppercase leading-[0.95] tracking-[0.04em]"
              style={{ color: design.navy_color }}
            >
              {design.title}
            </p>
            <p
              className="mt-[1.1%] font-display text-[2.7cqw] font-medium uppercase leading-none tracking-[0.18em]"
              style={{ color: design.accent_color }}
            >
              {design.subtitle}
            </p>
            <p className="mt-[3%] text-[1.15cqw] text-ink-500">
              {design.presented_text}
            </p>
            <h1
              className="mt-[0.8%] max-w-[84%] font-display text-[4.25cqw] font-semibold leading-tight"
              style={{ color: design.navy_color }}
            >
              {certificate.student_name}
            </h1>
            <div
              className="mt-[0.9%] h-px w-[48%]"
              style={{ backgroundColor: `${design.accent_color}66` }}
            />
            <p className="mt-[2.2%] text-[1.15cqw] text-ink-500">
              {design.completion_text}
            </p>
            <h2
              className="mt-[0.6%] max-w-[82%] font-display text-[2.45cqw] font-semibold leading-tight"
              style={{ color: design.navy_color }}
            >
              {certificate.course_title}
            </h2>

            {visibleSkills.length > 0 && (
              <div className="mt-[1.6%] flex max-w-[82%] flex-wrap justify-center gap-x-[1.5%] gap-y-0.5 text-[0.95cqw] text-ink-600">
                {visibleSkills.map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span style={{ color: design.accent_color }}>•</span> {skill}
                  </span>
                ))}
              </div>
            )}

            {design.show_grade && certificate.final_grade != null && (
              <p className="mt-[1.2%] text-[1cqw] font-semibold text-ink-600">
                Final grade: {certificate.final_grade.toFixed(1)}%
                {certificate.letter_grade ? ` (${certificate.letter_grade})` : ""}
              </p>
            )}
          </div>

          <div className="grid h-[12%] shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-[4%]">
            {design.show_signatures ? (
              <Signature name={design.signer_one_name} title={design.signer_one_title} />
            ) : (
              <span />
            )}
            <div className="flex flex-col items-center">
              <Award className="h-[2.2cqw] w-[2.2cqw]" style={{ color: design.accent_color }} />
              <p className="mt-0.5 text-[0.85cqw] font-semibold text-ink-700">
                Issued {formatDate(certificate.issued_date)}
              </p>
              <p className="mt-0.5 font-mono text-[0.72cqw] text-ink-500">
                {certificate.certificate_number}
              </p>
            </div>
            {design.show_signatures && design.signer_two_name ? (
              <Signature name={design.signer_two_name} title={design.signer_two_title} />
            ) : (
              <div className="flex items-center justify-end gap-1 text-[0.72cqw] text-ink-500">
                <ShieldCheck className="h-[1.5cqw] w-[1.5cqw]" style={{ color: design.accent_color }} />
                Publicly verifiable credential
              </div>
            )}
          </div>

          <p className="absolute bottom-[1.5%] left-0 right-0 text-[0.62cqw] font-semibold uppercase tracking-[0.18em] text-white">
            {design.footer_text}
          </p>
        </div>
      </section>
    );
  },
);

function Signature({ name, title }: { name: string; title: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-[1.15cqw] font-semibold text-ink-800">
        {name || "Authorized signature"}
      </p>
      <div className="mx-auto mt-1 h-px w-[75%] bg-ink-300" />
      <p className="mt-0.5 text-[0.68cqw] text-ink-500">
        {title}
      </p>
    </div>
  );
}
