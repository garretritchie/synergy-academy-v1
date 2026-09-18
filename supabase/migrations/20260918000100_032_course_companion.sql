-- Additive v2 delivery model. Existing courses remain on v1 until explicitly enabled.
BEGIN;
CREATE TABLE public.module_components (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid NOT NULL REFERENCES modules(id),
 type text NOT NULL CHECK(type IN ('ebook_recap','video','audio','activity','assessment','resources','live_session')),
 title text NOT NULL, description text, display_order integer NOT NULL DEFAULT 0,
 required boolean NOT NULL DEFAULT true, is_published boolean NOT NULL DEFAULT false,
 lesson_id uuid REFERENCES lessons(id), resource_id uuid REFERENCES resources(id),
 requires_pass boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON module_components(module_id);
CREATE TABLE public.component_bindings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), component_id uuid NOT NULL REFERENCES module_components(id),
 cohort_id uuid NOT NULL REFERENCES cohorts(id), assignment_id uuid REFERENCES assignments(id),
 assessment_id uuid REFERENCES assessments(id), live_session_id uuid REFERENCES live_sessions(id),
 CHECK(num_nonnulls(assignment_id,assessment_id,live_session_id)=1)
);
CREATE UNIQUE INDEX ON component_bindings(component_id,cohort_id,assignment_id) WHERE assignment_id IS NOT NULL;
CREATE UNIQUE INDEX ON component_bindings(component_id,cohort_id,assessment_id) WHERE assessment_id IS NOT NULL;
CREATE UNIQUE INDEX ON component_bindings(component_id,cohort_id,live_session_id) WHERE live_session_id IS NOT NULL;
CREATE TABLE public.module_releases (
 module_id uuid NOT NULL REFERENCES modules(id), cohort_id uuid NOT NULL REFERENCES cohorts(id),
 mode text NOT NULL DEFAULT 'locked' CHECK(mode IN ('locked','released','scheduled','relative')),
 release_at timestamptz, days_offset integer CHECK(days_offset>=0),
 PRIMARY KEY(module_id,cohort_id),
 CHECK(mode<>'scheduled' OR release_at IS NOT NULL), CHECK(mode<>'relative' OR days_offset IS NOT NULL)
);
CREATE TABLE public.component_progress (
 enrolment_id uuid NOT NULL REFERENCES enrolments(id), component_id uuid NOT NULL REFERENCES module_components(id),
 status text NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','completed')),
 position numeric NOT NULL DEFAULT 0 CHECK(position>=0), completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(enrolment_id,component_id)
);
ALTER TABLE assignments ADD COLUMN evidence_required boolean NOT NULL DEFAULT false;
ALTER TABLE assignments ADD COLUMN evidence_instructions text;
ALTER TABLE assessments ADD COLUMN reveal_correct_answers boolean NOT NULL DEFAULT false;
ALTER TABLE instructor_profiles ADD COLUMN welcome_video_url text;

CREATE OR REPLACE FUNCTION public.companion_enabled(cohort_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT (metadata->>'companion_v2')::boolean FROM cohorts WHERE id=cohort_uuid),false)
$$;
CREATE OR REPLACE FUNCTION public.companion_staff(cohort_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_account() AND (public.is_admin() OR public.is_cohort_instructor(cohort_uuid))
$$;
CREATE OR REPLACE FUNCTION public.companion_module_open(module_uuid uuid,cohort_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id
 LEFT JOIN module_releases r ON r.module_id=m.id AND r.cohort_id=c.id
 WHERE m.id=module_uuid AND c.id=cohort_uuid AND public.is_active_account()
 AND (public.companion_staff(c.id) OR (public.is_enrolled(c.id) AND m.is_published AND
 (NOT public.companion_enabled(c.id) OR r.mode='released' OR r.mode='scheduled' AND now()>=r.release_at
 OR r.mode='relative' AND c.start_date IS NOT NULL AND now() >= (c.start_date::timestamp AT TIME ZONE 'America/Nassau')+make_interval(days=>r.days_offset)))))
$$;
CREATE OR REPLACE FUNCTION public.companion_component_access(component_uuid uuid,cohort_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM module_components x WHERE x.id=component_uuid
 AND public.companion_module_open(x.module_id,cohort_uuid) AND (x.is_published OR public.companion_staff(cohort_uuid)))
$$;
CREATE OR REPLACE FUNCTION public.companion_manage_module(module_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_account() AND (public.is_admin() OR EXISTS(SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id WHERE m.id=module_uuid AND public.is_cohort_instructor(c.id)))
$$;

CREATE OR REPLACE FUNCTION public.validate_companion_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m uuid; c uuid; kind text;
BEGIN
 IF TG_TABLE_NAME='module_components' THEN
  IF NEW.lesson_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lessons WHERE id=NEW.lesson_id AND module_id=NEW.module_id) THEN RAISE EXCEPTION 'Recap lesson must belong to this module'; END IF;
  IF NEW.resource_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM resources r JOIN modules x ON x.course_id=r.course_id WHERE x.id=NEW.module_id AND r.id=NEW.resource_id AND r.module_id=NEW.module_id AND r.cohort_id IS NULL) THEN RAISE EXCEPTION 'Media resource must be shared within this module'; END IF;
 ELSE
  IF TG_TABLE_NAME='component_bindings' THEN SELECT module_id,type INTO m,kind FROM module_components WHERE id=NEW.component_id; ELSE m:=NEW.module_id; END IF;
  SELECT course_id INTO c FROM modules WHERE id=m;
  IF NOT EXISTS(SELECT 1 FROM cohorts WHERE id=NEW.cohort_id AND course_id=c) THEN RAISE EXCEPTION 'Module and cohort must share a course'; END IF;
  IF TG_TABLE_NAME='component_bindings' THEN
   IF NEW.assignment_id IS NOT NULL AND (kind<>'activity' OR NOT EXISTS(SELECT 1 FROM assignments WHERE id=NEW.assignment_id AND cohort_id=NEW.cohort_id AND module_id=m)) THEN RAISE EXCEPTION 'Activity binding must match module and cohort'; END IF;
   IF NEW.assessment_id IS NOT NULL AND (kind<>'assessment' OR NOT EXISTS(SELECT 1 FROM assessments WHERE id=NEW.assessment_id AND cohort_id=NEW.cohort_id AND module_id=m)) THEN RAISE EXCEPTION 'Assessment binding must match module and cohort'; END IF;
   IF NEW.live_session_id IS NOT NULL AND (kind<>'live_session' OR NOT EXISTS(SELECT 1 FROM live_sessions WHERE id=NEW.live_session_id AND cohort_id=NEW.cohort_id)) THEN RAISE EXCEPTION 'Session binding must match cohort'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_component BEFORE INSERT OR UPDATE ON module_components FOR EACH ROW EXECUTE FUNCTION validate_companion_reference();
CREATE TRIGGER validate_binding BEFORE INSERT OR UPDATE ON component_bindings FOR EACH ROW EXECUTE FUNCTION validate_companion_reference();
CREATE TRIGGER validate_module_release BEFORE INSERT OR UPDATE ON module_releases FOR EACH ROW EXECUTE FUNCTION validate_companion_reference();
ALTER TABLE module_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY component_read ON module_components FOR SELECT TO authenticated USING (
 public.companion_manage_module(module_id) OR EXISTS(SELECT 1 FROM cohorts c JOIN modules m ON m.course_id=c.course_id WHERE m.id=module_id AND public.companion_component_access(module_components.id,c.id)));
CREATE POLICY component_manage ON module_components FOR ALL TO authenticated USING(companion_manage_module(module_id)) WITH CHECK(companion_manage_module(module_id));
CREATE POLICY binding_read ON component_bindings FOR SELECT TO authenticated USING(companion_component_access(component_id,cohort_id));
CREATE POLICY binding_manage ON component_bindings FOR ALL TO authenticated USING(companion_staff(cohort_id)) WITH CHECK(companion_staff(cohort_id));
CREATE POLICY release_read ON module_releases FOR SELECT TO authenticated USING(companion_staff(cohort_id) OR is_enrolled(cohort_id));
CREATE POLICY release_manage ON module_releases FOR ALL TO authenticated USING(companion_staff(cohort_id)) WITH CHECK(companion_staff(cohort_id));
CREATE POLICY component_progress_read ON component_progress FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM enrolments e WHERE e.id=enrolment_id AND (e.student_id=auth.uid() OR companion_staff(e.cohort_id))));
GRANT SELECT,INSERT,UPDATE,DELETE ON module_components,component_bindings,module_releases TO authenticated;
GRANT SELECT ON component_progress TO authenticated;

-- Preserve v1 semantics while closing every v2 content path, including old deep links.
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.is_lesson_released(uuid,uuid)'::regprocedure),'CREATE OR REPLACE FUNCTION public.is_lesson_released(', 'CREATE OR REPLACE FUNCTION public.v1_is_lesson_released('); END $$;
REVOKE ALL ON FUNCTION public.v1_is_lesson_released(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.is_lesson_released(lesson_uuid uuid,cohort_uuid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN companion_enabled(cohort_uuid) THEN EXISTS(SELECT 1 FROM lessons l WHERE l.id=lesson_uuid AND companion_module_open(l.module_id,cohort_uuid)) ELSE v1_is_lesson_released(lesson_uuid,cohort_uuid) END
$$;
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.is_resource_released(uuid,uuid,uuid)'::regprocedure),'CREATE OR REPLACE FUNCTION public.is_resource_released(', 'CREATE OR REPLACE FUNCTION public.v1_is_resource_released('); END $$;
REVOKE ALL ON FUNCTION public.v1_is_resource_released(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.is_resource_released(resource_uuid uuid,cohort_uuid uuid,student_uuid uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT v1_is_resource_released(resource_uuid,cohort_uuid,student_uuid) AND EXISTS(SELECT 1 FROM resources r WHERE r.id=resource_uuid AND (r.module_id IS NULL OR companion_module_open(r.module_id,cohort_uuid)))
$$;
-- Restrictive policies intersect ALL existing permissive policies.
CREATE POLICY companion_assignment_gate ON assignments AS RESTRICTIVE FOR SELECT TO authenticated USING(module_id IS NULL OR companion_module_open(module_id,cohort_id));
CREATE POLICY companion_assessment_gate ON assessments AS RESTRICTIVE FOR SELECT TO authenticated USING(module_id IS NULL OR companion_module_open(module_id,cohort_id));
CREATE POLICY companion_lesson_gate ON lessons AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id WHERE m.id=module_id AND companion_module_open(m.id,c.id)) OR is_admin());
CREATE POLICY companion_block_gate ON lesson_blocks AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM lessons l WHERE l.id=lesson_id));
CREATE POLICY companion_storage_gate ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'course-assets' OR is_admin() OR EXISTS(
 SELECT 1 FROM cohorts c WHERE c.course_id::text=(storage.foldername(name))[1] AND (companion_staff(c.id) OR (is_enrolled(c.id) AND (NOT companion_enabled(c.id) OR EXISTS(SELECT 1 FROM resources r WHERE r.id::text=(storage.foldername(name))[2] AND is_resource_released(r.id,c.id,auth.uid())) OR EXISTS(SELECT 1 FROM lessons l WHERE l.id::text=(storage.foldername(name))[2] AND is_lesson_released(l.id,c.id)))))));

CREATE OR REPLACE FUNCTION public.companion_submission_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a assignments%ROWTYPE;
BEGIN
 SELECT * INTO a FROM assignments WHERE id=NEW.assignment_id;
 IF NOT companion_enabled(a.cohort_id) OR companion_staff(a.cohort_id) THEN RETURN NEW; END IF;
 IF NOT companion_module_open(a.module_id,a.cohort_id) THEN RAISE EXCEPTION 'This module is not released'; END IF;
 IF NEW.status='submitted' AND a.evidence_required AND NOT EXISTS(SELECT 1 FROM submission_files WHERE submission_id=NEW.id) THEN RAISE EXCEPTION 'Upload the required evidence before submitting'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER companion_submission_guard BEFORE INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION companion_submission_guard();

CREATE OR REPLACE FUNCTION public.companion_component_state(component_uuid uuid,enrolment_uuid uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE x module_components%ROWTYPE; e enrolments%ROWTYPE; total integer; done integer;
BEGIN
 SELECT * INTO e FROM enrolments WHERE id=enrolment_uuid;
 IF NOT FOUND OR NOT (e.student_id=auth.uid() AND is_active_account() OR companion_staff(e.cohort_id)) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO x FROM module_components WHERE id=component_uuid;
 IF NOT EXISTS(SELECT 1 FROM modules m JOIN cohorts c ON c.course_id=m.course_id WHERE m.id=x.module_id AND c.id=e.cohort_id) THEN RAISE EXCEPTION 'Invalid component'; END IF;
 IF x.type IN ('activity','assessment','live_session') THEN
  SELECT count(*),count(*) FILTER(WHERE CASE x.type
   WHEN 'activity' THEN EXISTS(SELECT 1 FROM submissions s WHERE s.assignment_id=b.assignment_id AND s.enrolment_id=e.id AND s.status IN ('submitted','graded'))
   WHEN 'assessment' THEN EXISTS(SELECT 1 FROM assessment_attempts a JOIN assessments q ON q.id=a.assessment_id WHERE a.assessment_id=b.assessment_id AND a.enrolment_id=e.id AND a.status IN ('completed','graded') AND (NOT x.requires_pass OR a.percentage>=COALESCE(q.passing_score,0)))
   ELSE EXISTS(SELECT 1 FROM attendance_records ar WHERE ar.live_session_id=b.live_session_id AND ar.enrolment_id=e.id AND ar.status IN ('present','late','left_early','excused')) OR EXISTS(SELECT 1 FROM live_sessions s WHERE s.id=b.live_session_id AND s.is_cancelled) END)
  INTO total,done FROM component_bindings b WHERE b.component_id=x.id AND b.cohort_id=e.cohort_id;
  IF total>0 AND total=done THEN RETURN 'completed'; END IF;
  IF done>0 OR EXISTS(SELECT 1 FROM component_bindings b JOIN submissions s ON s.assignment_id=b.assignment_id WHERE b.component_id=x.id AND s.enrolment_id=e.id) OR EXISTS(SELECT 1 FROM component_bindings b JOIN assessment_sessions s ON s.assessment_id=b.assessment_id WHERE b.component_id=x.id AND s.enrolment_id=e.id) THEN RETURN 'in_progress'; END IF;
  RETURN 'not_started';
 END IF;
 RETURN COALESCE((SELECT status FROM component_progress WHERE component_id=x.id AND enrolment_id=e.id),'not_started');
END $$;

CREATE OR REPLACE FUNCTION public.companion_outline(cohort_uuid uuid,student_uuid uuid DEFAULT auth.uid()) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e enrolments%ROWTYPE; result jsonb;
BEGIN
 IF NOT (student_uuid=auth.uid() AND is_active_account() OR companion_staff(cohort_uuid)) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO e FROM enrolments WHERE cohort_id=cohort_uuid AND student_id=student_uuid AND status IN ('active','completed');
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrolment required'; END IF;
 SELECT jsonb_build_object('enrolment_id',e.id,'enabled',companion_enabled(cohort_uuid),'modules',COALESCE(jsonb_agg(row_data ORDER BY display_order),'[]')) INTO result FROM (
 SELECT m.display_order,jsonb_build_object('id',m.id,'title',m.title,'display_order',m.display_order,
 'description',CASE WHEN companion_module_open(m.id,cohort_uuid) THEN m.description END,
 'available',e.status='active' AND (NOT companion_enabled(cohort_uuid) OR r.mode='released' OR r.mode='scheduled' AND now()>=r.release_at OR r.mode='relative' AND now()>=(c.start_date::timestamp AT TIME ZONE 'America/Nassau')+make_interval(days=>r.days_offset)),'release_at',CASE WHEN r.mode='relative' THEN (c.start_date::timestamp AT TIME ZONE 'America/Nassau')+make_interval(days=>r.days_offset) ELSE r.release_at END,
 'components',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'type',x.type,'required',x.required,'status',companion_component_state(x.id,e.id)) ORDER BY x.display_order,x.id) FROM module_components x WHERE x.module_id=m.id AND x.is_published),'[]')) row_data
 FROM modules m JOIN cohorts c ON c.course_id=m.course_id LEFT JOIN module_releases r ON r.module_id=m.id AND r.cohort_id=c.id WHERE c.id=cohort_uuid AND m.is_published) q;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.companion_save_progress(component_uuid uuid,cohort_uuid uuid,new_position numeric DEFAULT 0,complete boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x module_components%ROWTYPE; eid uuid; pages integer;
BEGIN
 SELECT id INTO eid FROM enrolments WHERE cohort_id=cohort_uuid AND student_id=auth.uid() AND status='active';
 SELECT * INTO x FROM module_components WHERE id=component_uuid;
 IF eid IS NULL OR NOT companion_component_access(x.id,cohort_uuid) OR x.type NOT IN ('ebook_recap','video','audio','resources') THEN RAISE EXCEPTION 'Completion is not available for this component'; END IF;
 IF new_position<0 OR new_position>864000 THEN RAISE EXCEPTION 'Invalid position'; END IF;
 IF x.type='ebook_recap' AND complete THEN
 SELECT count(*) INTO pages FROM lesson_blocks WHERE lesson_id=x.lesson_id;
 IF pages=0 OR new_position<pages-1 THEN RAISE EXCEPTION 'Reach the final recap page first'; END IF;
 END IF;
 IF x.type='resources' AND complete AND NOT EXISTS(SELECT 1 FROM resources r WHERE r.module_id=x.module_id AND is_resource_released(r.id,cohort_uuid)) THEN RAISE EXCEPTION 'Resources have not been provided'; END IF;
 IF x.type IN ('video','audio') AND x.resource_id IS NULL THEN RAISE EXCEPTION 'Media has not been provided'; END IF;
 INSERT INTO component_progress(enrolment_id,component_id,status,position,completed_at) VALUES(eid,x.id,CASE WHEN complete THEN 'completed' ELSE 'in_progress' END,new_position,CASE WHEN complete THEN now() END)
 ON CONFLICT(enrolment_id,component_id) DO UPDATE SET status=CASE WHEN component_progress.status='completed' THEN 'completed' ELSE excluded.status END,position=excluded.position,completed_at=COALESCE(component_progress.completed_at,excluded.completed_at),updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.companion_initialize(cohort_uuid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m record; x uuid; spec record;
BEGIN
 IF NOT companion_staff(cohort_uuid) THEN RAISE EXCEPTION 'Assigned instructor or administrator required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cohort_uuid::text,1));
 FOR m IN SELECT modules.* FROM modules JOIN cohorts c ON c.course_id=modules.course_id WHERE c.id=cohort_uuid LOOP
  INSERT INTO module_releases(module_id,cohort_id) VALUES(m.id,cohort_uuid) ON CONFLICT DO NOTHING;
  FOR spec IN SELECT * FROM (VALUES('ebook_recap','eBook Recap',1),('video','Video Explainer',2),('audio','Audio Recap',3),('activity','Activities',4),('assessment','Assessment',5),('resources','Resources',6),('live_session','Live Class',7)) s(kind,title,sort) LOOP
   SELECT id INTO x FROM module_components WHERE module_id=m.id AND type=spec.kind ORDER BY created_at LIMIT 1;
   IF x IS NULL THEN INSERT INTO module_components(module_id,type,title,display_order,required,lesson_id,is_published)
    VALUES(m.id,spec.kind,spec.title,spec.sort,spec.kind<>'resources',CASE WHEN spec.kind='ebook_recap' THEN (SELECT id FROM lessons WHERE module_id=m.id AND is_published ORDER BY display_order LIMIT 1) END,false) RETURNING id INTO x; END IF;
   IF spec.kind='activity' THEN INSERT INTO component_bindings(component_id,cohort_id,assignment_id) SELECT x,cohort_uuid,id FROM assignments WHERE module_id=m.id AND cohort_id=cohort_uuid AND is_published ON CONFLICT DO NOTHING;
   ELSIF spec.kind='assessment' THEN INSERT INTO component_bindings(component_id,cohort_id,assessment_id) SELECT x,cohort_uuid,id FROM assessments WHERE module_id=m.id AND cohort_id=cohort_uuid AND is_published ON CONFLICT DO NOTHING;
   ELSIF spec.kind='live_session' THEN INSERT INTO component_bindings(component_id,cohort_id,live_session_id) SELECT x,cohort_uuid,s.id FROM live_sessions s JOIN live_session_modules sm ON sm.live_session_id=s.id WHERE sm.module_id=m.id AND s.cohort_id=cohort_uuid ON CONFLICT DO NOTHING; END IF;
  END LOOP;
 END LOOP;
 -- Draft templates only. Enabling delivery is a separate deliberate control.
END $$;

CREATE OR REPLACE FUNCTION public.companion_set_mode(cohort_uuid uuid,enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT companion_staff(cohort_uuid) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE cohorts SET metadata=COALESCE(metadata,'{}')||jsonb_build_object('companion_v2',enabled) WHERE id=cohort_uuid;
END $$;
CREATE OR REPLACE FUNCTION public.companion_set_release(cohort_uuid uuid,module_uuid uuid,release_mode text,release_date timestamptz DEFAULT NULL,offset_days integer DEFAULT NULL,confirm_relock boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT companion_staff(cohort_uuid) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF release_mode<>'released' AND NOT confirm_relock AND (EXISTS(SELECT 1 FROM component_progress p JOIN module_components x ON x.id=p.component_id JOIN enrolments e ON e.id=p.enrolment_id WHERE x.module_id=module_uuid AND e.cohort_id=cohort_uuid) OR EXISTS(SELECT 1 FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.module_id=module_uuid AND a.cohort_id=cohort_uuid) OR EXISTS(SELECT 1 FROM assessment_sessions s JOIN assessments a ON a.id=s.assessment_id WHERE a.module_id=module_uuid AND a.cohort_id=cohort_uuid)) THEN RAISE EXCEPTION 'Students have started this module. Confirm relocking; records will be retained.'; END IF;
 INSERT INTO module_releases(module_id,cohort_id,mode,release_at,days_offset) VALUES(module_uuid,cohort_uuid,release_mode,release_date,offset_days)
 ON CONFLICT(module_id,cohort_id) DO UPDATE SET mode=excluded.mode,release_at=excluded.release_at,days_offset=excluded.days_offset;
END $$;

-- All new helper/RPC functions are authenticated-only, never anonymous.
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'companion_%' OR p.proname IN ('is_lesson_released','is_resource_released','validate_companion_reference')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',r.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.signature);
 END LOOP; END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
