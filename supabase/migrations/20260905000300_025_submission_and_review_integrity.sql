-- Preserve drafts, submitted work, rubric marks, and the exact questions a student answered.
BEGIN;
DO $$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.protect_submission_academic_fields()'::regprocedure);
 IF position('new_attempt boolean := TG_OP = ''INSERT'';' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected submission function version. Apply migration 012 before 025.'; END IF;
 definition:=replace(definition,'new_attempt boolean := TG_OP = ''INSERT'';','new_attempt boolean := TG_OP = ''INSERT'' AND NEW.status = ''submitted'';');
 definition:=replace(definition,'IF NEW.student_id <> auth.uid()',
 'IF TG_OP = ''UPDATE'' AND OLD.status IN (''submitted'', ''graded'') THEN RAISE EXCEPTION ''Your submitted work is preserved. Ask your instructor to return it for changes.''; END IF;
  NEW.rubric_scores := CASE WHEN TG_OP = ''UPDATE'' THEN OLD.rubric_scores ELSE ''{}''::jsonb END;
  IF assignment_record.assignment_type = ''activity'' AND assignment_record.lesson_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM progress_records WHERE lesson_id=assignment_record.lesson_id AND student_id=auth.uid() AND cohort_id=assignment_record.cohort_id AND status=''completed'') THEN RAISE EXCEPTION ''Complete the related learning before working on this activity.''; END IF;
  IF NEW.status=''submitted'' AND assignment_record.assignment_type=''activity'' AND (btrim(COALESCE(NEW.content::jsonb->>''work'',''''))='''' OR COALESCE(jsonb_array_length(NEW.content::jsonb->''selfCheck''),0)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content::jsonb->''selfCheck'') v WHERE v<>''true''::jsonb)) THEN RAISE EXCEPTION ''Add your work and complete the self-check before submitting.''; END IF;
  IF NEW.student_id <> auth.uid()');
 EXECUTE definition;
END $$;

CREATE FUNCTION public.snapshot_assessment_questions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order) INTO NEW.question_snapshot FROM assessment_questions q WHERE q.assessment_id=NEW.assessment_id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER snapshot_assessment_questions BEFORE INSERT ON public.assessment_attempts FOR EACH ROW EXECUTE FUNCTION public.snapshot_assessment_questions();

CREATE OR REPLACE FUNCTION public.review_assessment_session(assessment_uuid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assessment_attempts%ROWTYPE; questions jsonb; feedback jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM assessments WHERE id=assessment_uuid AND public.is_enrolled(cohort_id)) THEN RAISE EXCEPTION 'Active enrolment required'; END IF;
 SELECT * INTO a FROM assessment_attempts WHERE assessment_id=assessment_uuid AND student_id=auth.uid() AND status IN('completed','graded','pending_review') ORDER BY completed_at DESC NULLS LAST LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Complete an attempt before reviewing'; END IF;
 questions:=COALESCE(a.question_snapshot,(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order) FROM assessment_questions q WHERE q.assessment_id=assessment_uuid));
 SELECT jsonb_object_agg(q->>'id',jsonb_build_object('correct',COALESCE(a.answers->>(q->>'id')=q->>'correct_answer',false),'correct_answer',q->>'correct_answer','explanation',q->>'explanation')) INTO feedback FROM jsonb_array_elements(questions) q;
 RETURN jsonb_build_object('answers',a.answers,'feedback',feedback,'questions',(SELECT jsonb_agg(q-'correct_answer'-'explanation') FROM jsonb_array_elements(questions) q),'result',jsonb_build_object('percentage',a.percentage,'pending_review',a.status='pending_review'));
END;
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
