CREATE FUNCTION public.companion_author_item(cohort_uuid uuid,module_uuid uuid,item_kind text,item_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; component uuid; category uuid; q jsonb; options jsonb; answer text; n integer:=0; graded boolean;
BEGIN
 IF NOT companion_staff(cohort_uuid) OR NOT EXISTS(SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id WHERE m.id=module_uuid AND c.id=cohort_uuid) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF btrim(COALESCE(item_data->>'title',''))='' THEN RAISE EXCEPTION 'A title is required'; END IF;
 SELECT id INTO component FROM module_components WHERE module_id=module_uuid AND type=item_kind ORDER BY created_at LIMIT 1;
 IF component IS NULL THEN RAISE EXCEPTION 'Prepare module templates first'; END IF;
 IF item_kind='activity' THEN
  INSERT INTO assignments(cohort_id,module_id,title,description,assignment_type,max_points,max_attempts,allow_file_upload,allowed_file_types,max_file_size_mb,evidence_required,evidence_instructions,due_date,is_published,created_by)
  VALUES(cohort_uuid,module_uuid,item_data->>'title',item_data->>'instructions','activity',COALESCE((item_data->>'max_points')::numeric,100),20,true,ARRAY['png','jpg','jpeg','pdf','docx','xlsx','pptx','txt'],25,btrim(COALESCE(item_data->>'evidence',''))<>'',item_data->>'evidence',NULLIF(item_data->>'due_date','')::timestamptz,true,auth.uid()) RETURNING id INTO result;
  INSERT INTO component_bindings(component_id,cohort_id,assignment_id) VALUES(component,cohort_uuid,result);
  INSERT INTO grade_categories(cohort_id,name,weight) VALUES(cohort_uuid,'Activities',0) ON CONFLICT(cohort_id,name) DO UPDATE SET name=excluded.name RETURNING id INTO category;
  INSERT INTO grade_items(grade_category_id,assignment_id,name,max_points) VALUES(category,result,item_data->>'title',COALESCE((item_data->>'max_points')::numeric,100));
 ELSIF item_kind='assessment' THEN
  IF jsonb_array_length(COALESCE(item_data->'questions','[]'))=0 THEN RAISE EXCEPTION 'Add at least one question'; END IF;
  IF (item_data->>'max_attempts')::integer NOT BETWEEN 1 AND 20 OR (item_data->>'passing_score')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid attempts or passing score'; END IF;
  graded:=COALESCE((item_data->>'graded')::boolean,false);
  INSERT INTO assessments(cohort_id,module_id,title,instructions,assessment_type,max_attempts,passing_score,shuffle_questions,reveal_correct_answers,is_published,created_by)
  VALUES(cohort_uuid,module_uuid,item_data->>'title',item_data->>'instructions',CASE WHEN graded THEN 'quiz' ELSE 'practice' END,(item_data->>'max_attempts')::integer,(item_data->>'passing_score')::numeric,COALESCE((item_data->>'shuffle')::boolean,false),COALESCE((item_data->>'reveal')::boolean,false),true,auth.uid()) RETURNING id INTO result;
  FOR q IN SELECT * FROM jsonb_array_elements(item_data->'questions') LOOP
   IF q->>'question_type' NOT IN ('multiple_choice','multiple_select','true_false') OR btrim(COALESCE(q->>'question_text',''))='' THEN RAISE EXCEPTION 'Complete each beta question'; END IF;
   options:=q->'options';answer:=q->>'correct_answer';
   IF jsonb_array_length(options)<2 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(options) v WHERE btrim(v)='') THEN RAISE EXCEPTION 'Provide at least two nonempty options'; END IF;
   IF q->>'question_type'='multiple_select' THEN
    answer:=to_jsonb(string_to_array(answer,E'\n'))::text;
    IF answer='[]' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(answer::jsonb) v WHERE NOT options ? v) THEN RAISE EXCEPTION 'Correct answers must match available options'; END IF;
   ELSIF NOT options ? answer THEN RAISE EXCEPTION 'Correct answer must match an available option'; END IF;
   n:=n+1;INSERT INTO assessment_questions(assessment_id,question_type,question_text,options,correct_answer,explanation,display_order) VALUES(result,q->>'question_type',q->>'question_text',options,answer,q->>'explanation',n);
  END LOOP;
  INSERT INTO component_bindings(component_id,cohort_id,assessment_id) VALUES(component,cohort_uuid,result);
  IF graded THEN
   INSERT INTO grade_categories(cohort_id,name,weight) VALUES(cohort_uuid,'Quizzes',0) ON CONFLICT(cohort_id,name) DO UPDATE SET name=excluded.name RETURNING id INTO category;
   INSERT INTO grade_items(grade_category_id,assessment_id,name,max_points) VALUES(category,result,item_data->>'title',n);
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported coursework type'; END IF;
 RETURN result;
END $$;
-- Completion of a v2 recap is independent of legacy lesson progression.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.protect_submission_academic_fields()'::regprocedure);
 d:=replace(d,'IF assignment_record.assignment_type = ''activity'' AND assignment_record.lesson_id IS NOT NULL', 'IF NOT companion_enabled(assignment_record.cohort_id) AND assignment_record.assignment_type = ''activity'' AND assignment_record.lesson_id IS NOT NULL');
 EXECUTE d;
END $$;
CREATE FUNCTION public.companion_publish_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_published AND NEW.type='ebook_recap' AND NOT EXISTS(SELECT 1 FROM lesson_blocks WHERE lesson_id=NEW.lesson_id) THEN RAISE EXCEPTION 'Add recap pages before publishing'; END IF;
 IF NEW.is_published AND NEW.type IN ('audio','video') AND NEW.resource_id IS NULL THEN RAISE EXCEPTION 'Select a media resource before publishing'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER companion_publish_guard BEFORE INSERT OR UPDATE ON module_components FOR EACH ROW EXECUTE FUNCTION companion_publish_guard();
REVOKE ALL ON FUNCTION public.companion_author_item(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.companion_author_item(uuid,uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.companion_publish_guard() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';