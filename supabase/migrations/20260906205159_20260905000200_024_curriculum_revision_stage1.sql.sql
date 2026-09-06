-- Content-only revision for the existing B1-101 course. Preserves IDs, student work and grades.
ALTER TABLE public.assessment_attempts ADD COLUMN IF NOT EXISTS question_snapshot jsonb;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS rubric jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb;