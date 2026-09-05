/*
# Cohort-independent access entitlements and organization seats

Keeps live cohorts as a teaching context while allowing course or platform
access to come from an individual purchase, membership, or organization seat.
Payment providers may activate contracts later; this migration owns access,
seat caps, and organization-manager permissions only.
*/

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  primary_contact_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'learner'
    CHECK (member_role IN ('owner', 'seat_manager', 'learner')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.access_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  access_scope text NOT NULL CHECK (access_scope IN ('course', 'platform')),
  course_id uuid REFERENCES public.courses(id) ON DELETE RESTRICT,
  commerce_model text NOT NULL CHECK (commerce_model IN ('one_time', 'subscription')),
  term_months int CHECK (term_months IN (3, 6, 12)),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (access_scope = 'course' AND course_id IS NOT NULL)
    OR (access_scope = 'platform' AND course_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.access_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.access_offerings(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  purchaser_user_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  seat_limit int NOT NULL DEFAULT 1 CHECK (seat_limit BETWEEN 1 AND 100000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'suspended', 'expired', 'cancelled')),
  external_provider text,
  external_customer_id text,
  external_subscription_id text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR purchaser_user_id IS NOT NULL),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.seat_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.access_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  UNIQUE (contract_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  last_name text,
  role_names text[] NOT NULL DEFAULT ARRAY['student']::text[],
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(role_names) BETWEEN 1 AND 3)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invitations_pending_email
  ON public.user_invitations(lower(email))
  WHERE status = 'pending';

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS recording_storage_path text;
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cover_image_storage_path text,
  ADD COLUMN IF NOT EXISTS introduction_video_storage_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-assets',
  'catalog-assets',
  true,
  262144000,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE POLICY "catalog_assets_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-assets' AND public.is_admin());
CREATE POLICY "catalog_assets_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'catalog-assets' AND public.is_admin());
CREATE POLICY "catalog_assets_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-assets' AND public.is_admin());

-- Instructors upload session recordings directly to the private course-assets
-- bucket using: <course-id>/live-sessions/<session-id>/<filename>.
CREATE POLICY "course_assets_live_session_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[2] = 'live-sessions'
    AND EXISTS (
      SELECT 1
      FROM public.live_sessions session
      JOIN public.cohorts cohort ON cohort.id = session.cohort_id
      WHERE cohort.course_id::text = (storage.foldername(name))[1]
        AND session.id::text = (storage.foldername(name))[3]
        AND (
          public.is_admin()
          OR public.is_cohort_instructor(session.cohort_id)
          OR public.is_enrolled(session.cohort_id)
        )
    )
  );
CREATE POLICY "course_assets_live_session_instructor_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[2] = 'live-sessions'
    AND EXISTS (
      SELECT 1
      FROM public.live_sessions session
      JOIN public.cohorts cohort ON cohort.id = session.cohort_id
      WHERE cohort.course_id::text = (storage.foldername(name))[1]
        AND session.id::text = (storage.foldername(name))[3]
        AND public.is_cohort_instructor(session.cohort_id)
    )
  );
CREATE POLICY "course_assets_live_session_instructor_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND (storage.foldername(name))[2] = 'live-sessions'
    AND EXISTS (
      SELECT 1
      FROM public.live_sessions session
      JOIN public.cohorts cohort ON cohort.id = session.cohort_id
      WHERE cohort.course_id::text = (storage.foldername(name))[1]
        AND session.id::text = (storage.foldername(name))[3]
        AND public.is_cohort_instructor(session.cohort_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_organization_members_user
  ON public.organization_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_access_contracts_organization
  ON public.access_contracts(organization_id, status, ends_at);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_user
  ON public.seat_assignments(user_id, status);

CREATE OR REPLACE FUNCTION public.is_organization_manager(
  organization_uuid uuid,
  account_uuid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM organization_members membership
    JOIN profiles account ON account.id = membership.user_id
    JOIN organizations organization ON organization.id = membership.organization_id
    WHERE membership.organization_id = organization_uuid
      AND membership.user_id = account_uuid
      AND membership.member_role IN ('owner', 'seat_manager')
      AND membership.status = 'active'
      AND account.is_active
      AND organization.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_course(
  course_uuid uuid,
  account_uuid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enrolments enrolment
    JOIN cohorts cohort ON cohort.id = enrolment.cohort_id
    JOIN profiles account ON account.id = enrolment.student_id
    WHERE enrolment.student_id = account_uuid
      AND cohort.course_id = course_uuid
      AND enrolment.status IN ('active', 'completed')
      AND account.is_active
  ) OR EXISTS (
    SELECT 1
    FROM seat_assignments seat
    JOIN access_contracts contract ON contract.id = seat.contract_id
    JOIN access_offerings offering ON offering.id = contract.offering_id
    JOIN profiles account ON account.id = seat.user_id
    LEFT JOIN organizations organization ON organization.id = contract.organization_id
    WHERE seat.user_id = account_uuid
      AND seat.status = 'active'
      AND contract.status = 'active'
      AND now() >= contract.starts_at
      AND now() < contract.ends_at
      AND offering.is_active
      AND (offering.access_scope = 'platform' OR offering.course_id = course_uuid)
      AND account.is_active
      AND (organization.id IS NULL OR organization.status = 'active')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_public_courses(requested_slug text DEFAULT NULL)
RETURNS TABLE (
  course_id uuid,
  title text,
  slug text,
  short_description text,
  description text,
  cover_image_url text,
  duration_weeks int,
  difficulty_level text,
  is_self_paced boolean,
  metadata jsonb,
  categories jsonb,
  curriculum jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    course.id,
    course.title,
    course.slug,
    course.short_description,
    course.description,
    course.cover_image_url,
    course.duration_weeks,
    course.difficulty_level,
    course.is_self_paced,
    course.metadata,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('name', category.name, 'slug', category.slug)
        ORDER BY category.display_order
      )
      FROM course_categories_join link
      JOIN course_categories category ON category.id = link.category_id
      WHERE link.course_id = course.id AND category.is_active
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', module.title,
          'description', module.description,
          'lessons', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'title', lesson.title,
                'estimated_minutes', lesson.estimated_minutes
              ) ORDER BY lesson.display_order
            )
            FROM lessons lesson
            WHERE lesson.module_id = module.id AND lesson.is_published
          ), '[]'::jsonb)
        ) ORDER BY module.display_order
      )
      FROM modules module
      WHERE module.course_id = course.id AND module.is_published
    ), '[]'::jsonb)
  FROM courses course
  WHERE course.is_published
    AND (requested_slug IS NULL OR course.slug = requested_slug)
  ORDER BY course.title;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_contract(
  organization_name text,
  organization_slug text,
  contact_user_uuid uuid,
  offering_name text,
  offering_scope text,
  offering_course_uuid uuid,
  offering_commerce_model text,
  offering_term_months int,
  contract_seat_limit int,
  contract_starts_at timestamptz,
  contract_ends_at timestamptz,
  activate_contract boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  organization_uuid uuid;
  offering_uuid uuid;
  contract_uuid uuid;
  student_role_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only a platform administrator may create organization contracts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = contact_user_uuid AND is_active) THEN
    RAISE EXCEPTION 'Choose an active contact account';
  END IF;
  INSERT INTO organizations (name, slug, primary_contact_id, created_by)
  VALUES (btrim(organization_name), lower(btrim(organization_slug)), contact_user_uuid, auth.uid())
  RETURNING id INTO organization_uuid;
  INSERT INTO organization_members (organization_id, user_id, member_role)
  VALUES (organization_uuid, contact_user_uuid, 'owner');

  SELECT id INTO student_role_id FROM roles WHERE name = 'student';
  IF student_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (contact_user_uuid, student_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO access_offerings (
    name, access_scope, course_id, commerce_model, term_months
  ) VALUES (
    btrim(offering_name), offering_scope, offering_course_uuid,
    offering_commerce_model, offering_term_months
  ) RETURNING id INTO offering_uuid;
  INSERT INTO access_contracts (
    offering_id, organization_id, purchaser_user_id, seat_limit,
    starts_at, ends_at, status, created_by
  ) VALUES (
    offering_uuid, organization_uuid, contact_user_uuid, contract_seat_limit,
    contract_starts_at, contract_ends_at,
    CASE WHEN activate_contract THEN 'active' ELSE 'draft' END,
    auth.uid()
  ) RETURNING id INTO contract_uuid;
  RETURN jsonb_build_object(
    'organization_id', organization_uuid,
    'offering_id', offering_uuid,
    'contract_id', contract_uuid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_invitation(
  invite_email text,
  invite_first_name text,
  invite_last_name text,
  invited_roles text[],
  expires_in_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE invitation user_invitations%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only a platform administrator may invite users';
  END IF;
  IF invite_email IS NULL OR position('@' IN invite_email) < 2 THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;
  IF invited_roles IS NULL OR cardinality(invited_roles) = 0
    OR EXISTS (
      SELECT 1 FROM unnest(invited_roles) role_name
      WHERE role_name NOT IN ('student', 'instructor', 'administrator')
    ) THEN
    RAISE EXCEPTION 'Choose one or more valid roles';
  END IF;
  UPDATE user_invitations
  SET status = 'revoked'
  WHERE lower(email) = lower(btrim(invite_email)) AND status = 'pending';
  INSERT INTO user_invitations (
    email, first_name, last_name, role_names, expires_at, created_by
  ) VALUES (
    lower(btrim(invite_email)), NULLIF(btrim(invite_first_name), ''),
    NULLIF(btrim(invite_last_name), ''), invited_roles,
    now() + make_interval(days => LEAST(GREATEST(expires_in_days, 1), 30)),
    auth.uid()
  ) RETURNING * INTO invitation;
  RETURN jsonb_build_object(
    'id', invitation.id,
    'email', invitation.email,
    'token', invitation.token,
    'expires_at', invitation.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_invitation(invitation_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'email', invitation.email,
    'first_name', invitation.first_name,
    'last_name', invitation.last_name,
    'role_names', invitation.role_names,
    'expires_at', invitation.expires_at
  )
  FROM user_invitations invitation
  WHERE invitation.token = invitation_token
    AND invitation.status = 'pending'
    AND invitation.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.apply_matching_user_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE invitation user_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation
  FROM user_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  UPDATE profiles
  SET first_name = COALESCE(invitation.first_name, first_name),
      last_name = COALESCE(invitation.last_name, last_name),
      is_active = true
  WHERE id = NEW.id;
  INSERT INTO user_roles (user_id, role_id)
  SELECT NEW.id, role.id
  FROM roles role
  WHERE role.name = ANY(invitation.role_names)
  ON CONFLICT DO NOTHING;
  UPDATE user_invitations
  SET status = 'accepted', accepted_by = NEW.id, accepted_at = now()
  WHERE id = invitation.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_matching_user_invitation ON public.profiles;
CREATE TRIGGER trg_apply_matching_user_invitation
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.apply_matching_user_invitation();

CREATE OR REPLACE FUNCTION public.assign_organization_seat_by_email(
  contract_uuid uuid,
  learner_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contract_record access_contracts%ROWTYPE;
  learner_record profiles%ROWTYPE;
  active_seats int;
  seat_record seat_assignments%ROWTYPE;
  student_role_id uuid;
BEGIN
  SELECT * INTO contract_record
  FROM access_contracts
  WHERE id = contract_uuid
  FOR UPDATE;
  IF NOT FOUND OR contract_record.organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization contract not found';
  END IF;
  IF NOT public.is_organization_manager(contract_record.organization_id) THEN
    RAISE EXCEPTION 'Only the organization contact or a platform administrator may assign seats';
  END IF;
  IF contract_record.status <> 'active'
    OR now() < contract_record.starts_at
    OR now() >= contract_record.ends_at THEN
    RAISE EXCEPTION 'This contract is not currently active';
  END IF;

  SELECT * INTO learner_record
  FROM profiles
  WHERE lower(email) = lower(btrim(learner_email));
  IF NOT FOUND OR NOT learner_record.is_active THEN
    RAISE EXCEPTION 'The learner must create and activate an academy account first';
  END IF;

  SELECT * INTO seat_record
  FROM seat_assignments
  WHERE contract_id = contract_uuid AND user_id = learner_record.id;
  IF FOUND AND seat_record.status = 'active' THEN
    RETURN jsonb_build_object('seat_id', seat_record.id, 'status', 'already_active');
  END IF;

  SELECT count(*) INTO active_seats
  FROM seat_assignments
  WHERE contract_id = contract_uuid AND status = 'active';
  IF active_seats >= contract_record.seat_limit THEN
    RAISE EXCEPTION 'This contract has reached its seat limit';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, member_role, status)
  VALUES (contract_record.organization_id, learner_record.id, 'learner', 'active')
  ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';

  SELECT id INTO student_role_id FROM roles WHERE name = 'student';
  IF student_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (learner_record.id, student_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO seat_assignments (contract_id, user_id, status, assigned_by, assigned_at, revoked_by, revoked_at)
  VALUES (contract_uuid, learner_record.id, 'active', auth.uid(), now(), NULL, NULL)
  ON CONFLICT (contract_id, user_id) DO UPDATE SET
    status = 'active',
    assigned_by = auth.uid(),
    assigned_at = now(),
    revoked_by = NULL,
    revoked_at = NULL
  RETURNING * INTO seat_record;

  RETURN jsonb_build_object(
    'seat_id', seat_record.id,
    'user_id', learner_record.id,
    'email', learner_record.email,
    'status', seat_record.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_organization_seat(seat_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  organization_uuid uuid;
BEGIN
  SELECT contract.organization_id
  INTO organization_uuid
  FROM seat_assignments seat
  JOIN access_contracts contract ON contract.id = seat.contract_id
  WHERE seat.id = seat_uuid;
  IF NOT FOUND OR organization_uuid IS NULL THEN
    RAISE EXCEPTION 'Organization seat not found';
  END IF;
  IF NOT public.is_organization_manager(organization_uuid) THEN
    RAISE EXCEPTION 'Only the organization contact or a platform administrator may revoke seats';
  END IF;
  UPDATE seat_assignments
  SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now()
  WHERE id = seat_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_organization_seat_by_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_organization_seat_by_email(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_organization_contract(text, text, uuid, text, text, uuid, text, int, int, timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_contract(text, text, uuid, text, text, uuid, text, int, int, timestamptz, timestamptz, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.revoke_organization_seat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_organization_seat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_courses(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_courses(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_user_invitation(text, text, text, text[], int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_invitation(text, text, text, text[], int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_user_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_invitation(uuid) TO anon, authenticated;

CREATE POLICY "organizations_select_members"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members membership
      WHERE membership.organization_id = organizations.id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
    )
  );
CREATE POLICY "organizations_admin_manage"
  ON public.organizations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_select_cohort_visible" ON public.profiles;
CREATE POLICY "profiles_select_learning_visible"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohort_instructors instructor
      WHERE instructor.instructor_id = profiles.id
        AND (public.is_enrolled(instructor.cohort_id) OR public.is_cohort_instructor(instructor.cohort_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.enrolments visible_student
      WHERE visible_student.student_id = profiles.id
        AND visible_student.status = 'active'
        AND (
          public.is_cohort_instructor(visible_student.cohort_id)
          OR EXISTS (
            SELECT 1 FROM public.enrolments current_student
            WHERE current_student.cohort_id = visible_student.cohort_id
              AND current_student.student_id = auth.uid()
              AND current_student.status = 'active'
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members visible_member
      WHERE visible_member.user_id = profiles.id
        AND visible_member.status = 'active'
        AND public.is_organization_manager(visible_member.organization_id)
    )
  );

CREATE POLICY "organization_members_select_visible"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_organization_manager(organization_id)
  );
CREATE POLICY "organization_members_admin_manage"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "access_offerings_select_active"
  ON public.access_offerings FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());
CREATE POLICY "access_offerings_admin_manage"
  ON public.access_offerings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "access_contracts_select_visible"
  ON public.access_contracts FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR purchaser_user_id = auth.uid()
    OR public.is_organization_manager(organization_id)
  );
CREATE POLICY "access_contracts_admin_manage"
  ON public.access_contracts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "seat_assignments_select_visible"
  ON public.seat_assignments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.access_contracts contract
      WHERE contract.id = seat_assignments.contract_id
        AND public.is_organization_manager(contract.organization_id)
    )
  );
CREATE POLICY "seat_assignments_admin_manage"
  ON public.seat_assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "user_invitations_admin_manage"
  ON public.user_invitations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_audit_access_contracts ON public.access_contracts;
CREATE TRIGGER trg_audit_access_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.access_contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_seat_assignments ON public.seat_assignments;
CREATE TRIGGER trg_audit_seat_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.seat_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_user_invitations ON public.user_invitations;
CREATE TRIGGER trg_audit_user_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
