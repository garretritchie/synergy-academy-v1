-- Return feedback for one submitted answer without creating an assessment attempt.
-- The learner must be actively enrolled and the assessment must be available.
CREATE OR REPLACE FUNCTION public.check_assessment_answer(
  question_uuid uuid,
  selected_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  question_record public.assessment_questions%ROWTYPE;
  assessment_record public.assessments%ROWTYPE;
BEGIN
  SELECT * INTO question_record
  FROM public.assessment_questions
  WHERE id = question_uuid;

  SELECT * INTO assessment_record
  FROM public.assessments
  WHERE id = question_record.assessment_id
    AND is_published = true;

  IF NOT FOUND
    OR NOT public.is_enrolled(assessment_record.cohort_id)
    OR (
      assessment_record.lesson_id IS NOT NULL
      AND NOT public.is_lesson_released(
        assessment_record.lesson_id,
        assessment_record.cohort_id
      )
    ) THEN
    RAISE EXCEPTION 'Assessment question is not available';
  END IF;

  IF question_record.question_type NOT IN ('multiple_choice', 'true_false') THEN
    RAISE EXCEPTION 'Immediate feedback is not available for this question type';
  END IF;

  RETURN jsonb_build_object(
    'correct', selected_answer = question_record.correct_answer,
    'correct_answer', question_record.correct_answer,
    'explanation', question_record.explanation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_assessment_answer(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_assessment_answer(uuid, text)
  TO authenticated;
