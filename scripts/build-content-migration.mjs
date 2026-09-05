import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('src/content/ai-business-essentials.json','utf8'));
const payload=JSON.stringify(data).replaceAll('$curriculum$','');
const sql=`-- Content-only revision for the existing B1-101 course. Preserves IDs, student work and grades.
BEGIN;
ALTER TABLE public.assessment_attempts ADD COLUMN IF NOT EXISTS question_snapshot jsonb;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS rubric jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $release$
DECLARE curriculum jsonb := $curriculum$${payload}$curriculum$::jsonb;
 course_uuid uuid; module_uuid uuid; lesson_uuid uuid; assessment_uuid uuid; question_uuid uuid; block_uuid uuid;
 module_data jsonb; screen_data jsonb; assessment_data jsonb; question_data jsonb; activity_data jsonb; assignment_data jsonb; cohort_row record; ordinal integer;
BEGIN
 SELECT id INTO course_uuid FROM courses WHERE slug='ai-business-essentials';
 IF course_uuid IS NULL THEN RAISE NOTICE 'B1-101 not installed. No content changed.'; RETURN; END IF;
 IF EXISTS(SELECT 1 FROM assessment_sessions s JOIN assessments a ON a.id=s.assessment_id JOIN cohorts c ON c.id=a.cohort_id WHERE c.course_id=course_uuid AND s.completed_at IS NULL) THEN RAISE EXCEPTION 'Finish open B1-101 assessment sessions before installing the curriculum revision.'; END IF;
 UPDATE assessment_attempts x SET question_snapshot=(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order) FROM assessment_questions q WHERE q.assessment_id=x.assessment_id)
 WHERE question_snapshot IS NULL AND EXISTS(SELECT 1 FROM assessments a JOIN cohorts c ON c.id=a.cohort_id WHERE a.id=x.assessment_id AND c.course_id=course_uuid);
 FOR module_data IN SELECT value FROM jsonb_array_elements(curriculum->'modules') LOOP
  SELECT id INTO module_uuid FROM modules WHERE course_id=course_uuid AND metadata->>'content_key'=module_data->>'id';
  IF module_uuid IS NULL THEN RAISE EXCEPTION 'Expected seeded module % is missing. No partial update applied.',module_data->>'id'; END IF;
  SELECT id INTO lesson_uuid FROM lessons WHERE module_id=module_uuid AND metadata->>'content_key'=module_data->>'id' ORDER BY display_order LIMIT 1;
  IF lesson_uuid IS NULL THEN RAISE EXCEPTION 'Expected lesson is missing for %',module_data->>'id'; END IF;
  UPDATE modules SET description=module_data->>'description',metadata=metadata||jsonb_build_object('screen_count',jsonb_array_length(module_data->'screens')) WHERE id=module_uuid;
  UPDATE lessons SET title=CASE WHEN module_data->>'id'='introduction' THEN 'Course Introduction' ELSE module_data->>'title' END,metadata=metadata||jsonb_build_object('screen_count',jsonb_array_length(module_data->'screens'),'completion_destination','learning_path') WHERE id=lesson_uuid;
  ordinal:=0;
  FOR screen_data IN SELECT value FROM jsonb_array_elements(module_data->'screens') LOOP
   ordinal:=ordinal+1;
   SELECT id INTO block_uuid FROM lesson_blocks WHERE lesson_id=lesson_uuid AND (content->>'id'=screen_data->>'id' OR content->>'part_id'=screen_data->>'id') ORDER BY display_order LIMIT 1;
   IF block_uuid IS NULL THEN INSERT INTO lesson_blocks(lesson_id,block_type,content,display_order) VALUES(lesson_uuid,'storyboard_screen',screen_data||jsonb_build_object('part_id',screen_data->>'id'),ordinal);
   ELSE UPDATE lesson_blocks SET content=screen_data||jsonb_build_object('part_id',screen_data->>'id'),display_order=ordinal WHERE id=block_uuid; END IF;
  END LOOP;
 END LOOP;
 FOR cohort_row IN SELECT id FROM cohorts WHERE course_id=course_uuid LOOP
  UPDATE assignments a SET is_published=false WHERE cohort_id=cohort_row.id AND assignment_type='activity' AND EXISTS(SELECT 1 FROM modules m WHERE m.id=a.module_id AND m.metadata->>'content_key'='introduction');
  FOR assessment_data IN SELECT value FROM jsonb_array_elements(curriculum->'assessments') LOOP
   SELECT id INTO assessment_uuid FROM assessments WHERE cohort_id=cohort_row.id AND title=assessment_data->>'title';
   IF assessment_uuid IS NULL THEN CONTINUE; END IF;
   IF (SELECT count(*) FROM assessment_questions WHERE assessment_id=assessment_uuid)>jsonb_array_length(assessment_data->'questions') THEN RAISE EXCEPTION 'Unexpected extra questions in %. Review custom content before updating.',assessment_data->>'title'; END IF;
   UPDATE assessments SET max_attempts=CASE WHEN assessment_type='practice' THEN 2147483647 ELSE 1 END,instructions=CASE WHEN assessment_type='practice' THEN 'Practice as often as you like. Check each answer, learn from the feedback, and finish to save your result.' ELSE 'One attempt is allowed unless your instructor authorizes another. Your timer continues if you leave. Check each answer and finish to record your result.' END WHERE id=assessment_uuid;
   ordinal:=0;
   FOR question_data IN SELECT value FROM jsonb_array_elements(assessment_data->'questions') LOOP
    ordinal:=ordinal+1;
    SELECT id INTO question_uuid FROM assessment_questions WHERE assessment_id=assessment_uuid AND display_order=ordinal LIMIT 1;
    IF question_uuid IS NULL THEN INSERT INTO assessment_questions(assessment_id,question_type,question_text,options,correct_answer,explanation,points,display_order) VALUES(assessment_uuid,COALESCE(question_data->>'type','multiple_choice'),question_data->>'question',question_data->'options',question_data->>'answer',question_data->>'explanation',1,ordinal);
    ELSE UPDATE assessment_questions SET question_type=COALESCE(question_data->>'type','multiple_choice'),question_text=question_data->>'question',options=question_data->'options',correct_answer=question_data->>'answer',explanation=question_data->>'explanation' WHERE id=question_uuid; END IF;
   END LOOP;
  END LOOP;
  FOR activity_data IN SELECT value FROM jsonb_array_elements(curriculum->'activities') LOOP
   UPDATE assignments SET description='Directions'||E'\\n'||(SELECT string_agg(ordinality::text||'. '||value,E'\\n' ORDER BY ordinality) FROM jsonb_array_elements_text(activity_data->'instructions') WITH ORDINALITY)||E'\\n\\nSelf-check\\n'||(SELECT string_agg('- '||value,E'\\n' ORDER BY ordinality) FROM jsonb_array_elements_text(activity_data->'selfCheck') WITH ORDINALITY),rubric=COALESCE(activity_data->'rubric','{}'::jsonb),max_points=100,weight=0,max_attempts=20,allow_file_upload=true WHERE cohort_id=cohort_row.id AND title=activity_data->>'title' AND assignment_type='activity';
  END LOOP;
  FOR assignment_data IN SELECT value FROM jsonb_array_elements(curriculum->'assignments') LOOP
   UPDATE assignments SET description='Instructions'||E'\\n'||(SELECT string_agg(ordinality::text||'. '||value,E'\\n' ORDER BY ordinality) FROM jsonb_array_elements_text(assignment_data->'instructions') WITH ORDINALITY)||E'\\n\\nBefore you submit\\n'||(SELECT string_agg('- '||value,E'\\n' ORDER BY ordinality) FROM jsonb_array_elements_text(assignment_data->'checklist') WITH ORDINALITY)||E'\\n'||COALESCE(assignment_data->>'gradingNote',''),rubric=COALESCE(assignment_data->'rubric','{}'::jsonb) WHERE cohort_id=cohort_row.id AND title=assignment_data->>'title' AND assignment_type<>'activity';
  END LOOP;
  UPDATE announcements SET body='Welcome! Begin with Introduction, then follow Learn it, Do it, Assess it within Learning. Graded assessments and Assignments have their own tabs. Find course updates and Q&A in Messages.' WHERE cohort_id=cohort_row.id AND title='Welcome to AI Business Essentials';
 END LOOP;
 UPDATE courses SET metadata=metadata||jsonb_build_object('curriculum_version',curriculum->'course'->>'version','screen_count',298,'delivery','eLearning or hybrid') WHERE id=course_uuid;
 UPDATE resources SET url='storage:'||split_part(split_part(url,'/storage/v1/object/sign/course-assets/',2),'?',1) WHERE course_id=course_uuid AND url LIKE '%/storage/v1/object/sign/course-assets/%';
END;
$release$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
// Print an apply_patch document; the release process applies it, then validates SQL.
console.log('*** Begin Patch\n*** Add File: D:/CODEX/SynergyAcademy/supabase/migrations/20260905000200_024_curriculum_revision.sql\n'+sql.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
