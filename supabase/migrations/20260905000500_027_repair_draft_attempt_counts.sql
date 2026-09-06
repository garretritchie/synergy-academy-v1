-- Apply after 025. Repair only never-submitted drafts affected by the old
-- INSERT trigger. Preserve genuine attempts, grades, content, files and history.
BEGIN;
DO $$ BEGIN
  IF position('new_attempt boolean := TG_OP = ''INSERT'' AND NEW.status = ''submitted'';' IN pg_get_functiondef('public.protect_submission_academic_fields()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Apply migration 025 before 027: drafts must not consume submission attempts.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.submission_attempt_repairs (
  submission_id uuid PRIMARY KEY REFERENCES public.submissions(id) ON DELETE CASCADE,
  previous_attempt_count integer NOT NULL,
  previous_submitted_at timestamptz,
  repaired_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'Legacy draft insert counted as a submission without submission history'
);
ALTER TABLE public.submission_attempt_repairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.submission_attempt_repairs FROM anon, authenticated;
GRANT SELECT ON public.submission_attempt_repairs TO authenticated;
CREATE POLICY submission_attempt_repairs_admin_read ON public.submission_attempt_repairs
  FOR SELECT TO authenticated USING (public.is_admin());

-- This transaction holds the table lock until the guard is restored.
LOCK TABLE public.submissions IN ACCESS EXCLUSIVE MODE;
INSERT INTO public.submission_attempt_repairs (submission_id, previous_attempt_count, previous_submitted_at)
SELECT s.id, s.attempt_count, s.submitted_at FROM public.submissions s
WHERE s.status = 'draft' AND s.attempt_count = 1
  AND s.grade IS NULL AND s.graded_at IS NULL AND s.graded_by IS NULL
  AND s.feedback IS NULL AND COALESCE(s.rubric_scores, '{}'::jsonb) = '{}'::jsonb
  AND NOT EXISTS (SELECT 1 FROM public.submission_versions v WHERE v.submission_id = s.id)
ON CONFLICT (submission_id) DO NOTHING;

ALTER TABLE public.submissions DISABLE TRIGGER trg_protect_submission_academic_fields;
UPDATE public.submissions s SET attempt_count = 0, submitted_at = NULL
FROM public.submission_attempt_repairs r
WHERE r.submission_id = s.id AND s.status = 'draft' AND s.attempt_count = 1
  AND s.grade IS NULL AND s.graded_at IS NULL AND s.graded_by IS NULL AND s.feedback IS NULL
  AND COALESCE(s.rubric_scores, '{}'::jsonb) = '{}'::jsonb
  AND NOT EXISTS (SELECT 1 FROM public.submission_versions v WHERE v.submission_id = s.id);
ALTER TABLE public.submissions ENABLE TRIGGER trg_protect_submission_academic_fields;
NOTIFY pgrst, 'reload schema';
COMMIT;
