/*
# Cohorts, Cohort Instructors, and Enrolments

## Purpose
Establishes the scheduled delivery layer: a cohort is a specific run of a course with its own students, instructors, dates, and content-release schedule. Enrolments link students to cohorts and own their progress.

## New Tables

### cohorts
- `id` (uuid, primary key)
- `course_id` (uuid, references courses.id, on delete cascade)
- `name` (text, not null — e.g. "Spring 2026 Cohort")
- `slug` (text, not null — URL-safe, unique per course)
- `description` (text)
- `start_date` (date)
- `end_date` (date)
- `enrolment_open` (boolean, default false)
- `enrolment_start_date` (date)
- `enrolment_end_date` (date)
- `max_students` (int — optional capacity limit)
- `is_active` (boolean, default true)
- `metadata` (jsonb — extensible)
- `created_by` (uuid, references profiles.id)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- Unique constraint on (course_id, slug)

### cohort_instructors
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `instructor_id` (uuid, references profiles.id, on delete cascade)
- `is_lead` (boolean, default false — lead instructor for the cohort)
- `created_at` (timestamptz)
- Unique constraint on (cohort_id, instructor_id)

### enrolments
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `enrolled_at` (timestamptz, default now)
- `status` (text, default 'active' — 'active', 'completed', 'withdrawn', 'suspended')
- `completion_date` (timestamptz — when the student completed the course)
- `final_grade` (numeric(5,2) — final overall grade)
- `metadata` (jsonb — extensible for future enrolment attributes)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- Unique constraint on (cohort_id, student_id)

## Helper Functions

### is_cohort_instructor(cohort_uuid)
Returns boolean — whether the current user is an instructor for the given cohort.

### is_enrolled(cohort_uuid)
Returns boolean — whether the current user is an active student enrolled in the given cohort.

### get_student_enrolment_id(cohort_uuid)
Returns uuid — the enrolment id for the current user in the given cohort, or NULL.

## Security (RLS)

### cohorts
- SELECT: authenticated users can read active cohorts. Admins read all. Instructors read cohorts they teach. Students read cohorts they're enrolled in.
- INSERT/UPDATE/DELETE: administrators only.

### cohort_instructors
- SELECT: all authenticated users can read (students need to see who teaches their cohort).
- INSERT/UPDATE/DELETE: administrators only.

### enrolments
- SELECT: students can read ONLY their own enrolments. Instructors can read enrolments for cohorts they teach. Admins read all.
- INSERT: administrators only (students cannot self-enroll).
- UPDATE: administrators and instructors (for status/grade changes). Students cannot update their own enrolment.
- DELETE: administrators only.

## Important Notes
1. A cohort is always tied to exactly one course — a course may have many cohorts.
2. `is_lead` on cohort_instructors distinguishes the primary instructor from co-instructors.
3. Enrolment status supports the lifecycle: active → completed/withdrawn/suspended.
4. Students can only see their own enrolment records — never another student's.
5. `final_grade` is set by the instructor/admin upon completion, not by the student.
*/

-- ============================================================================
-- COHORTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  start_date date,
  end_date date,
  enrolment_open boolean NOT NULL DEFAULT false,
  enrolment_start_date date,
  enrolment_end_date date,
  max_students int,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cohorts_course_id ON cohorts(course_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_slug ON cohorts(slug);
CREATE INDEX IF NOT EXISTS idx_cohorts_is_active ON cohorts(is_active);
CREATE INDEX IF NOT EXISTS idx_cohorts_start_date ON cohorts(start_date);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_cohorts_updated_at()
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

DROP TRIGGER IF EXISTS trg_cohorts_updated_at ON cohorts;
CREATE TRIGGER trg_cohorts_updated_at
  BEFORE UPDATE ON cohorts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cohorts_updated_at();

-- ============================================================================
-- COHORT_INSTRUCTORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cohort_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, instructor_id)
);

ALTER TABLE cohort_instructors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cohort_instructors_cohort_id ON cohort_instructors(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_instructors_instructor_id ON cohort_instructors(instructor_id);

-- ============================================================================
-- ENROLMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  completion_date timestamptz,
  final_grade numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, student_id)
);

ALTER TABLE enrolments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_enrolments_cohort_id ON enrolments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_student_id ON enrolments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_status ON enrolments(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_enrolments_updated_at()
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

DROP TRIGGER IF EXISTS trg_enrolments_updated_at ON enrolments;
CREATE TRIGGER trg_enrolments_updated_at
  BEFORE UPDATE ON enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_enrolments_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Returns boolean — whether the current user is an instructor for the given cohort
CREATE OR REPLACE FUNCTION public.is_cohort_instructor(cohort_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cohort_instructors
    WHERE cohort_id = cohort_uuid
      AND instructor_id = auth.uid()
  );
$$;

-- Returns boolean — whether the current user is an active student enrolled in the given cohort
CREATE OR REPLACE FUNCTION public.is_enrolled(cohort_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrolments
    WHERE cohort_id = cohort_uuid
      AND student_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Returns uuid — the enrolment id for the current user in the given cohort, or NULL
CREATE OR REPLACE FUNCTION public.get_student_enrolment_id(cohort_uuid uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM enrolments
  WHERE cohort_id = cohort_uuid
    AND student_id = auth.uid()
    AND status = 'active';
$$;

-- ============================================================================
-- RLS POLICIES: cohorts
-- ============================================================================

DROP POLICY IF EXISTS "cohorts_select_visible" ON cohorts;
CREATE POLICY "cohorts_select_visible"
  ON cohorts FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR public.is_admin()
    OR public.is_cohort_instructor(id)
    OR public.is_enrolled(id)
  );

DROP POLICY IF EXISTS "cohorts_insert_admin" ON cohorts;
CREATE POLICY "cohorts_insert_admin"
  ON cohorts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cohorts_update_admin" ON cohorts;
CREATE POLICY "cohorts_update_admin"
  ON cohorts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cohorts_delete_admin" ON cohorts;
CREATE POLICY "cohorts_delete_admin"
  ON cohorts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: cohort_instructors
-- ============================================================================

DROP POLICY IF EXISTS "cohort_instructors_select_all" ON cohort_instructors;
CREATE POLICY "cohort_instructors_select_all"
  ON cohort_instructors FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cohort_instructors_insert_admin" ON cohort_instructors;
CREATE POLICY "cohort_instructors_insert_admin"
  ON cohort_instructors FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cohort_instructors_update_admin" ON cohort_instructors;
CREATE POLICY "cohort_instructors_update_admin"
  ON cohort_instructors FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cohort_instructors_delete_admin" ON cohort_instructors;
CREATE POLICY "cohort_instructors_delete_admin"
  ON cohort_instructors FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: enrolments
-- ============================================================================

DROP POLICY IF EXISTS "enrolments_select_own_or_instructor_or_admin" ON enrolments;
CREATE POLICY "enrolments_select_own_or_instructor_or_admin"
  ON enrolments FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "enrolments_insert_admin" ON enrolments;
CREATE POLICY "enrolments_insert_admin"
  ON enrolments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "enrolments_update_admin_or_instructor" ON enrolments;
CREATE POLICY "enrolments_update_admin_or_instructor"
  ON enrolments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "enrolments_delete_admin" ON enrolments;
CREATE POLICY "enrolments_delete_admin"
  ON enrolments FOR DELETE
  TO authenticated
  USING (public.is_admin());