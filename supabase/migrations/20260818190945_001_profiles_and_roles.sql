/*
# Profiles, Roles, and Instructor Profiles

## Purpose
Establishes the core identity and authorization foundation for the Synergy Bahamas eLearning Platform.

## New Tables

### profiles
- `id` (uuid, primary key — references auth.users)
- `email` (text, unique, not null)
- `first_name` (text)
- `last_name` (text)
- `phone` (text)
- `bio` (text)
- `avatar_url` (text)
- `is_active` (boolean, default true — soft-deactivation)
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)

### roles
- `id` (uuid, primary key)
- `name` (text, unique, not null — 'administrator', 'instructor', 'student')
- `description` (text)

### user_roles
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles.id, on delete cascade)
- `role_id` (uuid, references roles.id, on delete cascade)
- Unique constraint on (user_id, role_id)

### instructor_profiles
- `id` (uuid, primary key)
- `profile_id` (uuid, references profiles.id, on delete cascade)
- `title` (text — e.g. "Senior Instructor")
- `specialization` (text)
- `qualifications` (text)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)

## Helper Functions

### get_user_roles()
Returns an array of role names for the current authenticated user. SECURITY DEFINER, callable by authenticated users.

### has_role(role_name text)
Returns boolean — whether the current user has the specified role. SECURITY DEFINER, callable by authenticated users.

### is_admin()
Returns boolean — whether the current user is an administrator. SECURITY DEFINER, callable by authenticated users.

### is_instructor()
Returns boolean — whether the current user is an instructor. SECURITY DEFINER, callable by authenticated users.

### is_student()
Returns boolean — whether the current user is a student. SECURITY DEFINER, callable by authenticated users.

## Triggers

### handle_new_user()
Trigger on auth.users INSERT — automatically creates a profile row when a new auth user signs up.

### update_profiles_updated_at()
Trigger on profiles UPDATE — auto-updates the updated_at timestamp.

## Security (RLS)

### profiles
- SELECT: authenticated users can read all profiles (needed for instructor lists, classmate names in discussions). Students cannot see grades/progress via this table — those are in separate tables with their own RLS.
- INSERT: a user can insert only their own profile (covered by trigger, but policy exists for safety).
- UPDATE: a user can update only their own profile. Administrators can update any profile.
- DELETE: administrators only.

### roles
- SELECT: all authenticated users can read roles.
- No INSERT/UPDATE/DELETE via anon/authenticated — managed by admins via service role.

### user_roles
- SELECT: authenticated users can read all user_roles (needed to display role-based UI). A user's own role assignments are visible.
- INSERT/UPDATE/DELETE: administrators only (enforced via is_admin() helper).

### instructor_profiles
- SELECT: all authenticated users can read instructor profiles (public-facing instructor info).
- INSERT/UPDATE/DELETE: the instructor themselves or an administrator.

## Important Notes
1. Role names are seeded as 'administrator', 'instructor', 'student'.
2. The handle_new_user trigger creates a profile automatically on signup — the frontend does NOT need to insert a profile manually.
3. Role assignment is done by an administrator after signup (no self-service role elevation).
4. All helper functions use SECURITY DEFINER with a fixed search_path to prevent search_path injection.
*/

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  phone text,
  bio text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
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

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();

-- ============================================================================
-- ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Seed roles
INSERT INTO roles (name, description) VALUES
  ('administrator', 'Full system access — manage courses, users, cohorts, and settings'),
  ('instructor', 'Manage assigned cohorts, grade assignments, take attendance, communicate with students'),
  ('student', 'Enrolled learners — access course content, submit assignments, view own grades')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- USER_ROLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ============================================================================
-- INSTRUCTOR_PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS instructor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text,
  specialization text,
  qualifications text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE instructor_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_instructor_profiles_profile_id ON instructor_profiles(profile_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_instructor_profiles_updated_at()
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

DROP TRIGGER IF EXISTS trg_instructor_profiles_updated_at ON instructor_profiles;
CREATE TRIGGER trg_instructor_profiles_updated_at
  BEFORE UPDATE ON instructor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_instructor_profiles_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- Returns array of role names for the current user
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(r.name),
    ARRAY[]::text[]
  )
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();
$$;

-- Returns boolean — whether the current user has the specified role
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = role_name
  );
$$;

-- Returns boolean — whether the current user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role('administrator');
$$;

-- Returns boolean — whether the current user is an instructor
CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role('instructor');
$$;

-- Returns boolean — whether the current user is a student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role('student');
$$;

-- ============================================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- RLS POLICIES: profiles
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: roles
-- ============================================================================

DROP POLICY IF EXISTS "roles_select_all" ON roles;
CREATE POLICY "roles_select_all"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- RLS POLICIES: user_roles
-- ============================================================================

DROP POLICY IF EXISTS "user_roles_select_all" ON user_roles;
CREATE POLICY "user_roles_select_all"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_roles_insert_admin" ON user_roles;
CREATE POLICY "user_roles_insert_admin"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_roles_update_admin" ON user_roles;
CREATE POLICY "user_roles_update_admin"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_roles_delete_admin" ON user_roles;
CREATE POLICY "user_roles_delete_admin"
  ON user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: instructor_profiles
-- ============================================================================

DROP POLICY IF EXISTS "instructor_profiles_select_all" ON instructor_profiles;
CREATE POLICY "instructor_profiles_select_all"
  ON instructor_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "instructor_profiles_insert_own_or_admin" ON instructor_profiles;
CREATE POLICY "instructor_profiles_insert_own_or_admin"
  ON instructor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id OR public.is_admin());

DROP POLICY IF EXISTS "instructor_profiles_update_own_or_admin" ON instructor_profiles;
CREATE POLICY "instructor_profiles_update_own_or_admin"
  ON instructor_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id OR public.is_admin());

DROP POLICY IF EXISTS "instructor_profiles_delete_admin" ON instructor_profiles;
CREATE POLICY "instructor_profiles_delete_admin"
  ON instructor_profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());
