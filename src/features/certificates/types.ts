import type { Certificate } from "@/types";

export type CertificateType = "completion" | "attendance" | "achievement";

export interface CertificateDesign {
  theme: "synergy-blue" | "classic" | "minimal";
  title: string;
  subtitle: string;
  presented_text: string;
  completion_text: string;
  accent_color: string;
  navy_color: string;
  show_grade: boolean;
  show_skills: boolean;
  show_signatures: boolean;
  signer_one_name: string;
  signer_one_title: string;
  signer_two_name: string;
  signer_two_title: string;
  footer_text: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string | null;
  certificate_type: CertificateType;
  design: Partial<CertificateDesign>;
  background_path: string | null;
  logo_path: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CertificateSnapshot {
  template_id?: string;
  template_name?: string;
  design?: Partial<CertificateDesign>;
  background_path?: string | null;
  logo_path?: string | null;
}

export interface CertificateViewModel {
  certificate_number: string;
  student_name: string;
  course_title: string;
  certificate_title?: string;
  issued_date: string;
  status: "issued" | "revoked";
  revocation_reason?: string | null;
  final_grade?: number | null;
  letter_grade?: string | null;
  skills: string[];
  template?: CertificateSnapshot | null;
}

export type CertificateWithSnapshot = Certificate & {
  template_id: string | null;
  template_snapshot: CertificateSnapshot;
  skills_snapshot: string[];
  student_name_snapshot: string | null;
  course_title_snapshot: string | null;
};

export const defaultCertificateDesign: CertificateDesign = {
  theme: "synergy-blue",
  title: "Certificate",
  subtitle: "of Completion",
  presented_text: "This certificate is proudly presented to",
  completion_text: "for successfully completing",
  accent_color: "#176FC4",
  navy_color: "#08172B",
  show_grade: false,
  show_skills: true,
  show_signatures: true,
  signer_one_name: "Synergy Bahamas",
  signer_one_title: "Authorized Representative",
  signer_two_name: "",
  signer_two_title: "",
  footer_text: "Skills for What’s Next.",
};

export function resolveCertificateDesign(
  design?: Partial<CertificateDesign> | null,
): CertificateDesign {
  return { ...defaultCertificateDesign, ...(design ?? {}) };
}

export function certificateAssetUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/"))
    return path;
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/storage/v1/object/public/certificate-assets/${path}`;
}
