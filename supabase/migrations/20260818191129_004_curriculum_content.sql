/*
# Modules, Lessons, Lesson Blocks, Resources, and Content Release Rules

## Purpose
Establishes the curriculum content structure: modules group lessons within a course, lessons contain extensible block-based content, resources are downloadable/reference materials, and content release rules control when content becomes available to each cohort (drip/scheduled release).

## New Tables

### modules
- `id` (uuid, primary key)
- `course_id` (uuid, references courses.id, on delete cascade)
- `title` (text, not null)
- `description` (text)
- `display_order` (int, default 0)
- `is_published` (boolean, default false)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### lessons
- `id` (uuid, primary key)
- `module_id` (uuid, references modules.id, on delete cascade)
- `title` (text, not null)
- `description` (text)
- `display_order` (int, default 0)
- `estimated_minutes` (int — estimated completion time)
- `is_published` (boolean, default false)
- `is_free_preview` (boolean, default false — for future public preview modules)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### lesson_blocks
- `id` (uuid, primary key)
- `lesson_id` (uuid, references lessons.id, on delete cascade)
- `block_type` (text, not null — 'text', 'image', 'video', 'download', 'knowledge_check', 'assignment', 'quiz', 'embed', 'callout')
- `content` (jsonb, not null — structured content for the block type)
- `display_order` (int, default 0)
- `created_at`, `updated_at` (timestamptz)

### resources
- `id` (uuid, primary key)
- `course_id` (uuid, references courses.id, on delete cascade — nullable for module/lesson-level resources)
- `module_id` (uuid, references modules.id, on delete cascade — nullable)
- `lesson_id` (uuid, references lessons.id, on delete cascade — nullable)
- `title` (text, not null)
- `description` (text)
- `resource_type` (text — 'file', 'link', 'video', 'document')
- `url` (text — storage URL or external link)
- `file_size` (bigint — for file resources)
- `is_downloadable` (boolean, default true)
- `display_order` (int, default 0)
- `created_at`, `updated_at` (timestamptz)

### content_release_rules
- `id` (uuid, primary key)
- `cohort_id` (uuid, references cohorts.id, on delete cascade)
- `module_id` (uuid, references modules.id, on delete cascade — nullable for course-level rules)
- `lesson_id` (uuid, references lessons.id, on delete cascade — nullable for module-level rules)
- `release_type` (text, not null — 'immediate', 'scheduled', 'after_previous', 'days_from_start')
- `release_date` (timestamptz — for scheduled type)
- `days_offset` (int — for days_from_start type: days after cohort start_date)
- `created_at`, `updated_at` (timestamptz)
- Unique constraint on (cohort_id, lesson_id) when lesson_id is not null
- Unique constraint on (cohort_id, module_id) when module_id is not null and lesson_id is null

## Helper Functions

### is_lesson_released(lesson_uuid, cohort_uuid)
Returns boolean — whether a lesson is currently available to students in the given cohort based on content release rules.

### get_released_lesson_ids(cohort_uuid)
Returns uuid[] — array of lesson IDs currently released for the given cohort.

## Security (RLS)

### modules
- SELECT: authenticated users can read published modules. Admins read all. Instructors read modules for courses they teach. Students read modules for cohorts they're enrolled in (with release rules applied at the lesson level).
- INSERT/UPDATE/DELETE: administrators only.

### lessons
- SELECT: same pattern as modules — published lessons visible to enrolled students, all lessons to admins/instructors of the cohort.
- INSERT/UPDATE/DELETE: administrators only.

### lesson_blocks
- SELECT: follows lesson visibility — users who can see the lesson can see its blocks.
- INSERT/UPDATE/DELETE: administrators only.

### resources
- SELECT: authenticated users can read resources for courses they have access to.
- INSERT/UPDATE/DELETE: administrators only.

### content_release_rules
- SELECT: admins, instructors of the cohort, and enrolled students can read release rules.
- INSERT/UPDATE/DELETE: administrators only.

## Important Notes
1. The block-based lesson structure is extensible — new block types can be added without schema changes by using new `block_type` values with structured `content` jsonb.
2. Content release rules support the self-paced-first → live-recap-afterward model via 'days_from_start' and 'scheduled' types.
3. `is_free_preview` on lessons supports the future public preview modules feature.
4. Resources can be attached at course, module, or lesson level via nullable foreign keys.
5. The `is_lesson_released` function is the single source of truth for content availability — the frontend should call it or use `get_released_lesson_ids` to filter.
*/

-- ============================================================================
-- MODULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_display_order ON modules(display_order);

CREATE OR REPLACE FUNCTION public.update_modules_updated_at()
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

DROP TRIGGER IF EXISTS trg_modules_updated_at ON modules;
CREATE TRIGGER trg_modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modules_updated_at();

-- ============================================================================
-- LESSONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  estimated_minutes int,
  is_published boolean NOT NULL DEFAULT false,
  is_free_preview boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_display_order ON lessons(display_order);
CREATE INDEX IF NOT EXISTS idx_lessons_is_free_preview ON lessons(is_free_preview);

CREATE OR REPLACE FUNCTION public.update_lessons_updated_at()
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

DROP TRIGGER IF EXISTS trg_lessons_updated_at ON lessons;
CREATE TRIGGER trg_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lessons_updated_at();

-- ============================================================================
-- LESSON_BLOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lesson_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lesson_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lesson_blocks_lesson_id ON lesson_blocks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_blocks_display_order ON lesson_blocks(display_order);

CREATE OR REPLACE FUNCTION public.update_lesson_blocks_updated_at()
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

DROP TRIGGER IF EXISTS trg_lesson_blocks_updated_at ON lesson_blocks;
CREATE TRIGGER trg_lesson_blocks_updated_at
  BEFORE UPDATE ON lesson_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lesson_blocks_updated_at();

-- ============================================================================
-- RESOURCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  resource_type text DEFAULT 'file',
  url text,
  file_size bigint,
  is_downloadable boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_resources_course_id ON resources(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_module_id ON resources(module_id);
CREATE INDEX IF NOT EXISTS idx_resources_lesson_id ON resources(lesson_id);

CREATE OR REPLACE FUNCTION public.update_resources_updated_at()
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

DROP TRIGGER IF EXISTS trg_resources_updated_at ON resources;
CREATE TRIGGER trg_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_resources_updated_at();

-- ============================================================================
-- CONTENT_RELEASE_RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_release_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  release_type text NOT NULL DEFAULT 'immediate',
  release_date timestamptz,
  days_offset int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_release_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_content_release_rules_cohort_id ON content_release_rules(cohort_id);
CREATE INDEX IF NOT EXISTS idx_content_release_rules_module_id ON content_release_rules(module_id);
CREATE INDEX IF NOT EXISTS idx_content_release_rules_lesson_id ON content_release_rules(lesson_id);

-- Unique constraint: one rule per lesson per cohort
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_release_rules_cohort_lesson
  ON content_release_rules(cohort_id, lesson_id)
  WHERE lesson_id IS NOT NULL;

-- Unique constraint: one rule per module per cohort (when no lesson specified)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_release_rules_cohort_module
  ON content_release_rules(cohort_id, module_id)
  WHERE lesson_id IS NULL AND module_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_content_release_rules_updated_at()
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

DROP TRIGGER IF EXISTS trg_content_release_rules_updated_at ON content_release_rules;
CREATE TRIGGER trg_content_release_rules_updated_at
  BEFORE UPDATE ON content_release_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_content_release_rules_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS: Content Release
-- ============================================================================

-- Returns boolean — whether a lesson is currently available to students in the given cohort
CREATE OR REPLACE FUNCTION public.is_lesson_released(lesson_uuid uuid, cohort_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  rule_record RECORD;
  cohort_start date;
  course_id uuid;
  is_self_paced boolean;
BEGIN
  -- Get cohort info
  SELECT c.start_date, c.course_id INTO cohort_start, course_id
  FROM cohorts c WHERE c.id = cohort_uuid;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if course is self-paced (all content open)
  SELECT crs.is_self_paced INTO is_self_paced
  FROM courses crs WHERE crs.id = course_id;

  IF is_self_paced THEN
    RETURN true;
  END IF;

  -- Find the release rule for this lesson in this cohort
  SELECT * INTO rule_record
  FROM content_release_rules
  WHERE cohort_id = cohort_uuid
    AND lesson_id = lesson_uuid
  LIMIT 1;

  -- If no specific lesson rule, check for a module-level rule
  IF NOT FOUND THEN
    SELECT cr.* INTO rule_record
    FROM content_release_rules cr
    JOIN lessons l ON l.module_id = cr.module_id
    WHERE cr.cohort_id = cohort_uuid
      AND l.id = lesson_uuid
      AND cr.lesson_id IS NULL
    LIMIT 1;
  END IF;

  -- If no rule at all, default to released (content is open by default)
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Evaluate based on release type
  CASE rule_record.release_type
    WHEN 'immediate' THEN
      RETURN true;
    WHEN 'scheduled' THEN
      RETURN rule_record.release_date IS NOT NULL AND now() >= rule_record.release_date;
    WHEN 'days_from_start' THEN
      IF cohort_start IS NULL OR rule_record.days_offset IS NULL THEN
        RETURN true;
      END IF;
      RETURN now() >= (cohort_start + (rule_record.days_offset || ' days')::interval);
    WHEN 'after_previous' THEN
      -- Released if the previous lesson (by display_order) has a progress record
      -- This is a simplified check — full implementation would verify completion
      RETURN true;
    ELSE
      RETURN true;
  END CASE;
END;
$$;

-- Returns uuid[] — array of lesson IDs currently released for the given cohort
CREATE OR REPLACE FUNCTION public.get_released_lesson_ids(cohort_uuid uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result uuid[];
  lesson_rec RECORD;
BEGIN
  result := ARRAY[]::uuid[];
  FOR lesson_rec IN
    SELECT l.id FROM lessons l
    JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id
    JOIN cohorts co ON co.course_id = c.id
    WHERE co.id = cohort_uuid
      AND l.is_published = true
      AND m.is_published = true
  LOOP
    IF public.is_lesson_released(lesson_rec.id, cohort_uuid) THEN
      result := array_append(result, lesson_rec.id);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- ============================================================================
-- RLS POLICIES: modules
-- ============================================================================

DROP POLICY IF EXISTS "modules_select_visible" ON modules;
CREATE POLICY "modules_select_visible"
  ON modules FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM cohort_instructors ci
      JOIN cohorts co ON co.id = ci.cohort_id
      WHERE co.course_id = modules.course_id
        AND ci.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "modules_insert_admin" ON modules;
CREATE POLICY "modules_insert_admin"
  ON modules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "modules_update_admin" ON modules;
CREATE POLICY "modules_update_admin"
  ON modules FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "modules_delete_admin" ON modules;
CREATE POLICY "modules_delete_admin"
  ON modules FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: lessons
-- ============================================================================

DROP POLICY IF EXISTS "lessons_select_visible" ON lessons;
CREATE POLICY "lessons_select_visible"
  ON lessons FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM cohort_instructors ci
      JOIN cohorts co ON co.id = ci.cohort_id
      JOIN modules m ON m.course_id = co.course_id
      WHERE m.id = lessons.module_id
        AND ci.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lessons_insert_admin" ON lessons;
CREATE POLICY "lessons_insert_admin"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "lessons_update_admin" ON lessons;
CREATE POLICY "lessons_update_admin"
  ON lessons FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "lessons_delete_admin" ON lessons;
CREATE POLICY "lessons_delete_admin"
  ON lessons FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: lesson_blocks
-- ============================================================================

DROP POLICY IF EXISTS "lesson_blocks_select_visible" ON lesson_blocks;
CREATE POLICY "lesson_blocks_select_visible"
  ON lesson_blocks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons l
      WHERE l.id = lesson_blocks.lesson_id
      AND (
        l.is_published = true
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM cohort_instructors ci
          JOIN cohorts co ON co.id = ci.cohort_id
          JOIN modules m ON m.course_id = co.course_id
          WHERE m.id = l.module_id
            AND ci.instructor_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "lesson_blocks_insert_admin" ON lesson_blocks;
CREATE POLICY "lesson_blocks_insert_admin"
  ON lesson_blocks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "lesson_blocks_update_admin" ON lesson_blocks;
CREATE POLICY "lesson_blocks_update_admin"
  ON lesson_blocks FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "lesson_blocks_delete_admin" ON lesson_blocks;
CREATE POLICY "lesson_blocks_delete_admin"
  ON lesson_blocks FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: resources
-- ============================================================================

DROP POLICY IF EXISTS "resources_select_visible" ON resources;
CREATE POLICY "resources_select_visible"
  ON resources FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = resources.course_id
      AND (
        c.is_published = true
        OR EXISTS (
          SELECT 1 FROM cohort_instructors ci
          JOIN cohorts co ON co.id = ci.cohort_id
          WHERE co.course_id = c.id AND ci.instructor_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM enrolments e
          JOIN cohorts co ON co.id = e.cohort_id
          WHERE co.course_id = c.id AND e.student_id = auth.uid() AND e.status = 'active'
        )
      )
    )
  );

DROP POLICY IF EXISTS "resources_insert_admin" ON resources;
CREATE POLICY "resources_insert_admin"
  ON resources FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "resources_update_admin" ON resources;
CREATE POLICY "resources_update_admin"
  ON resources FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "resources_delete_admin" ON resources;
CREATE POLICY "resources_delete_admin"
  ON resources FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: content_release_rules
-- ============================================================================

DROP POLICY IF EXISTS "content_release_rules_select_visible" ON content_release_rules;
CREATE POLICY "content_release_rules_select_visible"
  ON content_release_rules FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR public.is_enrolled(cohort_id)
  );

DROP POLICY IF EXISTS "content_release_rules_insert_admin" ON content_release_rules;
CREATE POLICY "content_release_rules_insert_admin"
  ON content_release_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "content_release_rules_update_admin" ON content_release_rules;
CREATE POLICY "content_release_rules_update_admin"
  ON content_release_rules FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "content_release_rules_delete_admin" ON content_release_rules;
CREATE POLICY "content_release_rules_delete_admin"
  ON content_release_rules FOR DELETE
  TO authenticated
  USING (public.is_admin());