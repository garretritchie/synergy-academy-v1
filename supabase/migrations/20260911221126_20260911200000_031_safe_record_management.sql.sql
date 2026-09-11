-- Safe deletion of accidental records, and administrator-only account activation.
-- No existing data is deleted by this migration.

CREATE OR REPLACE FUNCTION public.guard_profile_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active AND auth.uid() IS NOT NULL THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only an active administrator can enable or disable users';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot disable your own administrator account';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_profile_activation BEFORE UPDATE OF is_active ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_activation();

CREATE OR REPLACE FUNCTION public.preview_record_deletion(record_table text, record_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  target jsonb;
  dependency record;
  linked_count bigint;
  blockers jsonb := '[]'::jsonb;
  safe_children text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_account() THEN
    RAISE EXCEPTION 'An active staff account is required';
  END IF;
  IF record_table IS NULL OR record_table NOT IN
    ('live_sessions','assignments','assessments','announcements','cohorts','course_categories') THEN
    RAISE EXCEPTION 'This record type does not support safe deletion';
  END IF;
  -- Parent lock prevents FK-backed student work arriving between check and delete.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 FOR UPDATE',record_table)
    INTO target USING record_id;
  IF target IS NULL THEN RAISE EXCEPTION 'Record no longer exists. Refresh the list.'; END IF;
  IF NOT public.is_admin() AND NOT (
    record_table IN ('live_sessions','assignments','assessments','announcements')
    AND public.is_cohort_instructor((target->>'cohort_id')::uuid)
  ) THEN RAISE EXCEPTION 'Only an administrator or assigned instructor can delete this record'; END IF;
  safe_children := CASE record_table
    WHEN 'live_sessions' THEN ARRAY['live_session_modules','live_session_lessons','live_session_resources']
    WHEN 'assessments' THEN ARRAY['assessment_questions']
    WHEN 'cohorts' THEN ARRAY['cohort_instructors']
    ELSE ARRAY[]::text[] END;
  -- Discover dependencies rather than relying on a stale list of student tables.
  -- SET NULL relationships are protected too; history must keep its context.
  FOR dependency IN
    SELECT c.conrelid::regclass AS relation, ns.nspname AS schema_name,
      t.relname AS table_name, a.attname AS column_name, cardinality(c.conkey) AS key_count
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid=to_regclass(format('public.%I',record_table))
  LOOP
    IF dependency.schema_name='public' AND dependency.table_name=ANY(safe_children) THEN CONTINUE; END IF;
    IF dependency.key_count <> 1 THEN RAISE EXCEPTION 'This record has a dependency requiring administrator review'; END IF;
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I=$1',dependency.schema_name,dependency.table_name,dependency.column_name)
      INTO linked_count USING record_id;
    IF linked_count > 0 THEN
      blockers := blockers || jsonb_build_array(jsonb_build_object(
        'source',replace(dependency.table_name,'_',' '),'count',linked_count));
    END IF;
  END LOOP;
  IF record_table IN ('assignments','assessments') THEN
    SELECT count(*) INTO linked_count FROM public.resources
      WHERE release_checkpoint_id=record_id AND release_mode='checkpoint'
      AND release_checkpoint_type=CASE record_table WHEN 'assignments' THEN 'activity' ELSE 'assessment' END;
    IF linked_count > 0 THEN
      blockers := blockers || jsonb_build_array(jsonb_build_object('source','resource release checkpoints','count',linked_count));
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed',jsonb_array_length(blockers)=0,
    'title',coalesce(target->>'title',target->>'name'),'dependencies',blockers);
END;
$$;

-- These polymorphic references have no FK. Lock the checkpoint row like an FK
-- when writing them, so they cannot race a deletion and strand a resource.
CREATE OR REPLACE FUNCTION public.lock_resource_checkpoint_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.release_mode='checkpoint' AND NEW.release_checkpoint_type IN ('activity','assessment') THEN
    IF NEW.release_checkpoint_type='activity' THEN
      PERFORM id FROM public.assignments WHERE id=NEW.release_checkpoint_id FOR KEY SHARE;
    ELSE
      PERFORM id FROM public.assessments WHERE id=NEW.release_checkpoint_id FOR KEY SHARE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'The release checkpoint no longer exists'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_lock_resource_checkpoint_record BEFORE INSERT OR UPDATE OF release_mode,release_checkpoint_type,release_checkpoint_id
ON public.resources FOR EACH ROW EXECUTE FUNCTION public.lock_resource_checkpoint_record();

CREATE OR REPLACE FUNCTION public.guard_staff_record_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE review jsonb;
BEGIN
  review := public.preview_record_deletion(TG_TABLE_NAME,OLD.id);
  IF NOT (review->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Deletion blocked: linked records or student history must be preserved. Cancel, unpublish, or deactivate this record instead.';
  END IF;
  RETURN OLD;
END;
$$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['live_sessions','assignments','assessments','announcements','cohorts','course_categories'] LOOP
    EXECUTE format('CREATE TRIGGER trg_guard_staff_record_deletion BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_staff_record_deletion()',table_name);
    EXECUTE format('CREATE TRIGGER trg_audit_staff_record_deletion AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change()',table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.delete_staff_record(record_table text, record_id uuid, expected_title text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE review jsonb;
BEGIN
  review := public.preview_record_deletion(record_table,record_id);
  IF expected_title IS NOT DISTINCT FROM review->>'title' THEN
    RAISE EXCEPTION 'This record changed. Close the dialog and review it again.';
  END IF;
  IF NOT (review->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Deletion blocked: linked records or student history must be preserved.';
  END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id=$1',record_table) USING record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_record_deletion(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_staff_record(text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_staff_record_deletion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_resource_checkpoint_record() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_record_deletion(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_record(text,uuid,text) TO authenticated;