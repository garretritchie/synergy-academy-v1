/*
# Live Sessions and Attendance Records

## Purpose
Establishes live-class management: dedicated records for each live session within a cohort, including scheduling, instructor assignment, session type, meeting links, related modules/lessons, preparation requirements, recordings, and resources. Attendance records track student presence per session.

## New Tables

### live_sessions
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `title` (text, not null)
- `description` (text)
- `session_type` (text — 'lecture', 'workshop', 'q_and_a', 'review', 'lab', 'office_hours', 'exam')
- `scheduled_start` (timestamptz, not null)
- `scheduled_end` (timestamptz, not null)
- `instructor_id` (uuid, references profiles.id — the instructor leading the session)
- `meeting_platform` (text — 'zoom', 'teams', 'meet', 'custom')
- `meeting_url` (text — join link)
- `meeting_id` (text — meeting ID for display)
- `meeting_password` (text — passcode for display)
- `recording_url` (text — posted after the session)
- `preparation_notes` (text — what students should prepare/review beforehand)
- `is_cancelled` (boolean, default false)
- `metadata` (jsonb — extensible)
- `created_by` (uuid, references profiles.id)
- `created_at`, `updated_at` (timestamptz)

### live_session_modules
- `id` (uuid, primary key)
- `live_session_id` (uuid, references live_sessions.id, on delete cascade)
- `module_id` (uuid, references modules.id, on delete cascade)
- Unique constraint on (live_session_id, module_id)

### live_session_lessons
- `id` (uuid, primary key)
- `live_session_id` (uuid, references live_sessions.id, on delete cascade)
- `lesson_id` (uuid, references lessons.id, on delete cascade)
- Unique constraint on (live_session_id, lesson_id)

### live_session_resources
- `id` (uuid, primary key)
- `live_session_id` (uuid, references live_sessions.id, on delete cascade)
- `resource_id` (uuid, references resources.id, on delete cascade)
- Unique constraint on (live_session_id, resource_id)

### attendance_records
- `id` (uuid, primary key)
- `live_session_id` (uuid, references live_sessions.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `enrolment_id` (uuid, references enrolments.id, on delete cascade)
- `status` (text — 'present', 'absent', 'late', 'excused', 'partial')
- `arrived_at` (timestamptz — when the student joined, for late tracking)
- `left_at` (timestamptz — when the student left, for partial attendance)
- `notes` (text — instructor notes about the absence/lateness)
- `recorded_by` (uuid, references profiles.id — who recorded the attendance)
- `created_at`, `updated_at` (timestamptz)
- Unique constraint on (live_session_id, student_id)

## Security (RLS)

### live_sessions
- SELECT: admins, cohort instructors, and enrolled students can read.
- INSERT/UPDATE/DELETE: administrators and cohort instructors.

### live_session_modules / live_session_lessons / live_session_resources
- SELECT: follows live session visibility.
- INSERT/UPDATE/DELETE: administrators and cohort instructors.

### attendance_records
- SELECT: students can read ONLY their own attendance. Instructors can read attendance for sessions they teach. Admins read all.
- INSERT/UPDATE: instructors (for sessions they teach) and admins.
- DELETE: admins only.

## Important Notes
1. Session type is extensible — new types can be added via the text field without schema changes.
2. Meeting platform supports Zoom, Teams, Meet, and custom URLs — never hard-coded to one provider.
3. Related modules/lessons/resources use junction tables for many-to-many relationships.
4. Attendance status supports 'present', 'absent', 'late', 'excused', 'partial' — not just binary.
5. `arrived_at` and `left_at` support late arrival and early departure tracking.
6. Students can only see their own attendance — never another student's.
*/

-- ============================================================================
-- LIVE_SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  session_type text DEFAULT 'lecture',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  instructor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  meeting_platform text DEFAULT 'custom',
  meeting_url text,
  meeting_id text,
  meeting_password text,
  recording_url text,
  preparation_notes text,
  is_cancelled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_live_sessions_cohort_id ON live_sessions(cohort_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_instructor_id ON live_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled_start ON live_sessions(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_live_sessions_is_cancelled ON live_sessions(is_cancelled);

CREATE OR REPLACE FUNCTION public.update_live_sessions_updated_at()
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

DROP TRIGGER IF EXISTS trg_live_sessions_updated_at ON live_sessions;
CREATE TRIGGER trg_live_sessions_updated_at
  BEFORE UPDATE ON live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_live_sessions_updated_at();

-- ============================================================================
-- LIVE_SESSION_MODULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_session_id, module_id)
);

ALTER TABLE live_session_modules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_live_session_modules_session_id ON live_session_modules(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_modules_module_id ON live_session_modules(module_id);

-- ============================================================================
-- LIVE_SESSION_LESSONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_session_id, lesson_id)
);

ALTER TABLE live_session_lessons ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_live_session_lessons_session_id ON live_session_lessons(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_lessons_lesson_id ON live_session_lessons(lesson_id);

-- ============================================================================
-- LIVE_SESSION_RESOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_session_id, resource_id)
);

ALTER TABLE live_session_resources ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_live_session_resources_session_id ON live_session_resources(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_resources_resource_id ON live_session_resources(resource_id);

-- ============================================================================
-- ATTENDANCE_RECORDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'absent',
  arrived_at timestamptz,
  left_at timestamptz,
  notes text,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (live_session_id, student_id)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attendance_records_live_session_id ON attendance_records(live_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_enrolment_id ON attendance_records(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);

CREATE OR REPLACE FUNCTION public.update_attendance_records_updated_at()
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

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_records_updated_at();

-- ============================================================================
-- RLS POLICIES: live_sessions
-- ============================================================================

DROP POLICY IF EXISTS "live_sessions_select_visible" ON live_sessions;
CREATE POLICY "live_sessions_select_visible"
  ON live_sessions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR public.is_enrolled(cohort_id)
  );

DROP POLICY IF EXISTS "live_sessions_insert_admin_or_instructor" ON live_sessions;
CREATE POLICY "live_sessions_insert_admin_or_instructor"
  ON live_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "live_sessions_update_admin_or_instructor" ON live_sessions;
CREATE POLICY "live_sessions_update_admin_or_instructor"
  ON live_sessions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "live_sessions_delete_admin_or_instructor" ON live_sessions;
CREATE POLICY "live_sessions_delete_admin_or_instructor"
  ON live_sessions FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

-- ============================================================================
-- RLS POLICIES: live_session_modules
-- ============================================================================

DROP POLICY IF EXISTS "live_session_modules_select_visible" ON live_session_modules;
CREATE POLICY "live_session_modules_select_visible"
  ON live_session_modules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_modules.live_session_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(ls.cohort_id)
        OR public.is_enrolled(ls.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "live_session_modules_insert_admin_or_instructor" ON live_session_modules;
CREATE POLICY "live_session_modules_insert_admin_or_instructor"
  ON live_session_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_modules.live_session_id
      AND (public.is_admin() OR public.is_cohort_instructor(ls.cohort_id))
    )
  );

DROP POLICY IF EXISTS "live_session_modules_delete_admin_or_instructor" ON live_session_modules;
CREATE POLICY "live_session_modules_delete_admin_or_instructor"
  ON live_session_modules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_modules.live_session_id
      AND (public.is_admin() OR public.is_cohort_instructor(ls.cohort_id))
    )
  );

-- ============================================================================
-- RLS POLICIES: live_session_lessons
-- ============================================================================

DROP POLICY IF EXISTS "live_session_lessons_select_visible" ON live_session_lessons;
CREATE POLICY "live_session_lessons_select_visible"
  ON live_session_lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_lessons.live_session_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(ls.cohort_id)
        OR public.is_enrolled(ls.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "live_session_lessons_insert_admin_or_instructor" ON live_session_lessons;
CREATE POLICY "live_session_lessons_insert_admin_or_instructor"
  ON live_session_lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_lessons.live_session_id
      AND (public.is_admin() OR public.is_cohort_instructor(ls.cohort_id))
    )
  );

DROP POLICY IF EXISTS "live_session_lessons_delete_admin_or_instructor" ON live_session_lessons;
CREATE POLICY "live_session_lessons_delete_admin_or_instructor"
  ON live_session_lessons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_lessons.live_session_id
      AND (public.is_admin() OR public.is_cohort_instructor(ls.cohort_id))
    )
  );

-- ============================================================================
-- RLS POLICIES: live_session_resources
-- ============================================================================

DROP POLICY IF EXISTS "live_session_resources_select_visible" ON live_session_resources;
CREATE POLICY "live_session_resources_select_visible"
  ON live_session_resources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_resources.live_session_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(ls.cohort_id)
        OR public.is_enrolled(ls.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "live_session_resources_insert_admin_or_instructor" ON live_session_resources;
CREATE POLICY "live_session_resources_insert_admin_or_instructor"
  ON live_session_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_resources.live_session_id
      AND (public.is_admin() OR public.is_cohort_instructor(ls.cohort_id))
    )
  );

DROP POLICY IF EXISTS "live_session_resources_delete_admin_or_instructor" ON live_session_resources;
CREATE POLICY "live_session_resources_delete_admin_or_instructor"
  ON live_session_resources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_session_resources.live_session_id
      AND (public.is_admin() OR public.is_cohort_instructor(ls.cohort_id))
    )
  );

-- ============================================================================
-- RLS POLICIES: attendance_records
-- ============================================================================

DROP POLICY IF EXISTS "attendance_select_own_or_instructor_or_admin" ON attendance_records;
CREATE POLICY "attendance_select_own_or_instructor_or_admin"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = attendance_records.live_session_id
        AND public.is_cohort_instructor(ls.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attendance_insert_instructor_or_admin" ON attendance_records;
CREATE POLICY "attendance_insert_instructor_or_admin"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = attendance_records.live_session_id
        AND public.is_cohort_instructor(ls.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attendance_update_instructor_or_admin" ON attendance_records;
CREATE POLICY "attendance_update_instructor_or_admin"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = attendance_records.live_session_id
        AND public.is_cohort_instructor(ls.cohort_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = attendance_records.live_session_id
        AND public.is_cohort_instructor(ls.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attendance_delete_admin" ON attendance_records;
CREATE POLICY "attendance_delete_admin"
  ON attendance_records FOR DELETE
  TO authenticated
  USING (public.is_admin());