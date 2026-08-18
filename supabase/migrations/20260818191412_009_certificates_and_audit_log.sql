/*
# Certificates and Audit Log

## Purpose
Establishes the certificate system for course completion and a comprehensive audit log for tracking administrative and academic actions.

## New Tables

### certificates
- `id` (uuid, primary key)
- `enrolment_id` (uuid, references enrolments.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `course_id` (uuid, references courses.id, on delete cascade)
- `certificate_number` (text, unique, not null — human-readable certificate ID)
- `title` (text — certificate title, e.g. "Certificate of Completion")
- `issued_date` (timestamptz, not null, default now)
- `final_grade` (numeric(5,2))
- `letter_grade` (text)
- `issued_by` (uuid, references profiles.id — who issued the certificate)
- `template_id` (uuid — nullable, for future certificate template system)
- `metadata` (jsonb — extensible for certificate-specific data)
- `created_at`, `updated_at` (timestamptz)

### audit_log
- `id` (uuid, primary key)
- `actor_id` (uuid, references profiles.id, on delete set null — who performed the action)
- `action` (text, not null — e.g. 'create', 'update', 'delete', 'grade', 'enrol', 'login')
- `entity_type` (text — e.g. 'course', 'cohort', 'enrolment', 'grade', 'assignment')
- `entity_id` (uuid — ID of the affected entity)
- `old_values` (jsonb — state before the action)
- `new_values` (jsonb — state after the action)
- `ip_address` (text — requester IP, if available)
- `user_agent` (text — requester user agent, if available)
- `created_at` (timestamptz, not null, default now)

## Helper Functions

### generate_certificate_number()
Returns a unique certificate number in the format SYN-YYYY-NNNNNN (e.g. SYN-2026-000001).

## Security (RLS)

### certificates
- SELECT: students can read ONLY their own certificates. Instructors can read certificates for cohorts they teach. Admins read all.
- INSERT: admins and cohort instructors (for issuing certificates).
- UPDATE: admins only.
- DELETE: admins only.

### audit_log
- SELECT: administrators only.
- INSERT: any authenticated user can insert (for logging actions performed by themselves).
- UPDATE/DELETE: admins only (audit entries should generally not be modified, but admin override exists for corrections).

## Important Notes
1. Certificate numbers are auto-generated and unique — the format includes the year and a sequential number.
2. Certificates link to enrolment, student, cohort, and course for comprehensive tracking.
3. `template_id` is reserved for a future certificate template system.
4. The audit log captures who did what, when, and what changed — essential for compliance and troubleshooting.
5. Students can only see their own certificates — never another student's.
6. Only administrators can read the audit log.
*/

-- ============================================================================
-- CERTIFICATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  certificate_number text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT 'Certificate of Completion',
  issued_date timestamptz NOT NULL DEFAULT now(),
  final_grade numeric(5,2),
  letter_grade text,
  issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  template_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_certificates_enrolment_id ON certificates(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_cohort_id ON certificates(cohort_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_number ON certificates(certificate_number);

CREATE OR REPLACE FUNCTION public.update_certificates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON certificates;
CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_certificates_updated_at();

-- ============================================================================
-- AUDIT_LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id ON audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generate a unique certificate number in format SYN-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert_number text;
  current_year int;
  seq_num int;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::int;

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(certificate_number FROM 'SYN-[0-9]{4}-([0-9]{6})') AS int)
  ), 0) + 1
  INTO seq_num
  FROM certificates
  WHERE certificate_number LIKE 'SYN-' || current_year || '-%';

  cert_number := 'SYN-' || current_year || '-' || LPAD(seq_num::text, 6, '0');

  RETURN cert_number;
END;
$$;

-- ============================================================================
-- RLS POLICIES: certificates
-- ============================================================================

DROP POLICY IF EXISTS "certificates_select_own_or_instructor_or_admin" ON certificates;
CREATE POLICY "certificates_select_own_or_instructor_or_admin"
  ON certificates FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "certificates_insert_admin_or_instructor" ON certificates;
CREATE POLICY "certificates_insert_admin_or_instructor"
  ON certificates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "certificates_update_admin" ON certificates;
CREATE POLICY "certificates_update_admin"
  ON certificates FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "certificates_delete_admin" ON certificates;
CREATE POLICY "certificates_delete_admin"
  ON certificates FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: audit_log
-- ============================================================================

DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON audit_log;
CREATE POLICY "audit_log_insert_authenticated"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_update_admin" ON audit_log;
CREATE POLICY "audit_log_update_admin"
  ON audit_log FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "audit_log_delete_admin" ON audit_log;
CREATE POLICY "audit_log_delete_admin"
  ON audit_log FOR DELETE
  TO authenticated
  USING (public.is_admin());