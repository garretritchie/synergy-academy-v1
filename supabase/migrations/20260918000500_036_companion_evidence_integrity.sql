BEGIN;
-- Finalized evidence must refer to an actual object belonging to this submission.
-- Client-supplied file sizes cannot satisfy the requirement by themselves.
CREATE FUNCTION public.companion_validate_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s submissions%ROWTYPE; a assignments%ROWTYPE; object_size bigint; extension text;
BEGIN
 SELECT * INTO s FROM submissions WHERE id=NEW.submission_id FOR UPDATE;
 SELECT * INTO a FROM assignments WHERE id=s.assignment_id;
 IF NOT companion_enabled(a.cohort_id) THEN RETURN NEW; END IF;
 IF NOT companion_module_open(a.module_id,a.cohort_id) THEN RAISE EXCEPTION 'This module is not released'; END IF;
 IF NOT a.allow_file_upload THEN RAISE EXCEPTION 'Uploads are not enabled for this activity'; END IF;
 IF split_part(NEW.file_path,'/',1)<>s.student_id::text OR split_part(NEW.file_path,'/',2)<>s.id::text THEN RAISE EXCEPTION 'Evidence path does not belong to this submission'; END IF;
 SELECT (metadata->>'size')::bigint INTO object_size FROM storage.objects WHERE bucket_id='assignment-submissions' AND name=NEW.file_path;
 IF object_size IS NULL OR object_size<=0 THEN RAISE EXCEPTION 'Upload the evidence file before attaching it'; END IF;
 IF object_size>COALESCE(a.max_file_size_mb,25)::bigint*1048576 THEN RAISE EXCEPTION 'Evidence file exceeds the activity size limit'; END IF;
 extension:=lower(substring(NEW.file_path from '\.([^.]+)$'));
 IF cardinality(a.allowed_file_types)>0 AND NOT COALESCE(extension=ANY(a.allowed_file_types),false) THEN RAISE EXCEPTION 'Evidence file type is not allowed'; END IF;
 NEW.file_size:=object_size;
 RETURN NEW;
END $$;
CREATE TRIGGER companion_validate_evidence BEFORE INSERT OR UPDATE ON submission_files FOR EACH ROW EXECUTE FUNCTION companion_validate_evidence();
REVOKE ALL ON FUNCTION public.companion_validate_evidence() FROM PUBLIC,anon,authenticated;
-- Do not allow a deleted storage object or a fabricated metadata row to finalize required work.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.companion_submission_guard()'::regprocedure);
 d:=replace(d,'SELECT 1 FROM submission_files WHERE submission_id=NEW.id','SELECT 1 FROM submission_files f JOIN storage.objects o ON o.bucket_id=''assignment-submissions'' AND o.name=f.file_path WHERE f.submission_id=NEW.id');
 EXECUTE d;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
