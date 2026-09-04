/*
  Resource drip release

  Resources may be released immediately, at a scheduled time, or after a
  learner completes a lesson, passes/completes an assessment, or completes an
  activity. A resource can be course-wide or limited to one cohort.
*/

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS release_mode text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS release_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_checkpoint_type text,
  ADD COLUMN IF NOT EXISTS release_checkpoint_id uuid,
  ADD COLUMN IF NOT EXISTS checkpoint_requires_pass boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_before_release boolean NOT NULL DEFAULT false;

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_release_mode_check,
  ADD CONSTRAINT resources_release_mode_check
    CHECK (release_mode IN ('immediate', 'scheduled', 'checkpoint')),
  DROP CONSTRAINT IF EXISTS resources_checkpoint_type_check,
  ADD CONSTRAINT resources_checkpoint_type_check
    CHECK (
      release_checkpoint_type IS NULL
      OR release_checkpoint_type IN ('lesson', 'assessment', 'activity')
    ),
  DROP CONSTRAINT IF EXISTS resources_release_configuration_check,
  ADD CONSTRAINT resources_release_configuration_check
    CHECK (
      (release_mode = 'immediate' AND release_at IS NULL AND release_checkpoint_type IS NULL AND release_checkpoint_id IS NULL)
      OR (release_mode = 'scheduled' AND release_at IS NOT NULL AND release_checkpoint_type IS NULL AND release_checkpoint_id IS NULL)
      OR (release_mode = 'checkpoint' AND release_at IS NULL AND release_checkpoint_type IS NOT NULL AND release_checkpoint_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_resources_cohort_id ON public.resources(cohort_id);
CREATE INDEX IF NOT EXISTS idx_resources_release_at ON public.resources(release_at)
  WHERE release_mode = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_resources_release_checkpoint ON public.resources(release_checkpoint_type, release_checkpoint_id)
  WHERE release_mode = 'checkpoint';

CREATE OR REPLACE FUNCTION public.validate_resource_release_configuration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  checkpoint_course_id uuid;
  checkpoint_cohort_id uuid;
BEGIN
  IF NEW.cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cohorts c
    WHERE c.id = NEW.cohort_id AND c.course_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'The selected cohort does not belong to this resource course.';
  END IF;

  IF NEW.release_mode <> 'checkpoint' THEN
    RETURN NEW;
  END IF;

  CASE NEW.release_checkpoint_type
    WHEN 'lesson' THEN
      SELECT m.course_id INTO checkpoint_course_id
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.id = NEW.release_checkpoint_id;
    WHEN 'assessment' THEN
      SELECT c.course_id, a.cohort_id INTO checkpoint_course_id, checkpoint_cohort_id
      FROM public.assessments a
      JOIN public.cohorts c ON c.id = a.cohort_id
      WHERE a.id = NEW.release_checkpoint_id;
    WHEN 'activity' THEN
      SELECT c.course_id, a.cohort_id INTO checkpoint_course_id, checkpoint_cohort_id
      FROM public.assignments a
      JOIN public.cohorts c ON c.id = a.cohort_id
      WHERE a.id = NEW.release_checkpoint_id AND a.assignment_type = 'activity';
  END CASE;

  IF checkpoint_course_id IS NULL OR checkpoint_course_id <> NEW.course_id THEN
    RAISE EXCEPTION 'The selected release checkpoint does not belong to this course.';
  END IF;

  IF NEW.release_checkpoint_type IN ('assessment', 'activity')
     AND (NEW.cohort_id IS NULL OR NEW.cohort_id <> checkpoint_cohort_id) THEN
    RAISE EXCEPTION 'Assessment and activity checkpoints require their matching cohort.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_resource_release_configuration ON public.resources;
CREATE TRIGGER trg_validate_resource_release_configuration
  BEFORE INSERT OR UPDATE OF course_id, cohort_id, release_mode, release_checkpoint_type, release_checkpoint_id
  ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.validate_resource_release_configuration();

CREATE OR REPLACE FUNCTION public.is_resource_released(
  resource_uuid uuid,
  cohort_uuid uuid,
  student_uuid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  resource_record public.resources%ROWTYPE;
BEGIN
  SELECT * INTO resource_record
  FROM public.resources
  WHERE id = resource_uuid;

  IF NOT FOUND OR student_uuid IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cohorts c
    WHERE c.id = cohort_uuid AND c.course_id = resource_record.course_id
  ) THEN RETURN false; END IF;
  IF resource_record.cohort_id IS NOT NULL AND resource_record.cohort_id <> cohort_uuid THEN
    RETURN false;
  END IF;

  IF public.is_admin() OR public.is_cohort_instructor(cohort_uuid) THEN RETURN true; END IF;
  IF student_uuid <> auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.enrolments e
    WHERE e.cohort_id = cohort_uuid
      AND e.student_id = student_uuid
      AND e.status = 'active'
  ) THEN RETURN false; END IF;

  CASE resource_record.release_mode
    WHEN 'immediate' THEN RETURN true;
    WHEN 'scheduled' THEN RETURN resource_record.release_at IS NOT NULL AND now() >= resource_record.release_at;
    WHEN 'checkpoint' THEN
      CASE resource_record.release_checkpoint_type
        WHEN 'lesson' THEN
          RETURN EXISTS (
            SELECT 1 FROM public.progress_records p
            WHERE p.cohort_id = cohort_uuid
              AND p.student_id = student_uuid
              AND p.lesson_id = resource_record.release_checkpoint_id
              AND p.status = 'completed'
          );
        WHEN 'assessment' THEN
          RETURN EXISTS (
            SELECT 1
            FROM public.assessment_attempts aa
            JOIN public.assessments a ON a.id = aa.assessment_id
            JOIN public.enrolments e ON e.id = aa.enrolment_id
            WHERE aa.assessment_id = resource_record.release_checkpoint_id
              AND aa.student_id = student_uuid
              AND e.cohort_id = cohort_uuid
              AND aa.status = 'completed'
              AND (
                NOT resource_record.checkpoint_requires_pass
                OR aa.percentage >= COALESCE(a.passing_score, 0)
              )
          );
        WHEN 'activity' THEN
          RETURN EXISTS (
            SELECT 1
            FROM public.submissions s
            JOIN public.assignments a ON a.id = s.assignment_id
            JOIN public.enrolments e ON e.id = s.enrolment_id
            WHERE s.assignment_id = resource_record.release_checkpoint_id
              AND s.student_id = student_uuid
              AND e.cohort_id = cohort_uuid
              AND a.assignment_type = 'activity'
              AND s.status IN ('submitted', 'graded', 'returned')
          );
        ELSE RETURN false;
      END CASE;
    ELSE RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_resource_released(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_resource_released(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "resources_select_visible" ON public.resources;
CREATE POLICY "resources_select_visible"
  ON public.resources FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id = resources.course_id
        AND public.is_cohort_instructor(c.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id = resources.course_id
        AND (resources.cohort_id IS NULL OR resources.cohort_id = c.id)
        AND public.is_enrolled(c.id)
        AND public.is_resource_released(resources.id, c.id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.get_upcoming_course_resources(cohort_uuid uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  resource_type text,
  release_mode text,
  release_at timestamptz,
  release_checkpoint_type text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    r.id,
    r.title,
    r.description,
    r.resource_type,
    r.release_mode,
    r.release_at,
    r.release_checkpoint_type
  FROM public.resources r
  JOIN public.cohorts c ON c.course_id = r.course_id
  WHERE c.id = cohort_uuid
    AND (r.cohort_id IS NULL OR r.cohort_id = c.id)
    AND r.show_before_release = true
    AND public.is_enrolled(c.id)
    AND NOT public.is_resource_released(r.id, c.id, auth.uid())
  ORDER BY r.display_order, r.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_course_resources(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_course_resources(uuid) TO authenticated;

DROP POLICY IF EXISTS "resources_insert_admin" ON public.resources;
DROP POLICY IF EXISTS "resources_insert_admin_or_instructor" ON public.resources;
CREATE POLICY "resources_insert_admin_or_instructor"
  ON public.resources FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id = resources.course_id
        AND (resources.cohort_id IS NULL OR resources.cohort_id = c.id)
        AND public.is_cohort_instructor(c.id)
    )
  );

DROP POLICY IF EXISTS "resources_update_admin" ON public.resources;
DROP POLICY IF EXISTS "resources_update_admin_or_instructor" ON public.resources;
CREATE POLICY "resources_update_admin_or_instructor"
  ON public.resources FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id = resources.course_id
        AND (resources.cohort_id IS NULL OR resources.cohort_id = c.id)
        AND public.is_cohort_instructor(c.id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id = resources.course_id
        AND (resources.cohort_id IS NULL OR resources.cohort_id = c.id)
        AND public.is_cohort_instructor(c.id)
    )
  );

DROP POLICY IF EXISTS "resources_delete_admin" ON public.resources;
DROP POLICY IF EXISTS "resources_delete_admin_or_instructor" ON public.resources;
CREATE POLICY "resources_delete_admin_or_instructor"
  ON public.resources FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id = resources.course_id
        AND (resources.cohort_id IS NULL OR resources.cohort_id = c.id)
        AND public.is_cohort_instructor(c.id)
    )
  );

DROP POLICY IF EXISTS "course_assets_enrolled_resource_read" ON storage.objects;
CREATE POLICY "course_assets_enrolled_resource_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1
      FROM public.resources r
      JOIN public.cohorts c ON c.course_id = r.course_id
      WHERE r.course_id::text = (storage.foldername(name))[1]
        AND r.id::text = (storage.foldername(name))[2]
        AND public.is_resource_released(r.id, c.id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "course_assets_instructor_insert" ON storage.objects;
CREATE POLICY "course_assets_instructor_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id::text = (storage.foldername(name))[1]
        AND public.is_cohort_instructor(c.id)
    )
  );

DROP POLICY IF EXISTS "course_assets_instructor_delete" ON storage.objects;
CREATE POLICY "course_assets_instructor_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.course_id::text = (storage.foldername(name))[1]
        AND public.is_cohort_instructor(c.id)
    )
  );
