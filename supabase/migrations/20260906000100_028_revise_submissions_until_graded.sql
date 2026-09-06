-- Activities/homework/projects may be revised until graded. Assessment sessions
-- and instructor-authorized exam attempt grants are deliberately unchanged.
BEGIN;
DO $$
DECLARE definition text; old_lock text; old_cap text;
BEGIN
  definition := pg_get_functiondef('public.protect_submission_academic_fields()'::regprocedure);
  old_lock := 'IF TG_OP = ''UPDATE'' AND OLD.status IN (''submitted'', ''graded'') THEN RAISE EXCEPTION ''Your submitted work is preserved. Ask your instructor to return it for changes.''; END IF;';
  old_cap := 'IF COALESCE(CASE WHEN TG_OP = ''UPDATE'' THEN OLD.attempt_count ELSE 0 END, 0)
      >= assignment_record.max_attempts THEN
      RAISE EXCEPTION ''Maximum submission attempts reached'';
    END IF;';
  IF position(old_lock IN definition)=0 OR position(old_cap IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected submission guard: apply migrations through 027 before 028.';
  END IF;
  definition := replace(definition, old_lock,
    'IF TG_OP = ''UPDATE'' THEN
       IF OLD.status = ''graded'' OR OLD.grade IS NOT NULL OR OLD.graded_at IS NOT NULL THEN
         RAISE EXCEPTION ''This work has been graded and is locked. Ask your instructor to reopen it for changes.'';
       END IF;
       IF OLD.status = ''submitted'' AND NEW.status <> ''submitted'' THEN
         RAISE EXCEPTION ''Your submitted work is preserved. Update the submission instead of withdrawing it to a draft.'';
       END IF;
     END IF;');
  definition := replace(definition, old_cap, '-- Submission revisions have no attempt cap before grading.');
  definition := replace(definition,
    'OLD.status <> ''submitted'' OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at',
    'OLD.status <> ''submitted'' OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.content IS DISTINCT FROM OLD.content');
  -- A submission cannot be moved to another assignment/enrolment to evade its lock.
  definition := replace(definition, 'SELECT * INTO assignment_record FROM assignments WHERE id = NEW.assignment_id;',
    'IF TG_OP = ''UPDATE'' AND (NEW.assignment_id IS DISTINCT FROM OLD.assignment_id OR NEW.enrolment_id IS DISTINCT FROM OLD.enrolment_id OR NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
       RAISE EXCEPTION ''Submission ownership and assignment cannot be changed.'';
     END IF;
     SELECT * INTO assignment_record FROM assignments WHERE id = NEW.assignment_id;');
  EXECUTE definition;
END $$;

-- Serialize evidence changes with grading, including requests from stale pages.
CREATE FUNCTION public.protect_graded_submission_files() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE submission_record submissions%ROWTYPE; cohort_uuid uuid;
BEGIN
  IF TG_OP='UPDATE' AND NEW.submission_id IS DISTINCT FROM OLD.submission_id THEN
    RAISE EXCEPTION 'Evidence cannot be moved to another submission.';
  END IF;
  SELECT * INTO submission_record FROM submissions
    WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.submission_id ELSE NEW.submission_id END FOR UPDATE;
  SELECT cohort_id INTO cohort_uuid FROM assignments WHERE id=submission_record.assignment_id;
  IF NOT (public.is_admin() OR public.is_cohort_instructor(cohort_uuid))
    AND (submission_record.status='graded' OR submission_record.grade IS NOT NULL OR submission_record.graded_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This work has been graded and its evidence is locked.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_graded_submission_files() FROM PUBLIC;
CREATE TRIGGER trg_protect_graded_submission_files BEFORE INSERT OR UPDATE OR DELETE
  ON public.submission_files FOR EACH ROW EXECUTE FUNCTION public.protect_graded_submission_files();

DROP POLICY IF EXISTS submission_files_student_insert ON storage.objects;
CREATE POLICY submission_files_student_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='assignment-submissions' AND (storage.foldername(name))[1]=auth.uid()::text
  AND public.has_role('student') AND EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id::text=(storage.foldername(name))[2]
    AND s.student_id=auth.uid() AND s.status<>'graded' AND s.grade IS NULL AND s.graded_at IS NULL));

-- Submitted evidence remains readable and cannot be erased from prior versions.
DROP POLICY IF EXISTS submission_files_owner_delete ON storage.objects;
CREATE POLICY submission_files_owner_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='assignment-submissions' AND (public.is_admin() OR (
  (storage.foldername(name))[1]=auth.uid()::text AND public.has_role('student') AND EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id::text=(storage.foldername(name))[2]
    AND s.student_id=auth.uid() AND s.status='draft' AND s.grade IS NULL AND s.graded_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.submission_versions v WHERE v.submission_id=s.id)))));

NOTIFY pgrst, 'reload schema';
COMMIT;
