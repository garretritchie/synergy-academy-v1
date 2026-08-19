/*
# Assignments, Submissions, and Submission Files

## Purpose
Establishes the assignment and homework system: assignments are created by instructors/admins within modules or lessons, students submit work privately, and submissions can include file uploads stored in Supabase Storage.

## New Tables

### assignments
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade — nullable for course-wide assignments)
- `module_id` (uuid, references modules.id, on delete cascade — nullable)
- `lesson_id` (uuid, references lessons.id, on delete cascade — nullable)
- `title` (text, not null)
- `description` (text — assignment instructions/prompt)
- `assignment_type` (text — 'homework', 'project', 'essay', 'presentation', 'quiz', 'lab_report')
- `max_points` (numeric(5,2), default 100)
- `weight` (numeric(5,2) — weight within grade category, default 1)
- `due_date` (timestamptz)
- `allow_late_submission` (boolean, default true)
- `late_penalty_percent` (numeric(5,2) — penalty for late submissions)
- `late_submission_deadline` (timestamptz — hard cutoff for late submissions)
- `allow_file_upload` (boolean, default true)
- `allowed_file_types` (text[] — e.g. ['pdf', 'docx', 'zip'])
- `max_file_size_mb` (int — per-file size limit)
- `min_words` (int — for essay-type assignments)
- `max_words` (int — for essay-type assignments)
- `is_published` (boolean, default false)
- `created_by` (uuid, references profiles.id)
- `created_at`, `updated_at` (timestamptz)

### submissions
- `id` (uuid, primary key)
- `assignment_id` (uuid, references assignments.id, on delete cascade)
- `enrolment_id` (uuid, references enrolments.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `content` (text — text submission content)
- `status` (text — 'draft', 'submitted', 'late', 'graded', 'returned')
- `submitted_at` (timestamptz)
- `is_late` (boolean, default false)
- `late_penalty_applied` (numeric(5,2) — penalty applied)
- `grade` (numeric(5,2) — assigned by instructor)
- `max_grade` (numeric(5,2) — copied from assignment at grade time)
- `feedback` (text — instructor feedback)
- `graded_by` (uuid, references profiles.id)
- `graded_at` (timestamptz)
- `created_at`, `updated_at` (timestamptz)
- Unique constraint on (assignment_id, enrolment_id)

### submission_files
- `id` (uuid, primary key)
- `submission_id` (uuid, references submissions.id, on delete cascade)
- `file_name` (text, not null)
- `file_path` (text, not null — storage path)
- `file_url` (text — public/signed URL)
- `file_size` (bigint)
- `file_type` (text — MIME type)
- `created_at` (timestamptz)

## Security (RLS)

### assignments
- SELECT: admins, cohort instructors, and enrolled students can read published assignments.
- INSERT/UPDATE/DELETE: administrators and cohort instructors.

### submissions
- SELECT: students can read ONLY their own submissions. Instructors can read submissions for cohorts they teach. Admins read all.
- INSERT: students can insert their own submissions. Instructors/admins can also insert (for manual entry).
- UPDATE: students can update their own submissions (only if status is 'draft' or 'returned'). Instructors can update (for grading).
- DELETE: students can delete their own draft submissions. Admins can delete any.

### submission_files
- SELECT: follows submission visibility — only the student who owns the submission and instructors/admins.
- INSERT: the student who owns the submission or instructors/admins.
- DELETE: the student who owns the submission or admins.

## Storage
A Supabase Storage bucket named 'submissions' should be created for file uploads. Files are stored at path: `{cohort_id}/{student_id}/{submission_id}/{filename}`.

## Important Notes
1. Assignments can be attached at cohort, module, or lesson level via nullable foreign keys.
2. Submissions are private — students never see other students' submissions.
3. The submission lifecycle: draft → submitted → graded → returned (for revisions).
4. Late submission support with configurable penalty and hard deadline.
5. File upload support with configurable file types and size limits.
6. Essay-type assignments can have min/max word count constraints.
*/

-- ============================================================================
-- ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES cohorts(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignment_type text DEFAULT 'homework',
  max_points numeric(5,2) NOT NULL DEFAULT 100,
  weight numeric(5,2) NOT NULL DEFAULT 1,
  due_date timestamptz,
  allow_late_submission boolean NOT NULL DEFAULT true,
  late_penalty_percent numeric(5,2),
  late_submission_deadline timestamptz,
  allow_file_upload boolean NOT NULL DEFAULT true,
  allowed_file_types text[],
  max_file_size_mb int,
  min_words int,
  max_words int,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assignments_cohort_id ON assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON assignments(module_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson_id ON assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_is_published ON assignments(is_published);

CREATE OR REPLACE FUNCTION public.update_assignments_updated_at()
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

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON assignments;
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assignments_updated_at();

-- ============================================================================
-- SUBMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  is_late boolean NOT NULL DEFAULT false,
  late_penalty_applied numeric(5,2),
  grade numeric(5,2),
  max_grade numeric(5,2),
  feedback text,
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, enrolment_id)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_enrolment_id ON submissions(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

CREATE OR REPLACE FUNCTION public.update_submissions_updated_at()
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

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON submissions;
CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_submissions_updated_at();

-- ============================================================================
-- SUBMISSION_FILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text,
  file_size bigint,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON submission_files(submission_id);

-- ============================================================================
-- RLS POLICIES: assignments
-- ============================================================================

DROP POLICY IF EXISTS "assignments_select_visible" ON assignments;
CREATE POLICY "assignments_select_visible"
  ON assignments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      cohort_id IS NOT NULL AND public.is_cohort_instructor(cohort_id)
    )
    OR (
      cohort_id IS NOT NULL AND public.is_enrolled(cohort_id) AND is_published = true
    )
  );

DROP POLICY IF EXISTS "assignments_insert_admin_or_instructor" ON assignments;
CREATE POLICY "assignments_insert_admin_or_instructor"
  ON assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (cohort_id IS NOT NULL AND public.is_cohort_instructor(cohort_id))
  );

DROP POLICY IF EXISTS "assignments_update_admin_or_instructor" ON assignments;
CREATE POLICY "assignments_update_admin_or_instructor"
  ON assignments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (cohort_id IS NOT NULL AND public.is_cohort_instructor(cohort_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (cohort_id IS NOT NULL AND public.is_cohort_instructor(cohort_id))
  );

DROP POLICY IF EXISTS "assignments_delete_admin_or_instructor" ON assignments;
CREATE POLICY "assignments_delete_admin_or_instructor"
  ON assignments FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (cohort_id IS NOT NULL AND public.is_cohort_instructor(cohort_id))
  );

-- ============================================================================
-- RLS POLICIES: submissions
-- ============================================================================

DROP POLICY IF EXISTS "submissions_select_own_or_instructor_or_admin" ON submissions;
CREATE POLICY "submissions_select_own_or_instructor_or_admin"
  ON submissions FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = submissions.assignment_id
        AND a.cohort_id IS NOT NULL
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "submissions_insert_own_or_instructor_or_admin" ON submissions;
CREATE POLICY "submissions_insert_own_or_instructor_or_admin"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = submissions.assignment_id
        AND a.cohort_id IS NOT NULL
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "submissions_update_own_or_instructor_or_admin" ON submissions;
CREATE POLICY "submissions_update_own_or_instructor_or_admin"
  ON submissions FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = submissions.assignment_id
        AND a.cohort_id IS NOT NULL
        AND public.is_cohort_instructor(a.cohort_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.id = submissions.assignment_id
        AND a.cohort_id IS NOT NULL
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "submissions_delete_own_draft_or_admin" ON submissions;
CREATE POLICY "submissions_delete_own_draft_or_admin"
  ON submissions FOR DELETE
  TO authenticated
  USING (
    (student_id = auth.uid() AND status = 'draft')
    OR public.is_admin()
  );

-- ============================================================================
-- RLS POLICIES: submission_files
-- ============================================================================

DROP POLICY IF EXISTS "submission_files_select_visible" ON submission_files;
CREATE POLICY "submission_files_select_visible"
  ON submission_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_files.submission_id
      AND (
        s.student_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.id = s.assignment_id
            AND a.cohort_id IS NOT NULL
            AND public.is_cohort_instructor(a.cohort_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "submission_files_insert_visible" ON submission_files;
CREATE POLICY "submission_files_insert_visible"
  ON submission_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_files.submission_id
      AND (
        s.student_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.id = s.assignment_id
            AND a.cohort_id IS NOT NULL
            AND public.is_cohort_instructor(a.cohort_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "submission_files_delete_visible" ON submission_files;
CREATE POLICY "submission_files_delete_visible"
  ON submission_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_files.submission_id
      AND (
        (s.student_id = auth.uid() AND s.status = 'draft')
        OR public.is_admin()
      )
    )
  );