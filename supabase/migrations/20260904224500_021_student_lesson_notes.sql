/* Private student notes tied to one learning screen. */

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  screen_index integer NOT NULL CHECK (screen_index >= 0),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, cohort_id, lesson_id, screen_index)
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lesson_notes_student_lesson
  ON public.lesson_notes(student_id, lesson_id, screen_index);

DROP POLICY IF EXISTS "lesson_notes_owner_select" ON public.lesson_notes;
CREATE POLICY "lesson_notes_owner_select"
  ON public.lesson_notes FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND public.is_enrolled(cohort_id));

DROP POLICY IF EXISTS "lesson_notes_owner_insert" ON public.lesson_notes;
CREATE POLICY "lesson_notes_owner_insert"
  ON public.lesson_notes FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.is_enrolled(cohort_id));

DROP POLICY IF EXISTS "lesson_notes_owner_update" ON public.lesson_notes;
CREATE POLICY "lesson_notes_owner_update"
  ON public.lesson_notes FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND public.is_enrolled(cohort_id))
  WITH CHECK (student_id = auth.uid() AND public.is_enrolled(cohort_id));

DROP POLICY IF EXISTS "lesson_notes_owner_delete" ON public.lesson_notes;
CREATE POLICY "lesson_notes_owner_delete"
  ON public.lesson_notes FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND public.is_enrolled(cohort_id));

CREATE OR REPLACE FUNCTION public.touch_lesson_note_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lesson_note_updated_at ON public.lesson_notes;
CREATE TRIGGER trg_touch_lesson_note_updated_at
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_lesson_note_updated_at();
