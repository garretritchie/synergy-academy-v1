/*
# Course Categories, Courses, and Course-Category Relationships

## Purpose
Establishes the curriculum catalog structure: categories that group courses, courses that hold reusable curriculum, and the many-to-many relationship between them.

## New Tables

### course_categories
- `id` (uuid, primary key)
- `name` (text, unique, not null)
- `slug` (text, unique, not null — URL-safe identifier)
- `description` (text)
- `icon` (text — stores a lucide-react icon name for UI rendering)
- `display_order` (int, default 0 — controls sort order in catalog)
- `is_active` (boolean, default true)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### courses
- `id` (uuid, primary key)
- `title` (text, not null)
- `slug` (text, unique, not null — URL-safe identifier)
- `description` (text)
- `short_description` (text — used in cards/previews)
- `cover_image_url` (text)
- `introduction_video_url` (text)
- `duration_weeks` (int — estimated duration, not hard-coded)
- `difficulty_level` (text — 'beginner', 'intermediate', 'advanced')
- `language` (text, default 'en')
- `is_published` (boolean, default false — draft vs published)
- `is_self_paced` (boolean, default false — reserved for future self-paced mode)
- `metadata` (jsonb — extensible key-value storage for future attributes)
- `created_by` (uuid, references profiles.id)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### course_categories_join
- `id` (uuid, primary key)
- `course_id` (uuid, references courses.id, on delete cascade)
- `category_id` (uuid, references course_categories.id, on delete cascade)
- Unique constraint on (course_id, category_id)

## Seeded Data

### course_categories
The five initial Synergy categories:
1. Business Applications
2. Business Studies
3. Culinary Arts
4. Design & Media
5. Technology

## Security (RLS)

### course_categories
- SELECT: all authenticated users can read (needed for catalog browsing, navigation).
- INSERT/UPDATE/DELETE: administrators only.

### courses
- SELECT: all authenticated users can read published courses. Administrators can read all (including drafts).
- INSERT/UPDATE/DELETE: administrators only.

### course_categories_join
- SELECT: all authenticated users can read.
- INSERT/UPDATE/DELETE: administrators only.

## Important Notes
1. Courses are generic — no hard-coding to any specific course title.
2. The `metadata` jsonb column allows future extensibility without schema changes.
3. `is_self_paced` is reserved for future self-paced course mode where all content is open.
4. `is_published` controls whether a course appears in the catalog — drafts are admin-only.
5. Slugs are unique and used for URL construction in the future public catalog.
*/

-- ============================================================================
-- COURSE_CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE course_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_course_categories_slug ON course_categories(slug);
CREATE INDEX IF NOT EXISTS idx_course_categories_display_order ON course_categories(display_order);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_course_categories_updated_at()
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

DROP TRIGGER IF EXISTS trg_course_categories_updated_at ON course_categories;
CREATE TRIGGER trg_course_categories_updated_at
  BEFORE UPDATE ON course_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_categories_updated_at();

-- Seed initial categories
INSERT INTO course_categories (name, slug, description, icon, display_order) VALUES
  ('Business Applications', 'business-applications', 'Software and tools for modern business operations', 'Monitor', 1),
  ('Business Studies', 'business-studies', 'Management, entrepreneurship, and business fundamentals', 'Briefcase', 2),
  ('Culinary Arts', 'culinary-arts', 'Cooking, food preparation, and culinary management', 'ChefHat', 3),
  ('Design & Media', 'design-media', 'Graphic design, video, and digital media production', 'Palette', 4),
  ('Technology', 'technology', 'Software development, IT, and emerging technologies', 'Code', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- COURSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  short_description text,
  cover_image_url text,
  introduction_video_url text,
  duration_weeks int,
  difficulty_level text DEFAULT 'beginner',
  language text DEFAULT 'en',
  is_published boolean NOT NULL DEFAULT false,
  is_self_paced boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_courses_updated_at()
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

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_courses_updated_at();

-- ============================================================================
-- COURSE_CATEGORIES_JOIN TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_categories_join (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES course_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, category_id)
);

ALTER TABLE course_categories_join ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_course_categories_join_course_id ON course_categories_join(course_id);
CREATE INDEX IF NOT EXISTS idx_course_categories_join_category_id ON course_categories_join(category_id);

-- ============================================================================
-- RLS POLICIES: course_categories
-- ============================================================================

DROP POLICY IF EXISTS "course_categories_select_all" ON course_categories;
CREATE POLICY "course_categories_select_all"
  ON course_categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "course_categories_insert_admin" ON course_categories;
CREATE POLICY "course_categories_insert_admin"
  ON course_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_categories_update_admin" ON course_categories;
CREATE POLICY "course_categories_update_admin"
  ON course_categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_categories_delete_admin" ON course_categories;
CREATE POLICY "course_categories_delete_admin"
  ON course_categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: courses
-- ============================================================================

DROP POLICY IF EXISTS "courses_select_published_or_admin" ON courses;
CREATE POLICY "courses_select_published_or_admin"
  ON courses FOR SELECT
  TO authenticated
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "courses_insert_admin" ON courses;
CREATE POLICY "courses_insert_admin"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "courses_update_admin" ON courses;
CREATE POLICY "courses_update_admin"
  ON courses FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "courses_delete_admin" ON courses;
CREATE POLICY "courses_delete_admin"
  ON courses FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: course_categories_join
-- ============================================================================

DROP POLICY IF EXISTS "course_categories_join_select_all" ON course_categories_join;
CREATE POLICY "course_categories_join_select_all"
  ON course_categories_join FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "course_categories_join_insert_admin" ON course_categories_join;
CREATE POLICY "course_categories_join_insert_admin"
  ON course_categories_join FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_categories_join_update_admin" ON course_categories_join;
CREATE POLICY "course_categories_join_update_admin"
  ON course_categories_join FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "course_categories_join_delete_admin" ON course_categories_join;
CREATE POLICY "course_categories_join_delete_admin"
  ON course_categories_join FOR DELETE
  TO authenticated
  USING (public.is_admin());