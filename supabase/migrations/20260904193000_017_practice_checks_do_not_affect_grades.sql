/*
  # Keep mastery checks out of the official grade

  AI Business Essentials uses practice assessments as required module checks.
  They control progression, but the official grading plan contains only four
  homework assignments, three graded quizzes (including the midterm), one
  presentation, and the final exam.
*/

CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(
  assessment_uuid uuid,
  enrolment_uuid uuid,
  submitted_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assessment_record assessments%ROWTYPE;
  total_points numeric := 0;
  earned_points numeric := 0;
  attempt_count int := 0;
  percentage_value numeric := 0;
  attempt_id uuid;
  quiz_category_id uuid;
  quiz_grade_item_id uuid;
  has_manual_questions boolean := false;
BEGIN
  SELECT * INTO assessment_record FROM assessments
  WHERE id = assessment_uuid
    AND is_published = true
    AND (lesson_id IS NULL OR public.is_lesson_released(lesson_id, cohort_id));
  IF NOT FOUND OR NOT public.is_enrolled(assessment_record.cohort_id) THEN
    RAISE EXCEPTION 'Assessment is not available';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM enrolments
    WHERE id = enrolment_uuid
      AND student_id = auth.uid()
      AND cohort_id = assessment_record.cohort_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid enrolment';
  END IF;
  SELECT count(*) INTO attempt_count FROM assessment_attempts
  WHERE assessment_id = assessment_uuid
    AND enrolment_id = enrolment_uuid
    AND status IN ('completed', 'pending_review');
  IF assessment_record.assessment_type <> 'practice'
    AND attempt_count >= assessment_record.max_attempts THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;
  IF EXISTS (
    SELECT 1 FROM assessment_questions q
    WHERE q.assessment_id = assessment_uuid
      AND (
        NOT (submitted_answers ? q.id::text)
        OR (q.question_type = 'multiple_select' AND CASE
          WHEN jsonb_typeof(submitted_answers -> q.id::text) = 'array'
            THEN jsonb_array_length(submitted_answers -> q.id::text) = 0
          ELSE true
        END)
        OR (q.question_type <> 'multiple_select'
          AND btrim(COALESCE(submitted_answers ->> q.id::text, '')) = '')
      )
  ) THEN
    RAISE EXCEPTION 'Every assessment question requires an answer';
  END IF;

  SELECT
    COALESCE(sum(points), 0),
    COALESCE(sum(
      CASE
        WHEN question_type IN ('multiple_choice', 'true_false')
          AND submitted_answers ->> id::text = correct_answer THEN points
        WHEN question_type = 'multiple_select'
          AND correct_answer IS NOT NULL
          AND (submitted_answers -> id::text) @> correct_answer::jsonb
          AND correct_answer::jsonb @> (submitted_answers -> id::text) THEN points
        ELSE 0
      END
    ), 0)
  INTO total_points, earned_points
  FROM assessment_questions
  WHERE assessment_id = assessment_uuid;

  SELECT EXISTS (
    SELECT 1 FROM assessment_questions
    WHERE assessment_id = assessment_uuid
      AND question_type IN ('short_answer', 'long_answer')
  ) INTO has_manual_questions;
  percentage_value := CASE
    WHEN total_points > 0 THEN round((earned_points / total_points) * 100, 2)
    ELSE 0
  END;

  INSERT INTO assessment_attempts (
    assessment_id, enrolment_id, student_id, completed_at, status,
    score, max_score, percentage, answers
  )
  VALUES (
    assessment_uuid,
    enrolment_uuid,
    auth.uid(),
    now(),
    CASE WHEN has_manual_questions THEN 'pending_review' ELSE 'completed' END,
    earned_points,
    total_points,
    CASE WHEN has_manual_questions THEN NULL ELSE percentage_value END,
    submitted_answers
  )
  RETURNING id INTO attempt_id;

  IF NOT has_manual_questions AND assessment_record.assessment_type <> 'practice' THEN
    INSERT INTO grade_categories (cohort_id, name, description, weight, display_order)
    VALUES (assessment_record.cohort_id, 'Quizzes', 'Automatically graded assessments', 0, 20)
    ON CONFLICT (cohort_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO quiz_category_id;

    INSERT INTO grade_items (grade_category_id, assessment_id, name, max_points)
    VALUES (quiz_category_id, assessment_uuid, assessment_record.title, total_points)
    ON CONFLICT (assessment_id) WHERE assessment_id IS NOT NULL
    DO UPDATE SET name = EXCLUDED.name, max_points = EXCLUDED.max_points
    RETURNING id INTO quiz_grade_item_id;

    INSERT INTO grades (
      grade_item_id, enrolment_id, student_id, score, max_score,
      percentage, override_reason, graded_at
    )
    VALUES (
      quiz_grade_item_id, enrolment_uuid, auth.uid(), earned_points,
      total_points, percentage_value, 'New assessment attempt', now()
    )
    ON CONFLICT (grade_item_id, enrolment_id) DO UPDATE
      SET score = EXCLUDED.score,
          max_score = EXCLUDED.max_score,
          percentage = EXCLUDED.percentage,
          override_reason = EXCLUDED.override_reason,
          graded_at = EXCLUDED.graded_at
      WHERE grades.percentage IS NULL OR EXCLUDED.percentage > grades.percentage;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', attempt_id,
    'score', earned_points,
    'max_score', total_points,
    'percentage', CASE WHEN has_manual_questions THEN NULL ELSE percentage_value END,
    'passed', CASE
      WHEN has_manual_questions THEN NULL
      ELSE assessment_record.passing_score IS NULL
        OR percentage_value >= assessment_record.passing_score
    END,
    'pending_review', has_manual_questions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assessment_attempt(uuid, uuid, jsonb) TO authenticated;
