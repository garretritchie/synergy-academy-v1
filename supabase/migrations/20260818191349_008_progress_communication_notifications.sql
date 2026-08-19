/*
# Progress Records, Announcements, Discussions, Posts, and Notifications

## Purpose
Establishes student progress tracking, course communication (announcements), discussion forums with Q&A, and a notification system.

## New Tables

### progress_records
- `id` (uuid, primary key)
- `enrolment_id` (uuid, references enrolments.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `lesson_id` (uuid, references lessons.id, on delete cascade)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `status` (text — 'not_started', 'in_progress', 'completed')
- `progress_percent` (int — 0-100, for partial completion of a lesson)
- `time_spent_seconds` (int — total time on this lesson)
- `last_accessed_at` (timestamptz)
- `completed_at` (timestamptz)
- `created_at`, `updated_at` (timestamptz)
- Unique constraint on (enrolment_id, lesson_id)

### announcements
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `title` (text, not null)
- `body` (text, not null)
- `is_pinned` (boolean, default false)
- `is_published` (boolean, default true)
- `author_id` (uuid, references profiles.id)
- `published_at` (timestamptz)
- `created_at`, `updated_at` (timestamptz)

### discussions
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `module_id` (uuid, references modules.id, on delete cascade — nullable)
- `lesson_id` (uuid, references lessons.id, on delete cascade — nullable)
- `title` (text, not null)
- `body` (text)
- `is_pinned` (boolean, default false)
- `is_locked` (boolean, default false)
- `author_id` (uuid, references profiles.id)
- `parent_id` (uuid, references discussions.id, on delete cascade — nullable, for threaded replies)
- `is_question` (boolean, default false — distinguishes Q&A from general discussion)
- `is_resolved` (boolean, default false — for Q&A threads)
- `created_at`, `updated_at` (timestamptz)

### discussion_posts
- `id` (uuid, primary key)
- `discussion_id` (uuid, references discussions.id, on delete cascade)
- `author_id` (uuid, references profiles.id)
- `body` (text, not null)
- `is_instructor_reply` (boolean, default false — highlights instructor responses)
- `is_accepted_answer` (boolean, default false — for Q&A accepted answers)
- `created_at`, `updated_at` (timestamptz)

### notifications
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles.id, on delete cascade)
- `type` (text — 'announcement', 'assignment', 'grade', 'live_session', 'discussion', 'enrolment', 'system')
- `title` (text, not null)
- `body` (text)
- `link_url` (text — where clicking the notification should navigate)
- `related_id` (uuid — ID of the related entity, e.g. announcement_id, assignment_id)
- `is_read` (boolean, default false)
- `read_at` (timestamptz)
- `created_at` (timestamptz)

## Security (RLS)

### progress_records
- SELECT: students see ONLY their own progress. Instructors see progress for their cohorts. Admins see all.
- INSERT/UPDATE: students can insert/update their own. Instructors/admins can also update.
- DELETE: admins only.

### announcements
- SELECT: admins, cohort instructors, enrolled students (published only for students).
- INSERT/UPDATE/DELETE: admins and cohort instructors.

### discussions
- SELECT: admins, cohort instructors, enrolled students.
- INSERT: all authenticated users who are enrolled or instructors in the cohort.
- UPDATE: the author, admins, and cohort instructors (for pinning/locking/resolving).
- DELETE: the author, admins, and cohort instructors.

### discussion_posts
- SELECT: follows discussion visibility.
- INSERT: all authenticated users who can see the discussion.
- UPDATE: the author only (for editing their own post). Instructors can mark accepted answers.
- DELETE: the author, admins, and cohort instructors.

### notifications
- SELECT: users see ONLY their own notifications.
- INSERT: system/admin/instructor can create notifications for any user. Students cannot create notifications for others.
- UPDATE: users can update (mark as read) their own notifications.
- DELETE: users can delete their own notifications. Admins can delete any.

## Important Notes
1. Progress records track per-lesson completion status and time spent — the foundation for "Continue Learning" and "on-track status" on the student dashboard.
2. Announcements are cohort-scoped, support pinning and draft/published states.
3. Discussions support threaded replies via `parent_id` and distinguish Q&A threads via `is_question` and `is_resolved`.
4. `is_accepted_answer` on posts supports Stack Overflow-style Q&A resolution.
5. Notifications are user-scoped and support a `link_url` for click-through navigation.
6. Students can ONLY see their own progress and notifications — never another student's.
*/

-- ============================================================================
-- PROGRESS_RECORDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  progress_percent int NOT NULL DEFAULT 0,
  time_spent_seconds int NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrolment_id, lesson_id)
);

ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_progress_records_enrolment_id ON progress_records(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_progress_records_student_id ON progress_records(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_records_lesson_id ON progress_records(lesson_id);
CREATE INDEX IF NOT EXISTS idx_progress_records_cohort_id ON progress_records(cohort_id);
CREATE INDEX IF NOT EXISTS idx_progress_records_status ON progress_records(status);

CREATE OR REPLACE FUNCTION public.update_progress_records_updated_at()
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

DROP TRIGGER IF EXISTS trg_progress_records_updated_at ON progress_records;
CREATE TRIGGER trg_progress_records_updated_at
  BEFORE UPDATE ON progress_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_progress_records_updated_at();

-- ============================================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_announcements_cohort_id ON announcements(cohort_id);
CREATE INDEX IF NOT EXISTS idx_announcements_is_published ON announcements(is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_is_pinned ON announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at);

CREATE OR REPLACE FUNCTION public.update_announcements_updated_at()
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

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_announcements_updated_at();

-- ============================================================================
-- DISCUSSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES discussions(id) ON DELETE CASCADE,
  is_question boolean NOT NULL DEFAULT false,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_discussions_cohort_id ON discussions(cohort_id);
CREATE INDEX IF NOT EXISTS idx_discussions_module_id ON discussions(module_id);
CREATE INDEX IF NOT EXISTS idx_discussions_lesson_id ON discussions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_discussions_author_id ON discussions(author_id);
CREATE INDEX IF NOT EXISTS idx_discussions_parent_id ON discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussions_is_question ON discussions(is_question);
CREATE INDEX IF NOT EXISTS idx_discussions_is_pinned ON discussions(is_pinned);

CREATE OR REPLACE FUNCTION public.update_discussions_updated_at()
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

DROP TRIGGER IF EXISTS trg_discussions_updated_at ON discussions;
CREATE TRIGGER trg_discussions_updated_at
  BEFORE UPDATE ON discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_discussions_updated_at();

-- ============================================================================
-- DISCUSSION_POSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS discussion_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_instructor_reply boolean NOT NULL DEFAULT false,
  is_accepted_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE discussion_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_discussion_posts_discussion_id ON discussion_posts(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_author_id ON discussion_posts(author_id);

CREATE OR REPLACE FUNCTION public.update_discussion_posts_updated_at()
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

DROP TRIGGER IF EXISTS trg_discussion_posts_updated_at ON discussion_posts;
CREATE TRIGGER trg_discussion_posts_updated_at
  BEFORE UPDATE ON discussion_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_discussion_posts_updated_at();

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  link_url text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================================================
-- RLS POLICIES: progress_records
-- ============================================================================

DROP POLICY IF EXISTS "progress_select_own_or_instructor_or_admin" ON progress_records;
CREATE POLICY "progress_select_own_or_instructor_or_admin"
  ON progress_records FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "progress_insert_own_or_instructor_or_admin" ON progress_records;
CREATE POLICY "progress_insert_own_or_instructor_or_admin"
  ON progress_records FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "progress_update_own_or_instructor_or_admin" ON progress_records;
CREATE POLICY "progress_update_own_or_instructor_or_admin"
  ON progress_records FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "progress_delete_admin" ON progress_records;
CREATE POLICY "progress_delete_admin"
  ON progress_records FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: announcements
-- ============================================================================

DROP POLICY IF EXISTS "announcements_select_visible" ON announcements;
CREATE POLICY "announcements_select_visible"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (public.is_enrolled(cohort_id) AND is_published = true)
  );

DROP POLICY IF EXISTS "announcements_insert_admin_or_instructor" ON announcements;
CREATE POLICY "announcements_insert_admin_or_instructor"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "announcements_update_admin_or_instructor" ON announcements;
CREATE POLICY "announcements_update_admin_or_instructor"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "announcements_delete_admin_or_instructor" ON announcements;
CREATE POLICY "announcements_delete_admin_or_instructor"
  ON announcements FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

-- ============================================================================
-- RLS POLICIES: discussions
-- ============================================================================

DROP POLICY IF EXISTS "discussions_select_visible" ON discussions;
CREATE POLICY "discussions_select_visible"
  ON discussions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR public.is_enrolled(cohort_id)
  );

DROP POLICY IF EXISTS "discussions_insert_visible" ON discussions;
CREATE POLICY "discussions_insert_visible"
  ON discussions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR public.is_enrolled(cohort_id)
  );

DROP POLICY IF EXISTS "discussions_update_author_or_instructor_or_admin" ON discussions;
CREATE POLICY "discussions_update_author_or_instructor_or_admin"
  ON discussions FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "discussions_delete_author_or_instructor_or_admin" ON discussions;
CREATE POLICY "discussions_delete_author_or_instructor_or_admin"
  ON discussions FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

-- ============================================================================
-- RLS POLICIES: discussion_posts
-- ============================================================================

DROP POLICY IF EXISTS "discussion_posts_select_visible" ON discussion_posts;
CREATE POLICY "discussion_posts_select_visible"
  ON discussion_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(d.cohort_id)
        OR public.is_enrolled(d.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "discussion_posts_insert_visible" ON discussion_posts;
CREATE POLICY "discussion_posts_insert_visible"
  ON discussion_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(d.cohort_id)
        OR public.is_enrolled(d.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "discussion_posts_update_author_or_instructor_or_admin" ON discussion_posts;
CREATE POLICY "discussion_posts_update_author_or_instructor_or_admin"
  ON discussion_posts FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND public.is_cohort_instructor(d.cohort_id)
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND public.is_cohort_instructor(d.cohort_id)
    )
  );

DROP POLICY IF EXISTS "discussion_posts_delete_author_or_instructor_or_admin" ON discussion_posts;
CREATE POLICY "discussion_posts_delete_author_or_instructor_or_admin"
  ON discussion_posts FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND public.is_cohort_instructor(d.cohort_id)
    )
  );

-- ============================================================================
-- RLS POLICIES: notifications
-- ============================================================================

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_admin_or_instructor_or_system" ON notifications;
CREATE POLICY "notifications_insert_admin_or_instructor_or_system"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_instructor()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON notifications;
CREATE POLICY "notifications_delete_own_or_admin"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );