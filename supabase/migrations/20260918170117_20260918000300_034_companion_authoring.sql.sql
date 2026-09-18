CREATE FUNCTION public.companion_save_component(cohort_uuid uuid,component_uuid uuid,component_data jsonb,target_ids uuid[] DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x module_components%ROWTYPE; target uuid;
BEGIN
 IF NOT companion_staff(cohort_uuid) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO x FROM module_components WHERE id=component_uuid FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id WHERE m.id=x.module_id AND c.id=cohort_uuid) THEN RAISE EXCEPTION 'Invalid component'; END IF;
 UPDATE module_components SET title=component_data->>'title',description=component_data->>'description',required=COALESCE((component_data->>'required')::boolean,true),is_published=COALESCE((component_data->>'is_published')::boolean,false),display_order=COALESCE((component_data->>'display_order')::integer,0),lesson_id=NULLIF(component_data->>'lesson_id','')::uuid,resource_id=NULLIF(component_data->>'resource_id','')::uuid,requires_pass=COALESCE((component_data->>'requires_pass')::boolean,true) WHERE id=x.id;
 IF x.type IN ('activity','assessment','live_session') THEN
  DELETE FROM component_bindings WHERE component_id=x.id AND cohort_id=cohort_uuid;
  FOREACH target IN ARRAY target_ids LOOP
   INSERT INTO component_bindings(component_id,cohort_id,assignment_id,assessment_id,live_session_id) VALUES(x.id,cohort_uuid,CASE WHEN x.type='activity' THEN target END,CASE WHEN x.type='assessment' THEN target END,CASE WHEN x.type='live_session' THEN target END);
  END LOOP;
 END IF;
END $$;
-- A media resource uses a private existing course-assets object, including larger podcast files.
UPDATE storage.buckets SET file_size_limit=GREATEST(COALESCE(file_size_limit,0),134217728),
 allowed_mime_types=CASE WHEN allowed_mime_types IS NULL THEN NULL ELSE ARRAY(SELECT DISTINCT unnest(allowed_mime_types||ARRAY['audio/mp4','audio/x-m4a','audio/mpeg','audio/wav','audio/ogg','video/mp4','video/webm'])) END WHERE id='course-assets';
CREATE POLICY companion_lesson_author ON lessons FOR ALL TO authenticated USING(companion_manage_module(module_id)) WITH CHECK(companion_manage_module(module_id));
CREATE POLICY companion_block_author ON lesson_blocks FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM lessons l WHERE l.id=lesson_id AND companion_manage_module(l.module_id))) WITH CHECK(EXISTS(SELECT 1 FROM lessons l WHERE l.id=lesson_id AND companion_manage_module(l.module_id)));

CREATE FUNCTION public.companion_save_answer(assessment_uuid uuid,question_uuid uuid,answer_value jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s assessment_sessions%ROWTYPE; q assessment_questions%ROWTYPE;
BEGIN
 IF NOT assessment_ready(assessment_uuid) THEN RAISE EXCEPTION 'Assessment is not available'; END IF;
 SELECT * INTO s FROM assessment_sessions WHERE assessment_id=assessment_uuid AND student_id=auth.uid() AND completed_at IS NULL FOR UPDATE;
 IF NOT FOUND OR s.expires_at IS NOT NULL AND now()>=s.expires_at THEN RAISE EXCEPTION 'No active assessment session'; END IF;
 SELECT * INTO q FROM assessment_questions WHERE id=question_uuid AND assessment_id=assessment_uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
 UPDATE assessment_sessions SET answers=answers||jsonb_build_object(question_uuid::text,answer_value) WHERE id=s.id;
END $$;
-- Protect question payloads at the RPC boundary, including lesson-less module assessments.
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.get_assessment_for_student(uuid)'::regprocedure),'CREATE OR REPLACE FUNCTION public.get_assessment_for_student(', 'CREATE OR REPLACE FUNCTION public.v1_get_assessment_for_student('); END $$;
REVOKE ALL ON FUNCTION public.v1_get_assessment_for_student(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_assessment_for_student(assessment_uuid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assessments%ROWTYPE; result jsonb; sid uuid;
BEGIN
 SELECT * INTO a FROM assessments WHERE id=assessment_uuid;
 IF companion_enabled(a.cohort_id) AND NOT assessment_ready(a.id) THEN RAISE EXCEPTION 'Assessment is not available'; END IF;
 result:=v1_get_assessment_for_student(assessment_uuid);
 IF companion_enabled(a.cohort_id) AND a.shuffle_questions THEN
  SELECT id INTO sid FROM assessment_sessions WHERE assessment_id=a.id AND student_id=auth.uid() ORDER BY started_at DESC LIMIT 1;
  result:=jsonb_set(result,'{questions}',COALESCE((SELECT jsonb_agg(q ORDER BY md5(q->>'id'||COALESCE(sid::text,auth.uid()::text))) FROM jsonb_array_elements(result->'questions') q),'[]'));
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.companion_activity_grade() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assignments%ROWTYPE; category uuid; item uuid;
BEGIN
 SELECT * INTO a FROM assignments WHERE id=NEW.assignment_id;
 IF NOT companion_enabled(a.cohort_id) OR NEW.status<>'graded' OR NEW.grade IS NULL OR NEW.max_grade<=0 THEN RETURN NEW; END IF;
 SELECT id INTO item FROM grade_items WHERE assignment_id=a.id;
 IF item IS NULL THEN
 INSERT INTO grade_categories(cohort_id,name,weight) VALUES(a.cohort_id,'Activities',0) ON CONFLICT(cohort_id,name) DO UPDATE SET name=excluded.name RETURNING id INTO category;
 INSERT INTO grade_items(grade_category_id,assignment_id,name,max_points) VALUES(category,a.id,a.title,NEW.max_grade) RETURNING id INTO item;
 END IF;
 INSERT INTO grades(grade_item_id,enrolment_id,student_id,score,max_score,feedback,override_reason) VALUES(item,NEW.enrolment_id,NEW.student_id,NEW.grade,NEW.max_grade,NEW.feedback,'Instructor activity review')
 ON CONFLICT(grade_item_id,enrolment_id) DO UPDATE SET score=excluded.score,max_score=excluded.max_score,feedback=excluded.feedback,override_reason='Instructor activity review';
 RETURN NEW;
END $$;
CREATE TRIGGER companion_activity_grade AFTER INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION companion_activity_grade();

CREATE FUNCTION public.companion_staff_roster(cohort_uuid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT companion_staff(cohort_uuid) THEN RAISE EXCEPTION 'Assigned instructor required'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'student_id',e.student_id,'name',concat_ws(' ',p.first_name,p.last_name),'email',p.email,'outline',companion_outline(cohort_uuid,e.student_id),'grades',companion_gradebook(cohort_uuid,e.student_id),'failed_checks',(SELECT count(*) FROM assessments a WHERE a.cohort_id=cohort_uuid AND a.is_published AND EXISTS(SELECT 1 FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.enrolment_id=e.id) AND NOT EXISTS(SELECT 1 FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.enrolment_id=e.id AND t.percentage>=COALESCE(a.passing_score,0)))) ORDER BY p.last_name,p.first_name) FROM enrolments e JOIN profiles p ON p.id=e.student_id WHERE e.cohort_id=cohort_uuid AND e.status IN ('active','completed')),'[]');
END $$;
REVOKE ALL ON FUNCTION public.companion_save_component(uuid,uuid,jsonb,uuid[]),public.companion_save_answer(uuid,uuid,jsonb),public.companion_staff_roster(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.companion_save_component(uuid,uuid,jsonb,uuid[]),public.companion_save_answer(uuid,uuid,jsonb),public.companion_staff_roster(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.companion_activity_grade() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';