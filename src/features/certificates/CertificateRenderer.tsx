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
    const studentNameSize =
      certificate.student_name.length > 36
        ? "3.05cqw"
        : certificate.student_name.length > 26
          ? "3.55cqw"
          : "4.15cqw";
    const courseTitleSize =
      certificate.course_title.length > 78
        ? "1.75cqw"
        : certificate.course_title.length > 50
          ? "2.05cqw"
          : "2.4cqw";

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
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${design.accent_color}0D 0%, transparent 38%, ${design.navy_color}08 100%)`,
              }}
            />
            <div
              className="absolute inset-y-0 left-0 w-[15.2%]"
              style={{ backgroundColor: design.accent_color }}
            />
            <div
              className="absolute inset-y-0 left-[13.9%] w-[1.15%] bg-white/95"
            />
            <div
              className="absolute inset-y-0 left-[16.5%] w-[0.35%]"
              style={{ backgroundColor: `${design.accent_color}66` }}
            />
            <div
              className="absolute bottom-0 left-[15.2%] right-0 h-[4.5%]"
              style={{ backgroundColor: design.accent_color }}
            />
            <div
              className="absolute left-0 top-0 h-[16%] w-[15.2%]"
              style={{ backgroundColor: `${design.navy_color}2E` }}
            />
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-[2.1%] z-[5] border"
          style={{ borderColor: `${design.navy_color}22` }}
          aria-hidden="true"
        />

        <div className="relative z-10 ml-[16.8%] grid h-full grid-rows-[13%_minmax(0,1fr)_13%] px-[5.2%] pb-[6.2%] pt-[3.4%] text-center">
          <div className="flex min-h-0 items-start justify-end" data-certificate-zone="header">
            <img
              src={logoUrl}
              alt="Synergy Bahamas"
              className="h-auto w-[26%] max-w-[250px] object-contain"
              crossOrigin="anonymous"
            />
          </div>

          <div className="flex min-h-0 flex-col items-center justify-center overflow-hidden pb-[0.4%]" data-certificate-zone="credential">
            <p
              className="font-display text-[5.45cqw] font-bold uppercase leading-none tracking-[0.055em]"
              style={{ color: design.navy_color }}
            >
              {design.title}
            </p>
            <p
              className="mt-[0.9%] font-display text-[2.35cqw] font-medium uppercase leading-none tracking-[0.2em]"
              style={{ color: design.accent_color }}
            >
              {design.subtitle}
            </p>
            <div
              className="mt-[2.2%] h-px w-[12%]"
              style={{ backgroundColor: `${design.accent_color}66` }}
              aria-hidden="true"
            />
            <p className="mt-[1.45%] text-[1.02cqw] leading-snug text-ink-500">
              {design.presented_text}
            </p>
            <h1
              className="mt-[0.55%] max-w-[88%] break-words font-display font-semibold leading-[1.06]"
              style={{ color: design.navy_color, fontSize: studentNameSize }}
              data-certificate-field="student-name"
            >
              {certificate.student_name}
            </h1>
            <div
              className="mt-[0.75%] h-px w-[46%]"
              style={{ backgroundColor: `${design.navy_color}44` }}
              aria-hidden="true"
            />
            <p className="mt-[1.5%] text-[1.02cqw] leading-snug text-ink-500">
              {design.completion_text}
            </p>
            <h2
              className="mt-[0.45%] max-w-[86%] break-words font-display font-semibold leading-[1.12]"
              style={{ color: design.navy_color, fontSize: courseTitleSize }}
              data-certificate-field="course-title"
            >
              {certificate.course_title}
            </h2>

            {visibleSkills.length > 0 && (
              <div className="mt-[1.3%] flex max-w-[88%] flex-wrap justify-center gap-x-[1.35cqw] gap-y-[0.22cqw] text-[0.82cqw] leading-[1.18] text-ink-600" data-certificate-field="skills">
                {visibleSkills.map((skill) => (
                  <span key={skill} className="inline-flex max-w-full items-start gap-[0.32cqw] break-words">
                    <span className="shrink-0" style={{ color: design.accent_color }}>•</span>
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            )}

            {design.show_grade && certificate.final_grade != null && (
              <p className="mt-[0.9%] text-[0.88cqw] font-semibold leading-none text-ink-600">
                Final grade: {certificate.final_grade.toFixed(1)}%
                {certificate.letter_grade ? ` (${certificate.letter_grade})` : ""}
              </p>
            )}
          </div>

          <div className="grid min-h-0 grid-cols-[1fr_auto_1fr] items-start gap-[3.5%] pt-[1.1%]" data-certificate-zone="credentials">
            {design.show_signatures ? (
              <Signature name={design.signer_one_name} title={design.signer_one_title} />
            ) : (
              <span />
            )}
            <div className="flex flex-col items-center">
              <Award className="h-[2.2cqw] w-[2.2cqw]" style={{ color: design.accent_color }} />
              <p className="mt-[0.25cqw] text-[0.8cqw] font-semibold leading-none text-ink-700">
                Issued {formatDate(certificate.issued_date)}
              </p>
              <p className="mt-[0.28cqw] font-mono text-[0.66cqw] leading-none text-ink-500">
                {certificate.certificate_number}
              </p>
            </div>
            {design.show_signatures && design.signer_two_name ? (
              <Signature name={design.signer_two_name} title={design.signer_two_title} />
            ) : (
              <div className="flex max-w-[16cqw] items-start justify-self-end text-left text-[0.68cqw] leading-[1.2] text-ink-500">
                <ShieldCheck className="h-[1.5cqw] w-[1.5cqw]" style={{ color: design.accent_color }} />
                <span className="ml-[0.4cqw]">Publicly verifiable credential</span>
              </div>
            )}
          </div>

          <p className="absolute bottom-0 left-0 right-0 flex h-[4.5%] items-center justify-center text-[0.7cqw] font-semibold uppercase leading-none tracking-[0.18em] text-white">
            {design.footer_text}
          </p>
        </div>
      </section>
    );
  },
);

function Signature({ name, title }: { name: string; title: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate font-display text-[1.05cqw] font-semibold leading-none text-ink-800">
        {name || "Authorized signature"}
      </p>
      <div className="mx-auto mt-[0.38cqw] h-px w-[76%] bg-ink-300" />
      <p className="mt-[0.28cqw] truncate text-[0.64cqw] leading-none text-ink-500">
        {title}
      </p>
    </div>
  );
}
