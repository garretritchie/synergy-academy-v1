BEGIN;
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.assessment_ready(uuid)'::regprocedure),'CREATE OR REPLACE FUNCTION public.assessment_ready(', 'CREATE OR REPLACE FUNCTION public.v1_assessment_ready('); END $$;
REVOKE ALL ON FUNCTION public.v1_assessment_ready(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.assessment_ready(assessment_uuid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN companion_enabled(a.cohort_id) THEN a.is_published AND is_enrolled(a.cohort_id) AND companion_module_open(a.module_id,a.cohort_id)
 AND EXISTS(SELECT 1 FROM component_bindings b JOIN module_components x ON x.id=b.component_id WHERE b.assessment_id=a.id AND b.cohort_id=a.cohort_id AND x.is_published)
 ELSE v1_assessment_ready(a.id) END FROM assessments a WHERE a.id=assessment_uuid
$$;
-- Preserve the existing session lock/idempotency and grade engine, restoring configurable attempts for v2.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.begin_assessment_session(uuid,uuid)'::regprocedure);
 d:=replace(d,'a.assessment_type<>''practice'' AND GREATEST','(a.assessment_type<>''practice'' OR companion_enabled(a.cohort_id)) AND GREATEST');
 d:=replace(d,'>= 1+(SELECT count(*)','>= (CASE WHEN companion_enabled(a.cohort_id) THEN a.max_attempts ELSE 1 END)+(SELECT count(*)');
 EXECUTE d;
 d:=pg_get_functiondef('public.finalize_assessment_grade_internal(uuid,uuid,jsonb)'::regprocedure);
 d:=replace(d,'(1 + (SELECT count(*)','((CASE WHEN companion_enabled(assessment_record.cohort_id) THEN assessment_record.max_attempts ELSE 1 END) + (SELECT count(*)');
 EXECUTE d;
END $$;
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.check_assessment_answer(uuid,text)'::regprocedure),'CREATE OR REPLACE FUNCTION public.check_assessment_answer(', 'CREATE OR REPLACE FUNCTION public.v1_check_assessment_answer('); END $$;
REVOKE ALL ON FUNCTION public.v1_check_assessment_answer(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.check_assessment_answer(question_uuid uuid,selected_answer text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM assessment_questions q JOIN assessments a ON a.id=q.assessment_id WHERE q.id=question_uuid AND companion_enabled(a.cohort_id)) THEN RAISE EXCEPTION 'Submit the assessment to receive feedback'; END IF;
 RETURN v1_check_assessment_answer(question_uuid,selected_answer);
END $$;
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.submit_assessment_attempt(uuid,uuid,jsonb)'::regprocedure),'CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(', 'CREATE OR REPLACE FUNCTION public.v1_submit_assessment_attempt('); END $$;
REVOKE ALL ON FUNCTION public.v1_submit_assessment_attempt(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(assessment_uuid uuid,enrolment_uuid uuid,submitted_answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assessments%ROWTYPE; s assessment_sessions%ROWTYPE;
BEGIN
 SELECT * INTO a FROM assessments WHERE id=assessment_uuid;
 IF companion_enabled(a.cohort_id) THEN
  IF NOT assessment_ready(a.id) OR NOT EXISTS(SELECT 1 FROM enrolments WHERE id=enrolment_uuid AND student_id=auth.uid() AND cohort_id=a.cohort_id AND status='active') THEN RAISE EXCEPTION 'Assessment is not available'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(enrolment_uuid::text||assessment_uuid::text,0));
  SELECT * INTO s FROM assessment_sessions WHERE assessment_id=a.id AND enrolment_id=enrolment_uuid AND student_id=auth.uid() ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Start your assessment first'; END IF;
  IF s.completed_at IS NOT NULL THEN RETURN s.result; END IF;
  IF s.expires_at IS NULL OR now()<s.expires_at THEN UPDATE assessment_sessions SET answers=submitted_answers WHERE id=s.id; END IF;
 END IF;
 RETURN v1_submit_assessment_attempt(assessment_uuid,enrolment_uuid,submitted_answers);
END $$;
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.review_assessment_session(uuid)'::regprocedure),'CREATE OR REPLACE FUNCTION public.review_assessment_session(', 'CREATE OR REPLACE FUNCTION public.v1_review_assessment_session('); END $$;
REVOKE ALL ON FUNCTION public.v1_review_assessment_session(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.review_assessment_session(assessment_uuid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assessments%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO a FROM assessments WHERE id=assessment_uuid;
 IF companion_enabled(a.cohort_id) AND NOT assessment_ready(a.id) THEN RAISE EXCEPTION 'Assessment is not available'; END IF;
 result:=v1_review_assessment_session(assessment_uuid);
 IF companion_enabled(a.cohort_id) AND NOT a.reveal_correct_answers THEN result:=result-'feedback'; END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.companion_gradebook(cohort_uuid uuid,student_uuid uuid DEFAULT auth.uid()) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid; items jsonb; average numeric;
BEGIN
 IF NOT (student_uuid=auth.uid() AND is_active_account() OR companion_staff(cohort_uuid)) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT id INTO eid FROM enrolments WHERE cohort_id=cohort_uuid AND student_id=student_uuid;
 IF eid IS NULL THEN RAISE EXCEPTION 'Enrolment required'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'title',i.name,'category',c.name,'module_title',m.title,'percentage',g.percentage,'feedback',g.feedback,
 'status',CASE WHEN g.percentage IS NOT NULL THEN 'Graded' WHEN s.status='returned' THEN 'Resubmission required' WHEN s.status='submitted' THEN 'Submitted' ELSE 'Not completed' END) ORDER BY c.display_order,i.display_order,i.name),'[]') INTO items
 FROM grade_items i JOIN grade_categories c ON c.id=i.grade_category_id LEFT JOIN grades g ON g.grade_item_id=i.id AND g.enrolment_id=eid AND NOT EXISTS(SELECT 1 FROM submissions returned WHERE returned.assignment_id=i.assignment_id AND returned.enrolment_id=eid AND returned.status IN ('returned','draft','submitted'))
 LEFT JOIN assignments a ON a.id=i.assignment_id LEFT JOIN assessments q ON q.id=i.assessment_id LEFT JOIN modules m ON m.id=COALESCE(a.module_id,q.module_id)
 LEFT JOIN submissions s ON s.assignment_id=a.id AND s.enrolment_id=eid WHERE c.cohort_id=cohort_uuid;
 WITH ranked AS (SELECT c.id,c.weight,c.drop_lowest,g.percentage,row_number() OVER(PARTITION BY c.id ORDER BY g.percentage) rank,count(*) OVER(PARTITION BY c.id) total
 FROM grades g JOIN grade_items i ON i.id=g.grade_item_id JOIN grade_categories c ON c.id=i.grade_category_id WHERE g.enrolment_id=eid AND c.cohort_id=cohort_uuid AND g.percentage IS NOT NULL AND NOT EXISTS(SELECT 1 FROM submissions returned WHERE returned.assignment_id=i.assignment_id AND returned.enrolment_id=eid AND returned.status<>'graded')),
 categories AS(SELECT id,weight,avg(percentage) score FROM ranked WHERE rank>least(drop_lowest,greatest(total-1,0)) GROUP BY id,weight)
 SELECT CASE WHEN sum(weight)>0 THEN round(sum(score*weight)/sum(weight),1) ELSE NULL END INTO average FROM categories;
 RETURN jsonb_build_object('items',items,'current_grade',average,'graded_count',(SELECT count(*) FROM jsonb_array_elements(items) i WHERE i->>'percentage' IS NOT NULL),'total',jsonb_array_length(items));
END $$;

-- Reuse live-session records; bulk marking preserves existing attendance by default.
CREATE OR REPLACE FUNCTION public.companion_mark_present(session_uuid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid;
BEGIN
 SELECT cohort_id INTO c FROM live_sessions WHERE id=session_uuid AND NOT is_cancelled;
 IF c IS NULL OR NOT companion_staff(c) THEN RAISE EXCEPTION 'Assigned instructor required'; END IF;
 INSERT INTO attendance_records(live_session_id,student_id,enrolment_id,status,recorded_by)
 SELECT session_uuid,student_id,id,'present',auth.uid() FROM enrolments WHERE cohort_id=c AND status='active'
 ON CONFLICT(live_session_id,student_id) DO NOTHING;
END $$;

DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('assessment_ready','check_assessment_answer','submit_assessment_attempt','review_assessment_session','companion_gradebook','companion_mark_present') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',r.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.signature);
END LOOP; END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
