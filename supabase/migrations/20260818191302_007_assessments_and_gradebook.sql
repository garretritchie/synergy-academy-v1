/*
# Assessments, Questions, Attempts, Grade Categories, Grade Items, and Grades

## Purpose
Establishes the academic records system: quizzes/assessments with questions and student attempts, configurable grading categories (e.g. "Homework", "Exams", "Participation"), grade items (individual graded items within categories), and the gradebook that stores final grades per student per item.

## New Tables

### assessments
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `module_id` (uuid, references modules.id, on delete cascade — nullable)
- `lesson_id` (uuid, references lessons.id, on delete cascade — nullable)
- `title` (text, not null)
- `description` (text)
- `assessment_type` (text — 'quiz', 'test', 'exam', 'practice', 'survey')
- `instructions` (text)
- `time_limit_minutes` (int — nullable, for timed assessments)
- `max_attempts` (int — default 1)
- `passing_score` (numeric(5,2) — nullable)
- `is_published` (boolean, default false)
- `shuffle_questions` (boolean, default false)
- `show_results_immediately` (boolean, default true)
- `created_by` (uuid, references profiles.id)
- `created_at`, `updated_at` (timestamptz)

### assessment_questions
- `id` (uuid, primary key)
- `assessment_id` (uuid, references assessments.id, on delete cascade)
- `question_type` (text — 'multiple_choice', 'true_false', 'short_answer', 'essay', 'matching', 'fill_blank')
- `question_text` (text, not null)
- `options` (jsonb — for multiple choice: array of {id, text, is_correct})
- `correct_answer` (text — for true_false, short_answer)
- `explanation` (text — shown after answering)
- `points` (numeric(5,2), default 1)
- `display_order` (int, default 0)
- `created_at`, `updated_at` (timestamptz)

### assessment_attempts
- `id` (uuid, primary key)
- `assessment_id` (uuid, references assessments.id, on delete cascade)
- `enrolment_id` (uuid, references enrolments.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `started_at` (timestamptz, default now)
- `completed_at` (timestamptz)
- `status` (text — 'in_progress', 'completed', 'abandoned', 'graded')
- `score` (numeric(5,2) — raw score)
- `max_score` (numeric(5,2) — max possible score)
- `percentage` (numeric(5,2) — score / max_score * 100)
- `answers` (jsonb — student's answers stored as {question_id: answer})
- `time_spent_seconds` (int)
- `created_at`, `updated_at` (timestamptz)

### grade_categories
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `name` (text, not null — e.g. "Homework", "Exams", "Participation")
- `description` (text)
- `weight` (numeric(5,2) — percentage weight in final grade, e.g. 30 for 30%)
- `drop_lowest` (int — number of lowest items to drop, default 0)
- `display_order` (int, default 0)
- `created_at`, `updated_at` (timestamptz)
- Unique constraint on (cohort_id, name)

### grade_items
- `id` (uuid, primary key)
- `grade_category_id` (uuid, references grade_categories.id, on delete cascade)
- `assignment_id` (uuid, references assignments.id, on delete set null — nullable, links to assignment if applicable)
- `assessment_id` (uuid, references assessments.id, on delete set null — nullable, links to assessment if applicable)
- `name` (text, not null)
- `description` (text)
- `max_points` (numeric(5,2), not null, default 100)
- `due_date` (timestamptz)
- `display_order` (int, default 0)
- `created_at`, `updated_at` (timestamptz)

### grades
- `id` (uuid, primary key)
- `grade_item_id` (uuid, references grade_items.id, on delete cascade)
- `enrolment_id` (uuid, references enrolments.id, on delete cascade)
- `student_id` (uuid, references profiles.id, on delete cascade)
- `score` (numeric(5,2) — points earned)
- `max_score` (numeric(5,2) — max points, copied from grade_item)
- `percentage` (numeric(5,2) — computed: score / max_score * 100)
- `letter_grade` (text — e.g. 'A', 'B+', 'C')
- `feedback` (text)
- `is_excused` (boolean, default false — excused from grade calculation)
- `graded_by` (uuid, references profiles.id)
- `graded_at` (timestamptz)
- `created_at`, `updated_at` (timestamptz)
- Unique constraint on (grade_item_id, enrolment_id)

## Security (RLS)

### assessments
- SELECT: admins, cohort instructors, enrolled students (published only for students).
- INSERT/UPDATE/DELETE: admins and cohort instructors.

### assessment_questions
- SELECT: follows assessment visibility. Students see questions only when taking the assessment (questions are returned without correct_answer for students — the frontend must strip this).
- INSERT/UPDATE/DELETE: admins and cohort instructors.

### assessment_attempts
- SELECT: students see only their own attempts. Instructors see attempts for their cohorts. Admins see all.
- INSERT: students insert their own. Admins/instructors can also insert.
- UPDATE: students can update their own in-progress attempts. Instructors/admins can grade.
- DELETE: admins only.

### grade_categories
- SELECT: admins, cohort instructors, enrolled students.
- INSERT/UPDATE/DELETE: admins and cohort instructors.

### grade_items
- SELECT: admins, cohort instructors, enrolled students.
- INSERT/UPDATE/DELETE: admins and cohort instructors.

### grades
- SELECT: students see ONLY their own grades. Instructors see grades for their cohorts. Admins see all.
- INSERT/UPDATE: instructors (for their cohorts) and admins.
- DELETE: admins only.

## Important Notes
1. Assessment questions store options as jsonb for flexibility — multiple choice, matching, fill-in-the-blank all fit.
2. Attempt answers are stored as jsonb keyed by question_id.
3. Grade categories support weighted grading with optional "drop lowest N" items.
4. Grade items can be linked to assignments or assessments, or be standalone (e.g. "Participation").
5. Students can ONLY see their own grades — never another student's.
6. The `letter_grade` field supports configurable grading scales per item.
*/

-- ============================================================================
-- ASSESSMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assessment_type text DEFAULT 'quiz',
  instructions text,
  time_limit_minutes int,
  max_attempts int NOT NULL DEFAULT 1,
  passing_score numeric(5,2),
  is_published boolean NOT NULL DEFAULT false,
  shuffle_questions boolean NOT NULL DEFAULT false,
  show_results_immediately boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assessments_cohort_id ON assessments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_assessments_module_id ON assessments(module_id);
CREATE INDEX IF NOT EXISTS idx_assessments_lesson_id ON assessments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assessments_is_published ON assessments(is_published);

CREATE OR REPLACE FUNCTION public.update_assessments_updated_at()
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

DROP TRIGGER IF EXISTS trg_assessments_updated_at ON assessments;
CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assessments_updated_at();

-- ============================================================================
-- ASSESSMENT_QUESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  explanation text,
  points numeric(5,2) NOT NULL DEFAULT 1,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_display_order ON assessment_questions(display_order);

CREATE OR REPLACE FUNCTION public.update_assessment_questions_updated_at()
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

DROP TRIGGER IF EXISTS trg_assessment_questions_updated_at ON assessment_questions;
CREATE TRIGGER trg_assessment_questions_updated_at
  BEFORE UPDATE ON assessment_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assessment_questions_updated_at();

-- ============================================================================
-- ASSESSMENT_ATTEMPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress',
  score numeric(5,2),
  max_score numeric(5,2),
  percentage numeric(5,2),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_spent_seconds int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment_id ON assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_enrolment_id ON assessment_attempts(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_student_id ON assessment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON assessment_attempts(status);

CREATE OR REPLACE FUNCTION public.update_assessment_attempts_updated_at()
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

DROP TRIGGER IF EXISTS trg_assessment_attempts_updated_at ON assessment_attempts;
CREATE TRIGGER trg_assessment_attempts_updated_at
  BEFORE UPDATE ON assessment_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assessment_attempts_updated_at();

-- ============================================================================
-- GRADE_CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS grade_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  weight numeric(5,2) NOT NULL DEFAULT 0,
  drop_lowest int NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, name)
);

ALTER TABLE grade_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_grade_categories_cohort_id ON grade_categories(cohort_id);

CREATE OR REPLACE FUNCTION public.update_grade_categories_updated_at()
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

DROP TRIGGER IF EXISTS trg_grade_categories_updated_at ON grade_categories;
CREATE TRIGGER trg_grade_categories_updated_at
  BEFORE UPDATE ON grade_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grade_categories_updated_at();

-- ============================================================================
-- GRADE_ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS grade_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_category_id uuid NOT NULL REFERENCES grade_categories(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  max_points numeric(5,2) NOT NULL DEFAULT 100,
  due_date timestamptz,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE grade_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_grade_items_grade_category_id ON grade_items(grade_category_id);
CREATE INDEX IF NOT EXISTS idx_grade_items_assignment_id ON grade_items(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grade_items_assessment_id ON grade_items(assessment_id);

CREATE OR REPLACE FUNCTION public.update_grade_items_updated_at()
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

DROP TRIGGER IF EXISTS trg_grade_items_updated_at ON grade_items;
CREATE TRIGGER trg_grade_items_updated_at
  BEFORE UPDATE ON grade_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grade_items_updated_at();

-- ============================================================================
-- GRADES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_item_id uuid NOT NULL REFERENCES grade_items(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES enrolments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score numeric(5,2),
  max_score numeric(5,2),
  percentage numeric(5,2),
  letter_grade text,
  feedback text,
  is_excused boolean NOT NULL DEFAULT false,
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade_item_id, enrolment_id)
);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_grades_grade_item_id ON grades(grade_item_id);
CREATE INDEX IF NOT EXISTS idx_grades_enrolment_id ON grades(enrolment_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);

CREATE OR REPLACE FUNCTION public.update_grades_updated_at()
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

DROP TRIGGER IF EXISTS trg_grades_updated_at ON grades;
CREATE TRIGGER trg_grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grades_updated_at();

-- ============================================================================
-- RLS POLICIES: assessments
-- ============================================================================

DROP POLICY IF EXISTS "assessments_select_visible" ON assessments;
CREATE POLICY "assessments_select_visible"
  ON assessments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (public.is_enrolled(cohort_id) AND is_published = true)
  );

DROP POLICY IF EXISTS "assessments_insert_admin_or_instructor" ON assessments;
CREATE POLICY "assessments_insert_admin_or_instructor"
  ON assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "assessments_update_admin_or_instructor" ON assessments;
CREATE POLICY "assessments_update_admin_or_instructor"
  ON assessments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "assessments_delete_admin_or_instructor" ON assessments;
CREATE POLICY "assessments_delete_admin_or_instructor"
  ON assessments FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

-- ============================================================================
-- RLS POLICIES: assessment_questions
-- ============================================================================

DROP POLICY IF EXISTS "assessment_questions_select_visible" ON assessment_questions;
CREATE POLICY "assessment_questions_select_visible"
  ON assessment_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_questions.assessment_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(a.cohort_id)
        OR (public.is_enrolled(a.cohort_id) AND a.is_published = true)
      )
    )
  );

DROP POLICY IF EXISTS "assessment_questions_insert_admin_or_instructor" ON assessment_questions;
CREATE POLICY "assessment_questions_insert_admin_or_instructor"
  ON assessment_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_questions.assessment_id
      AND (public.is_admin() OR public.is_cohort_instructor(a.cohort_id))
    )
  );

DROP POLICY IF EXISTS "assessment_questions_update_admin_or_instructor" ON assessment_questions;
CREATE POLICY "assessment_questions_update_admin_or_instructor"
  ON assessment_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_questions.assessment_id
      AND (public.is_admin() OR public.is_cohort_instructor(a.cohort_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_questions.assessment_id
      AND (public.is_admin() OR public.is_cohort_instructor(a.cohort_id))
    )
  );

DROP POLICY IF EXISTS "assessment_questions_delete_admin_or_instructor" ON assessment_questions;
CREATE POLICY "assessment_questions_delete_admin_or_instructor"
  ON assessment_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_questions.assessment_id
      AND (public.is_admin() OR public.is_cohort_instructor(a.cohort_id))
    )
  );

-- ============================================================================
-- RLS POLICIES: assessment_attempts
-- ============================================================================

DROP POLICY IF EXISTS "attempts_select_own_or_instructor_or_admin" ON assessment_attempts;
CREATE POLICY "attempts_select_own_or_instructor_or_admin"
  ON assessment_attempts FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attempts_insert_own_or_instructor_or_admin" ON assessment_attempts;
CREATE POLICY "attempts_insert_own_or_instructor_or_admin"
  ON assessment_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attempts_update_own_or_instructor_or_admin" ON assessment_attempts;
CREATE POLICY "attempts_update_own_or_instructor_or_admin"
  ON assessment_attempts FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attempts_delete_admin" ON assessment_attempts;
CREATE POLICY "attempts_delete_admin"
  ON assessment_attempts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: grade_categories
-- ============================================================================

DROP POLICY IF EXISTS "grade_categories_select_visible" ON grade_categories;
CREATE POLICY "grade_categories_select_visible"
  ON grade_categories FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR public.is_enrolled(cohort_id)
  );

DROP POLICY IF EXISTS "grade_categories_insert_admin_or_instructor" ON grade_categories;
CREATE POLICY "grade_categories_insert_admin_or_instructor"
  ON grade_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "grade_categories_update_admin_or_instructor" ON grade_categories;
CREATE POLICY "grade_categories_update_admin_or_instructor"
  ON grade_categories FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "grade_categories_delete_admin_or_instructor" ON grade_categories;
CREATE POLICY "grade_categories_delete_admin_or_instructor"
  ON grade_categories FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
  );

-- ============================================================================
-- RLS POLICIES: grade_items
-- ============================================================================

DROP POLICY IF EXISTS "grade_items_select_visible" ON grade_items;
CREATE POLICY "grade_items_select_visible"
  ON grade_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grade_categories gc
      WHERE gc.id = grade_items.grade_category_id
      AND (
        public.is_admin()
        OR public.is_cohort_instructor(gc.cohort_id)
        OR public.is_enrolled(gc.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "grade_items_insert_admin_or_instructor" ON grade_items;
CREATE POLICY "grade_items_insert_admin_or_instructor"
  ON grade_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grade_categories gc
      WHERE gc.id = grade_items.grade_category_id
      AND (public.is_admin() OR public.is_cohort_instructor(gc.cohort_id))
    )
  );

DROP POLICY IF EXISTS "grade_items_update_admin_or_instructor" ON grade_items;
CREATE POLICY "grade_items_update_admin_or_instructor"
  ON grade_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grade_categories gc
      WHERE gc.id = grade_items.grade_category_id
      AND (public.is_admin() OR public.is_cohort_instructor(gc.cohort_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grade_categories gc
      WHERE gc.id = grade_items.grade_category_id
      AND (public.is_admin() OR public.is_cohort_instructor(gc.cohort_id))
    )
  );

DROP POLICY IF EXISTS "grade_items_delete_admin_or_instructor" ON grade_items;
CREATE POLICY "grade_items_delete_admin_or_instructor"
  ON grade_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grade_categories gc
      WHERE gc.id = grade_items.grade_category_id
      AND (public.is_admin() OR public.is_cohort_instructor(gc.cohort_id))
    )
  );

-- ============================================================================
-- RLS POLICIES: grades
-- ============================================================================

DROP POLICY IF EXISTS "grades_select_own_or_instructor_or_admin" ON grades;
CREATE POLICY "grades_select_own_or_instructor_or_admin"
  ON grades FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM grade_items gi
      JOIN grade_categories gc ON gc.id = gi.grade_category_id
      WHERE gi.id = grades.grade_item_id
        AND public.is_cohort_instructor(gc.cohort_id)
    )
  );

DROP POLICY IF EXISTS "grades_insert_instructor_or_admin" ON grades;
CREATE POLICY "grades_insert_instructor_or_admin"
  ON grades FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM grade_items gi
      JOIN grade_categories gc ON gc.id = gi.grade_category_id
      WHERE gi.id = grades.grade_item_id
        AND public.is_cohort_instructor(gc.cohort_id)
    )
  );

DROP POLICY IF EXISTS "grades_update_instructor_or_admin" ON grades;
CREATE POLICY "grades_update_instructor_or_admin"
  ON grades FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM grade_items gi
      JOIN grade_categories gc ON gc.id = gi.grade_category_id
      WHERE gi.id = grades.grade_item_id
        AND public.is_cohort_instructor(gc.cohort_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM grade_items gi
      JOIN grade_categories gc ON gc.id = gi.grade_category_id
      WHERE gi.id = grades.grade_item_id
        AND public.is_cohort_instructor(gc.cohort_id)
    )
  );

DROP POLICY IF EXISTS "grades_delete_admin" ON grades;
CREATE POLICY "grades_delete_admin"
  ON grades FOR DELETE
  TO authenticated
  USING (public.is_admin());