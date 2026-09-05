BEGIN;
ALTER TABLE public.discussions ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
CREATE POLICY discussions_visible_unless_staff ON public.discussions AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT is_hidden OR public.is_admin() OR public.is_cohort_instructor(cohort_id));
CREATE FUNCTION public.protect_discussion_moderation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT(public.is_admin() OR public.is_cohort_instructor(NEW.cohort_id)) THEN
  IF (TG_OP='INSERT' AND NEW.is_hidden) OR (TG_OP='UPDATE' AND NEW.is_hidden IS DISTINCT FROM OLD.is_hidden) THEN RAISE EXCEPTION 'Only teaching staff can hide or restore a discussion'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_discussion_moderation BEFORE INSERT OR UPDATE ON public.discussions FOR EACH ROW EXECUTE FUNCTION public.protect_discussion_moderation();
CREATE TABLE public.discussion_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 discussion_id uuid NOT NULL REFERENCES public.discussions(id),
 cohort_id uuid NOT NULL REFERENCES public.cohorts(id),
 reporter_id uuid NOT NULL REFERENCES public.profiles(id),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 5 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 reviewed_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.discussion_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_staff_read ON public.discussion_reports FOR SELECT TO authenticated USING(public.is_admin() OR public.is_cohort_instructor(cohort_id));
CREATE POLICY reports_student_insert ON public.discussion_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid() AND resolved_at IS NULL AND reviewed_by IS NULL AND public.is_enrolled(cohort_id) AND EXISTS(SELECT 1 FROM discussions d WHERE d.id=discussion_id AND d.cohort_id=discussion_reports.cohort_id));
CREATE POLICY reports_staff_update ON public.discussion_reports FOR UPDATE TO authenticated USING(public.is_admin() OR public.is_cohort_instructor(cohort_id)) WITH CHECK(public.is_admin() OR public.is_cohort_instructor(cohort_id));
NOTIFY pgrst,'reload schema';
COMMIT;
