-- Server-owned, resumable attempts. Apply after 022. No existing grades are removed.
BEGIN;
CREATE TABLE public.assessment_attempt_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assessment_id uuid NOT NULL REFERENCES public.assessments(id),
 enrolment_id uuid NOT NULL REFERENCES public.enrolments(id),
 authorized_by uuid NOT NULL REFERENCES public.profiles(id),
 reason text NOT NULL CHECK(char_length(btrim(reason))>=5),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_attempt_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY attempt_authorizations_read ON public.assessment_attempt_authorizations FOR SELECT TO authenticated USING(public.is_admin() OR EXISTS(SELECT 1 FROM assessments a WHERE a.id=assessment_id AND public.is_cohort_instructor(a.cohort_id)) OR EXISTS(SELECT 1 FROM enrolments e WHERE e.id=enrolment_id AND e.student_id=auth.uid()));
CREATE FUNCTION public.authorize_assessment_attempt(assessment_uuid uuid,enrolment_uuid uuid,reason_text text,request_uuid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cohort_uuid uuid;
BEGIN
 SELECT cohort_id INTO cohort_uuid FROM assessments WHERE id=assessment_uuid AND assessment_type<>'practice';
 IF NOT FOUND OR NOT(public.is_admin() OR public.is_cohort_instructor(cohort_uuid)) THEN RAISE EXCEPTION 'Only the assigned instructor or administrator can authorize an attempt'; END IF;
 IF NOT EXISTS(SELECT 1 FROM enrolments WHERE id=enrolment_uuid AND cohort_id=cohort_uuid AND status='active') THEN RAISE EXCEPTION 'Choose an active student in this cohort'; END IF;
 IF char_length(btrim(reason_text))<5 THEN RAISE EXCEPTION 'Record a reason for the additional attempt'; END IF;
 INSERT INTO assessment_attempt_authorizations(id,assessment_id,enrolment_id,authorized_by,reason) VALUES(request_uuid,assessment_uuid,enrolment_uuid,auth.uid(),btrim(reason_text)) ON CONFLICT(id) DO NOTHING;
 RETURN request_uuid;
END;
$$;
CREATE TABLE public.assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id),
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id),
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  completed_at timestamptz
);
CREATE INDEX assessment_sessions_owner ON public.assessment_sessions(student_id, assessment_id);
CREATE UNIQUE INDEX assessment_sessions_one_open ON public.assessment_sessions(enrolment_id,assessment_id) WHERE completed_at IS NULL;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_read ON public.assessment_sessions FOR SELECT TO authenticated USING(student_id=auth.uid() OR public.is_admin() OR EXISTS(SELECT 1 FROM public.assessments a WHERE a.id=assessment_id AND public.is_cohort_instructor(a.cohort_id)));

CREATE OR REPLACE FUNCTION public.assessment_ready(assessment_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (
 SELECT 1 FROM assessments a LEFT JOIN modules target ON target.id=a.module_id
 WHERE a.id=assessment_uuid AND a.is_published AND public.is_enrolled(a.cohort_id)
 AND (a.lesson_id IS NULL OR (public.is_lesson_released(a.lesson_id,a.cohort_id) AND EXISTS(SELECT 1 FROM progress_records p WHERE p.lesson_id=a.lesson_id AND p.cohort_id=a.cohort_id AND p.student_id=auth.uid() AND p.status='completed')))
 AND NOT EXISTS (
   SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id
   WHERE c.id=a.cohort_id AND m.is_published AND target.id IS NOT NULL AND m.display_order<=target.display_order
   AND (
     EXISTS(SELECT 1 FROM lessons l WHERE l.module_id=m.id AND l.is_published AND NOT EXISTS(SELECT 1 FROM progress_records p WHERE p.lesson_id=l.id AND p.cohort_id=a.cohort_id AND p.student_id=auth.uid() AND p.status='completed'))
     OR EXISTS(SELECT 1 FROM assignments t WHERE t.module_id=m.id AND t.cohort_id=a.cohort_id AND t.assignment_type='activity' AND t.is_published AND NOT EXISTS(SELECT 1 FROM submissions s WHERE s.assignment_id=t.id AND s.student_id=auth.uid() AND s.status IN ('submitted','graded')))
     OR EXISTS(SELECT 1 FROM assessments q WHERE q.module_id=m.id AND q.cohort_id=a.cohort_id AND q.is_published AND q.assessment_type='practice' AND q.id<>a.id AND (a.assessment_type<>'practice' OR m.display_order<target.display_order OR (q.title,q.id)<(a.title,a.id)) AND NOT EXISTS(SELECT 1 FROM assessment_attempts x WHERE x.assessment_id=q.id AND x.student_id=auth.uid() AND x.status='completed' AND x.percentage>=COALESCE(q.passing_score,0)))
   )
 )
 );
$$;

CREATE OR REPLACE FUNCTION public.begin_assessment_session(assessment_uuid uuid,enrolment_uuid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assessments%ROWTYPE; s assessment_sessions%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM enrolments WHERE id=enrolment_uuid AND student_id=auth.uid() AND status='active') THEN RAISE EXCEPTION 'Active enrolment required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(enrolment_uuid::text||assessment_uuid::text,0));
 SELECT * INTO a FROM assessments WHERE id=assessment_uuid AND cohort_id=(SELECT cohort_id FROM enrolments WHERE id=enrolment_uuid);
 IF NOT FOUND OR NOT public.assessment_ready(assessment_uuid) THEN RAISE EXCEPTION 'Finish the required learning steps before starting'; END IF;
 SELECT * INTO s FROM assessment_sessions WHERE assessment_id=assessment_uuid AND enrolment_id=enrolment_uuid AND completed_at IS NULL;
 IF FOUND THEN RETURN to_jsonb(s); END IF;
 IF a.assessment_type<>'practice' AND GREATEST((SELECT count(*) FROM assessment_attempts WHERE assessment_id=a.id AND enrolment_id=enrolment_uuid),(SELECT count(*) FROM assessment_sessions WHERE assessment_id=a.id AND enrolment_id=enrolment_uuid)) >= 1+(SELECT count(*) FROM assessment_attempt_authorizations WHERE assessment_id=a.id AND enrolment_id=enrolment_uuid) THEN RAISE EXCEPTION 'You have used your allowed attempt. Ask your instructor to authorize another, or review your result.'; END IF;
 INSERT INTO assessment_sessions(assessment_id,enrolment_id,student_id,expires_at) VALUES(a.id,enrolment_uuid,auth.uid(),CASE WHEN a.assessment_type<>'practice' AND a.time_limit_minutes>0 THEN now()+make_interval(mins=>a.time_limit_minutes) END) RETURNING * INTO s;
 RETURN to_jsonb(s);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_assessment_answer(question_uuid uuid,selected_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q assessment_questions%ROWTYPE; s assessment_sessions%ROWTYPE; response jsonb;
BEGIN
 SELECT * INTO q FROM assessment_questions WHERE id=question_uuid;
 SELECT * INTO s FROM assessment_sessions WHERE assessment_id=q.assessment_id AND student_id=auth.uid() AND completed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Start or resume your assessment first'; END IF;
 IF NOT public.is_enrolled((SELECT cohort_id FROM assessments WHERE id=q.assessment_id)) THEN RAISE EXCEPTION 'Active enrolment required'; END IF;
 IF s.feedback ? question_uuid::text THEN RETURN s.feedback->question_uuid::text; END IF;
 IF s.expires_at IS NOT NULL AND now()>=s.expires_at THEN RAISE EXCEPTION 'Time has ended. Finish the assessment to record your saved answers.'; END IF;
 IF q.question_type NOT IN ('multiple_choice','true_false','matching') THEN RAISE EXCEPTION 'This question requires instructor review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.options) x WHERE COALESCE(x->>'value',x->>'label',x#>>'{}')=selected_answer) THEN RAISE EXCEPTION 'Choose one of the available answers'; END IF;
 response=jsonb_build_object('correct',selected_answer=q.correct_answer,'correct_answer',q.correct_answer,'explanation',q.explanation);
 UPDATE assessment_sessions SET answers=answers||jsonb_build_object(question_uuid::text,selected_answer),feedback=feedback||jsonb_build_object(question_uuid::text,response) WHERE id=s.id;
 RETURN response;
END;
$$;

-- Keep the established gradebook calculation private and call it only with saved answers.
ALTER FUNCTION public.submit_assessment_attempt(uuid,uuid,jsonb) RENAME TO finalize_assessment_grade_internal;
DO $$ BEGIN
 EXECUTE replace(replace(pg_get_functiondef('public.finalize_assessment_grade_internal(uuid,uuid,jsonb)'::regprocedure),'''multiple_choice'', ''true_false''','''multiple_choice'', ''true_false'', ''matching'''),'assessment_record.max_attempts','(1 + (SELECT count(*) FROM assessment_attempt_authorizations WHERE assessment_id=assessment_uuid AND enrolment_id=enrolment_uuid))');
END $$;
REVOKE ALL ON FUNCTION public.finalize_assessment_grade_internal(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.submit_assessment_attempt(assessment_uuid uuid,enrolment_uuid uuid,submitted_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s assessment_sessions%ROWTYPE; saved jsonb; output jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(enrolment_uuid::text||assessment_uuid::text,0));
 SELECT * INTO s FROM assessment_sessions WHERE assessment_id=assessment_uuid AND enrolment_id=enrolment_uuid AND student_id=auth.uid() ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Start your assessment first'; END IF;
 IF s.completed_at IS NOT NULL THEN RETURN s.result; END IF;
 saved=s.answers;
 IF s.expires_at IS NOT NULL AND now()>=s.expires_at THEN
   SELECT COALESCE(jsonb_object_agg(id::text,COALESCE(saved->>id::text,'[Not answered before time ended]')),'{}'::jsonb) INTO saved FROM assessment_questions WHERE assessment_id=assessment_uuid;
 ELSIF EXISTS(SELECT 1 FROM assessment_questions WHERE assessment_id=assessment_uuid AND NOT(saved ? id::text)) THEN RAISE EXCEPTION 'Check every answer before finishing'; END IF;
 output=public.finalize_assessment_grade_internal(assessment_uuid,enrolment_uuid,saved);
 UPDATE assessment_sessions SET answers=saved,result=output,completed_at=now() WHERE id=s.id;
 RETURN output;
END;
$$;

CREATE FUNCTION public.review_assessment_session(assessment_uuid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s assessment_sessions%ROWTYPE; a assessment_attempts%ROWTYPE; answer_map jsonb; result_feedback jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM assessments WHERE id=assessment_uuid AND public.is_enrolled(cohort_id)) THEN RAISE EXCEPTION 'Active enrolment required'; END IF;
 SELECT * INTO s FROM assessment_sessions WHERE assessment_id=assessment_uuid AND student_id=auth.uid() AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1;
 IF FOUND THEN answer_map=s.answers; ELSE
 SELECT * INTO a FROM assessment_attempts WHERE assessment_id=assessment_uuid AND student_id=auth.uid() AND status IN('completed','graded','pending_review') ORDER BY completed_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Complete an attempt before reviewing'; END IF;
 answer_map=a.answers;
 END IF;
 SELECT jsonb_object_agg(id::text,jsonb_build_object('correct',COALESCE(answer_map->>id::text=correct_answer,false),'correct_answer',correct_answer,'explanation',explanation)) INTO result_feedback FROM assessment_questions WHERE assessment_id=assessment_uuid;
 RETURN jsonb_build_object('answers',answer_map,'feedback',result_feedback,'result',s.result);
END;
$$;

DROP POLICY IF EXISTS attempts_insert_own_or_instructor_or_admin ON public.assessment_attempts;
DROP POLICY IF EXISTS attempts_update_own_or_instructor_or_admin ON public.assessment_attempts;
CREATE POLICY attempts_staff_insert ON public.assessment_attempts FOR INSERT TO authenticated WITH CHECK(public.is_admin() OR EXISTS(SELECT 1 FROM assessments a WHERE a.id=assessment_id AND public.is_cohort_instructor(a.cohort_id)));
CREATE POLICY attempts_staff_update ON public.assessment_attempts FOR UPDATE TO authenticated USING(public.is_admin() OR EXISTS(SELECT 1 FROM assessments a WHERE a.id=assessment_id AND public.is_cohort_instructor(a.cohort_id))) WITH CHECK(public.is_admin() OR EXISTS(SELECT 1 FROM assessments a WHERE a.id=assessment_id AND public.is_cohort_instructor(a.cohort_id)));
REVOKE ALL ON FUNCTION public.assessment_ready(uuid),public.begin_assessment_session(uuid,uuid),public.submit_assessment_attempt(uuid,uuid,jsonb),public.review_assessment_session(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.authorize_assessment_attempt(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.authorize_assessment_attempt(uuid,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assessment_ready(uuid),public.begin_assessment_session(uuid,uuid),public.submit_assessment_attempt(uuid,uuid,jsonb),public.review_assessment_session(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
