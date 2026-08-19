/*
# Digital certificate studio and public verification

Adds reusable certificate templates, course-level template and skill settings,
automatic immutable certificate snapshots, public verification through a
non-enumerable code, and a public asset bucket for template artwork.
*/

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  certificate_type text NOT NULL DEFAULT 'completion'
    CHECK (certificate_type IN ('completion', 'attendance', 'achievement')),
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  background_path text,
  logo_path text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificate_templates_active
  ON public.certificate_templates(is_active, certificate_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificate_templates_default_type
  ON public.certificate_templates(certificate_type)
  WHERE is_default;

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "certificate_templates_read" ON public.certificate_templates;
CREATE POLICY "certificate_templates_read"
  ON public.certificate_templates FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "certificate_templates_admin_insert" ON public.certificate_templates;
CREATE POLICY "certificate_templates_admin_insert"
  ON public.certificate_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "certificate_templates_admin_update" ON public.certificate_templates;
CREATE POLICY "certificate_templates_admin_update"
  ON public.certificate_templates FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "certificate_templates_admin_delete" ON public.certificate_templates;
CREATE POLICY "certificate_templates_admin_delete"
  ON public.certificate_templates FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_certificate_template()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_touch_certificate_template ON public.certificate_templates;
CREATE TRIGGER trg_touch_certificate_template
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_certificate_template();

CREATE OR REPLACE FUNCTION public.keep_one_default_certificate_template()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.certificate_templates
    SET is_default = false
    WHERE certificate_type = NEW.certificate_type
      AND id <> NEW.id
      AND is_default;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_keep_one_default_certificate_template ON public.certificate_templates;
CREATE TRIGGER trg_keep_one_default_certificate_template
  BEFORE INSERT OR UPDATE OF is_default, certificate_type
  ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.keep_one_default_certificate_template();

INSERT INTO public.certificate_templates (
  name, description, certificate_type, design, is_default, is_active
)
SELECT
  'Synergy Blue Completion',
  'A polished landscape certificate inspired by the Synergy Bahamas blue certificate series.',
  'completion',
  jsonb_build_object(
    'theme', 'synergy-blue',
    'title', 'Certificate',
    'subtitle', 'of Completion',
    'presented_text', 'This certificate is proudly presented to',
    'completion_text', 'for successfully completing',
    'accent_color', '#176FC4',
    'navy_color', '#08172B',
    'show_grade', false,
    'show_skills', true,
    'show_signatures', true,
    'signer_one_name', 'Synergy Bahamas',
    'signer_one_title', 'Authorized Representative',
    'signer_two_name', '',
    'signer_two_title', '',
    'footer_text', 'Skills for What''s Next.'
  ),
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.certificate_templates WHERE certificate_type = 'completion'
);

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS certificate_template_id uuid
    REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificate_skills text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS template_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skills_snapshot text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS student_name_snapshot text,
  ADD COLUMN IF NOT EXISTS course_title_snapshot text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_template_id_fkey'
  ) THEN
    ALTER TABLE public.certificates
      ADD CONSTRAINT certificates_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.certificate_templates(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.certificates cert
SET
  student_name_snapshot = COALESCE(
    cert.student_name_snapshot,
    NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
    p.email,
    'Synergy Academy learner'
  ),
  course_title_snapshot = COALESCE(cert.course_title_snapshot, c.title),
  skills_snapshot = CASE
    WHEN cardinality(cert.skills_snapshot) > 0 THEN cert.skills_snapshot
    WHEN cardinality(c.certificate_skills) > 0 THEN c.certificate_skills
    ELSE ARRAY(
      SELECT m.title FROM public.modules m
      WHERE m.course_id = c.id
      ORDER BY m.display_order, m.created_at
      LIMIT 6
    )
  END
FROM public.profiles p, public.courses c
WHERE p.id = cert.student_id AND c.id = cert.course_id;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificate-assets',
  'certificate-assets',
  true,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "certificate_assets_admin_insert" ON storage.objects;
CREATE POLICY "certificate_assets_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificate-assets' AND public.is_admin());
DROP POLICY IF EXISTS "certificate_assets_admin_update" ON storage.objects;
CREATE POLICY "certificate_assets_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificate-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'certificate-assets' AND public.is_admin());
DROP POLICY IF EXISTS "certificate_assets_admin_delete" ON storage.objects;
CREATE POLICY "certificate_assets_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificate-assets' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.issue_certificate_for_enrolment(
  enrolment_uuid uuid,
  issuer_uuid uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrolment_record public.enrolments%ROWTYPE;
  course_record public.courses%ROWTYPE;
  profile_record public.profiles%ROWTYPE;
  template_record public.certificate_templates%ROWTYPE;
  issued_id uuid;
  issued_number text;
  issued_grade numeric;
  issued_letter text;
  issued_skills text[];
BEGIN
  SELECT * INTO enrolment_record FROM public.enrolments WHERE id = enrolment_uuid;
  IF NOT FOUND OR enrolment_record.status <> 'completed' THEN RETURN NULL; END IF;

  SELECT c.* INTO course_record
  FROM public.cohorts co JOIN public.courses c ON c.id = co.course_id
  WHERE co.id = enrolment_record.cohort_id;
  SELECT * INTO profile_record FROM public.profiles WHERE id = enrolment_record.student_id;

  IF course_record.certificate_template_id IS NOT NULL THEN
    SELECT * INTO template_record FROM public.certificate_templates
    WHERE id = course_record.certificate_template_id AND is_active;
  END IF;
  IF template_record.id IS NULL THEN
    SELECT * INTO template_record FROM public.certificate_templates
    WHERE certificate_type = 'completion' AND is_default AND is_active
    LIMIT 1;
  END IF;

  issued_grade := enrolment_record.final_grade;
  issued_letter := CASE
    WHEN issued_grade IS NULL THEN NULL
    WHEN issued_grade >= 90 THEN 'A'
    WHEN issued_grade >= 80 THEN 'B'
    WHEN issued_grade >= 70 THEN 'C'
    WHEN issued_grade >= 60 THEN 'D'
    ELSE 'F'
  END;
  issued_skills := CASE
    WHEN cardinality(course_record.certificate_skills) > 0
      THEN course_record.certificate_skills
    ELSE ARRAY(
      SELECT m.title FROM public.modules m
      WHERE m.course_id = course_record.id
      ORDER BY m.display_order, m.created_at
      LIMIT 6
    )
  END;
  issued_number := public.generate_certificate_number();

  INSERT INTO public.certificates (
    enrolment_id, student_id, cohort_id, course_id, certificate_number,
    title, issued_date, final_grade, letter_grade, issued_by, template_id,
    template_snapshot, skills_snapshot, student_name_snapshot,
    course_title_snapshot, metadata
  ) VALUES (
    enrolment_record.id,
    enrolment_record.student_id,
    enrolment_record.cohort_id,
    course_record.id,
    issued_number,
    btrim(
      COALESCE(template_record.design ->> 'title', 'Certificate') || ' ' ||
      COALESCE(template_record.design ->> 'subtitle', 'of Completion')
    ),
    COALESCE(enrolment_record.completion_date, now()),
    issued_grade,
    issued_letter,
    issuer_uuid,
    template_record.id,
    jsonb_build_object(
      'template_id', template_record.id,
      'template_name', template_record.name,
      'design', COALESCE(template_record.design, '{}'::jsonb),
      'background_path', template_record.background_path,
      'logo_path', template_record.logo_path
    ),
    COALESCE(issued_skills, ARRAY[]::text[]),
    COALESCE(
      NULLIF(btrim(concat_ws(' ', profile_record.first_name, profile_record.last_name)), ''),
      profile_record.email,
      'Synergy Academy learner'
    ),
    course_record.title,
    jsonb_build_object('verification_version', 2)
  )
  ON CONFLICT (enrolment_id) DO UPDATE SET
    final_grade = EXCLUDED.final_grade,
    letter_grade = EXCLUDED.letter_grade,
    issued_by = COALESCE(public.certificates.issued_by, EXCLUDED.issued_by)
  RETURNING id INTO issued_id;

  RETURN issued_id;
END;
$$;
REVOKE ALL ON FUNCTION public.issue_certificate_for_enrolment(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_certificate_after_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.issue_certificate_for_enrolment(NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_issue_certificate_after_completion ON public.enrolments;
CREATE TRIGGER trg_issue_certificate_after_completion
  AFTER UPDATE OF status ON public.enrolments
  FOR EACH ROW EXECUTE FUNCTION public.issue_certificate_after_completion();

CREATE OR REPLACE FUNCTION public.complete_enrolment(enrolment_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrolment_record enrolments%ROWTYPE;
  completion jsonb;
  certificate_id uuid;
  calculated_grade numeric;
BEGIN
  SELECT * INTO enrolment_record FROM enrolments WHERE id = enrolment_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrolment not found'; END IF;
  IF NOT (public.is_admin() OR public.is_cohort_instructor(enrolment_record.cohort_id)) THEN
    RAISE EXCEPTION 'Only an administrator or assigned instructor can complete an enrolment';
  END IF;
  completion := public.get_completion_status(enrolment_uuid);
  IF NOT (completion ->> 'eligible')::boolean THEN
    RAISE EXCEPTION 'Completion requirements have not been met';
  END IF;
  calculated_grade := (completion ->> 'grade')::numeric;
  UPDATE public.enrolments
  SET status = 'completed', completion_date = COALESCE(completion_date, now()),
      final_grade = calculated_grade
  WHERE id = enrolment_uuid;
  SELECT id INTO certificate_id FROM public.certificates
  WHERE enrolment_id = enrolment_uuid;
  IF certificate_id IS NULL THEN
    certificate_id := public.issue_certificate_for_enrolment(enrolment_uuid, auth.uid());
  END IF;
  RETURN completion || jsonb_build_object('certificate_id', certificate_id);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_enrolment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_enrolment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_certificate(certificate_code text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'certificate_id', cert.id,
    'certificate_number', cert.certificate_number,
    'student_name', COALESCE(cert.student_name_snapshot, 'Synergy Academy learner'),
    'course_title', COALESCE(cert.course_title_snapshot, c.title),
    'certificate_title', cert.title,
    'issued_date', cert.issued_date,
    'status', cert.status,
    'revocation_reason', CASE WHEN cert.status = 'revoked' THEN cert.revocation_reason ELSE NULL END,
    'skills', to_jsonb(COALESCE(cert.skills_snapshot, ARRAY[]::text[])),
    'final_grade', CASE
      WHEN COALESCE((cert.template_snapshot #>> '{design,show_grade}')::boolean, false)
        THEN cert.final_grade
      ELSE NULL
    END,
    'letter_grade', CASE
      WHEN COALESCE((cert.template_snapshot #>> '{design,show_grade}')::boolean, false)
        THEN cert.letter_grade
      ELSE NULL
    END,
    'template', cert.template_snapshot
  )
  FROM public.certificates cert
  JOIN public.courses c ON c.id = cert.course_id
  WHERE upper(cert.certificate_number) = upper(btrim(certificate_code))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
