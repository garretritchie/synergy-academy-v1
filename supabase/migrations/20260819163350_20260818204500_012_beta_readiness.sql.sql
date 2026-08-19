/*
# Beta readiness: private file storage and tighter role privacy

Creates the two private storage buckets required by course delivery and student
submissions. Object paths are owned by a user or tied to a cohort through the
database, and all access remains subject to RLS.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('course-assets', 'course-assets', false, 262144000, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','application/pdf','text/plain','application/zip','application/epub+zip','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('assignment-submissions', 'assignment-submissions', false, 26214400, ARRAY['application/pdf','text/plain','image/jpeg','image/png','application/zip','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Account deactivation must take effect in the database, not only in the UI.
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(r.name), ARRAY[]::text[])
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.user_id = auth.uid() AND p.is_active;
$$;

CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND r.name = role_name AND p.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_cohort_instructor(cohort_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cohort_instructors ci
    JOIN cohorts co ON co.id = ci.cohort_id
    JOIN profiles p ON p.id = ci.instructor_id
    WHERE ci.cohort_id = cohort_uuid AND ci.instructor_id = auth.uid()
      AND co.is_active AND p.is_active AND public.has_role('instructor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled(cohort_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrolments e
    JOIN cohorts co ON co.id = e.cohort_id
    JOIN profiles p ON p.id = e.student_id
    WHERE e.cohort_id = cohort_uuid AND e.student_id = auth.uid()
      AND e.status = 'active' AND co.is_active AND p.is_active
      AND public.has_role('student')
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_self_lockout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.id = auth.uid() AND OLD.is_active AND NOT NEW.is_active THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_profile_self_lockout ON public.profiles;
CREATE TRIGGER trg_prevent_profile_self_lockout
  BEFORE UPDATE OF is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_self_lockout();

CREATE OR REPLACE FUNCTION public.prevent_admin_role_self_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM roles WHERE id = OLD.role_id AND name = 'administrator'
  ) THEN RAISE EXCEPTION 'You cannot remove your own administrator role'; END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_admin_role_self_removal ON public.user_roles;
CREATE TRIGGER trg_prevent_admin_role_self_removal
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_role_self_removal();

DROP POLICY IF EXISTS "course_assets_admin_instructor_read" ON storage.objects;
CREATE POLICY "course_assets_admin_instructor_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.cohort_instructors ci
        JOIN public.cohorts co ON co.id = ci.cohort_id
        WHERE co.course_id::text = (storage.foldername(name))[1]
          AND public.is_cohort_instructor(co.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.resources r
        JOIN public.cohorts co ON co.course_id = r.course_id
        WHERE r.id::text = (storage.foldername(name))[2]
          AND r.course_id::text = (storage.foldername(name))[1]
          AND public.is_enrolled(co.id)
          AND (
            (r.lesson_id IS NULL AND r.module_id IS NULL)
            OR (r.lesson_id IS NOT NULL AND public.is_lesson_released(r.lesson_id, co.id))
            OR (r.lesson_id IS NULL AND r.module_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.lessons l
              WHERE l.module_id = r.module_id
                AND public.is_lesson_released(l.id, co.id)
            ))
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.lesson_blocks lb
        JOIN public.lessons l ON l.id = lb.lesson_id
        JOIN public.modules m ON m.id = l.module_id
        JOIN public.cohorts co ON co.course_id = m.course_id
        WHERE m.course_id::text = (storage.foldername(name))[1]
          AND (storage.foldername(name))[2] = 'lesson-blocks'
          AND lb.id::text = (storage.foldername(name))[3]
          AND public.is_enrolled(co.id)
          AND public.is_lesson_released(l.id, co.id)
      )
    )
  );

DROP POLICY IF EXISTS "course_assets_admin_write" ON storage.objects;
CREATE POLICY "course_assets_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-assets' AND public.is_admin());

DROP POLICY IF EXISTS "course_assets_admin_update" ON storage.objects;
CREATE POLICY "course_assets_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'course-assets' AND public.is_admin());

DROP POLICY IF EXISTS "course_assets_admin_delete" ON storage.objects;
CREATE POLICY "course_assets_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-assets' AND public.is_admin());

-- Submission objects use: <student-user-id>/<submission-id>/<filename>.
DROP POLICY IF EXISTS "submission_files_read" ON storage.objects;
CREATE POLICY "submission_files_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignment-submissions'
    AND (
      EXISTS (
        SELECT 1 FROM public.submissions own_submission
        WHERE own_submission.id::text = (storage.foldername(name))[2]
          AND own_submission.student_id = auth.uid()
          AND (storage.foldername(name))[1] = auth.uid()::text
          AND public.has_role('student')
      )
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.id::text = (storage.foldername(name))[2]
          AND public.is_cohort_instructor(a.cohort_id)
      )
    )
  );

DROP POLICY IF EXISTS "submission_files_student_insert" ON storage.objects;
CREATE POLICY "submission_files_student_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assignment-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role('student')
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND s.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "submission_files_owner_delete" ON storage.objects;
CREATE POLICY "submission_files_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'assignment-submissions'
    AND (
      (
        (storage.foldername(name))[1] = auth.uid()::text
        AND public.has_role('student')
      )
      OR public.is_admin()
    )
  );

-- Role assignments are private to the account owner and administrators.
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Profiles are not a platform-wide directory. Users can see themselves,
-- administrators can manage everyone, and cohort members can see only the
-- people they legitimately learn with or teach.
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_cohort_visible"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohort_instructors ci
      WHERE ci.instructor_id = profiles.id
        AND (public.is_enrolled(ci.cohort_id) OR public.is_cohort_instructor(ci.cohort_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.enrolments visible_student
      WHERE visible_student.student_id = profiles.id
        AND visible_student.status = 'active'
        AND (
          public.is_cohort_instructor(visible_student.cohort_id)
          OR EXISTS (
            SELECT 1 FROM public.enrolments current_student
            WHERE current_student.cohort_id = visible_student.cohort_id
              AND current_student.student_id = auth.uid()
              AND current_student.status = 'active'
          )
        )
    )
  );

-- Private, one-to-one staff messaging for the beta. Students can contact only
-- instructors assigned to one of their active cohorts; instructors can contact
-- only students in their assigned cohorts. Administrators can contact anyone.
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 5000),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created
  ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_created
  ON public.direct_messages(recipient_id, created_at DESC);

DROP POLICY IF EXISTS "direct_messages_select_participants" ON public.direct_messages;
CREATE POLICY "direct_messages_select_participants"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "direct_messages_insert_allowed" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_allowed"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.cohort_instructors ci
        JOIN public.enrolments e ON e.cohort_id = ci.cohort_id
        WHERE e.status = 'active'
          AND (
            (ci.instructor_id = sender_id AND e.student_id = recipient_id)
            OR (e.student_id = sender_id AND ci.instructor_id = recipient_id)
          )
      )
    )
  );

DROP POLICY IF EXISTS "direct_messages_update_recipient" ON public.direct_messages;
CREATE POLICY "direct_messages_update_recipient"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR public.is_admin())
  WITH CHECK (recipient_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "direct_messages_delete_admin" ON public.direct_messages;
CREATE POLICY "direct_messages_delete_admin"
  ON public.direct_messages FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_direct_message_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.sender_id := OLD.sender_id;
  NEW.recipient_id := OLD.recipient_id;
  NEW.body := OLD.body;
  NEW.created_at := OLD.created_at;
  IF NEW.is_read THEN
    NEW.read_at := COALESCE(OLD.read_at, now());
  ELSE
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_direct_message_content ON public.direct_messages;
CREATE TRIGGER trg_protect_direct_message_content
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.protect_direct_message_content();

CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
  VALUES (
    NEW.recipient_id,
    'message',
    'New private message',
    left(NEW.body, 240),
    '/',
    NEW.id
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message();

-- Academic event notifications are generated in the database so they cannot
-- be skipped by a different client or a future integration.
CREATE OR REPLACE FUNCTION public.notify_cohort_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
    SELECT e.student_id, 'announcement', 'New announcement: ' || NEW.title,
      left(NEW.body, 500), '/student/courses/' || NEW.cohort_id || '/announcements', NEW.id
    FROM enrolments e
    WHERE e.cohort_id = NEW.cohort_id AND e.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_cohort_announcement ON public.announcements;
CREATE TRIGGER trg_notify_cohort_announcement
  AFTER INSERT OR UPDATE OF is_published ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_cohort_announcement();

CREATE OR REPLACE FUNCTION public.notify_assignment_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published AND NEW.cohort_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
    SELECT e.student_id, 'assignment', 'New assignment: ' || NEW.title,
      CASE WHEN NEW.due_date IS NULL THEN NULL ELSE 'Due ' || to_char(NEW.due_date, 'Mon DD, YYYY HH12:MI AM') END,
      '/student/courses/' || NEW.cohort_id || '/assignments', NEW.id
    FROM enrolments e
    WHERE e.cohort_id = NEW.cohort_id AND e.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_assignment_published ON public.assignments;
CREATE TRIGGER trg_notify_assignment_published
  AFTER INSERT OR UPDATE OF is_published ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_published();

CREATE OR REPLACE FUNCTION public.notify_live_session_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
  SELECT e.student_id, 'live_session', 'Live session scheduled: ' || NEW.title,
    to_char(NEW.scheduled_start, 'Mon DD, YYYY HH12:MI AM'),
    '/student/courses/' || NEW.cohort_id || '/live', NEW.id
  FROM enrolments e
  WHERE e.cohort_id = NEW.cohort_id AND e.status = 'active';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_live_session_created ON public.live_sessions;
CREATE TRIGGER trg_notify_live_session_created
  AFTER INSERT ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_live_session_created();

CREATE OR REPLACE FUNCTION public.notify_grade_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE grade_cohort uuid;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.score IS NOT DISTINCT FROM NEW.score
    AND OLD.percentage IS NOT DISTINCT FROM NEW.percentage THEN
    RETURN NEW;
  END IF;
  SELECT cohort_id INTO grade_cohort FROM enrolments WHERE id = NEW.enrolment_id;
  INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
  VALUES (
    NEW.student_id,
    'grade',
    'A grade was posted',
    CASE WHEN NEW.percentage IS NULL THEN 'Open your performance area for details.' ELSE 'Score: ' || round(NEW.percentage, 1) || '%' END,
    '/student/courses/' || grade_cohort || '/performance',
    NEW.id
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_grade_posted ON public.grades;
CREATE TRIGGER trg_notify_grade_posted
  AFTER INSERT OR UPDATE OF score, percentage ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.notify_grade_posted();

CREATE OR REPLACE FUNCTION public.notify_question_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE thread_record discussions%ROWTYPE;
BEGIN
  SELECT * INTO thread_record FROM discussions WHERE id = NEW.discussion_id;
  IF thread_record.is_question AND thread_record.author_id IS NOT NULL
    AND thread_record.author_id <> NEW.author_id THEN
    INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
    VALUES (
      thread_record.author_id,
      'discussion',
      'New reply to: ' || thread_record.title,
      left(NEW.body, 500),
      '/student/courses/' || thread_record.cohort_id || '/qa',
      NEW.discussion_id
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_question_reply ON public.discussion_posts;
CREATE TRIGGER trg_notify_question_reply
  AFTER INSERT ON public.discussion_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_question_reply();

CREATE OR REPLACE FUNCTION public.notify_certificate_issued()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link_url, related_id)
  VALUES (
    NEW.student_id,
    'certificate',
    'Your certificate is ready',
    NEW.title,
    '/student/certificates',
    NEW.id
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_certificate_issued ON public.certificates;
CREATE TRIGGER trg_notify_certificate_issued
  AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_certificate_issued();

-- Keep an immutable administrative trail for the records most likely to need
-- correction or review during the beta.
CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    record_id := OLD.id;
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_values)
    VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, record_id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    record_id := NEW.id;
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, record_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    record_id := NEW.id;
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, new_values)
    VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, record_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_attendance_records ON public.attendance_records;
CREATE TRIGGER trg_audit_attendance_records
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_grades ON public.grades;
CREATE TRIGGER trg_audit_grades
  AFTER INSERT OR UPDATE OR DELETE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_enrolments ON public.enrolments;
CREATE TRIGGER trg_audit_enrolments
  AFTER INSERT OR UPDATE OR DELETE ON public.enrolments
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_certificates ON public.certificates;
CREATE TRIGGER trg_audit_certificates
  AFTER INSERT OR UPDATE OR DELETE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS trg_audit_profile_activation ON public.profiles;
CREATE TRIGGER trg_audit_profile_activation
  AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- Audit events are trigger-authored and immutable through the client API.
DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_update_admin" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_delete_admin" ON public.audit_log;

-- Students must never receive answer keys through the table API. They use the
-- two security-definer RPCs below, which return safe questions and grade on the
-- server. Administrators and assigned instructors retain management access.
DROP POLICY IF EXISTS "assessment_questions_select_visible" ON public.assessment_questions;
CREATE POLICY "assessment_questions_select_staff"
  ON public.assessment_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_questions.assessment_id
        AND (public.is_admin() OR public.is_cohort_instructor(a.cohort_id))
    )
  );

DROP POLICY IF EXISTS "attempts_insert_own_or_instructor_or_admin" ON public.assessment_attempts;
CREATE POLICY "attempts_insert_staff"
  ON public.assessment_attempts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attempts_update_own_or_instructor_or_admin" ON public.assessment_attempts;
CREATE POLICY "attempts_update_staff"
  ON public.assessment_attempts FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

-- Preserve each assignment submission attempt while retaining one current row
-- for gradebook compatibility.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 2
  CHECK (max_attempts BETWEEN 1 AND 20);
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0;
ALTER TABLE public.submission_files
  ADD COLUMN IF NOT EXISTS attempt_number int NOT NULL DEFAULT 1;
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS override_reason text;

CREATE TABLE IF NOT EXISTS public.submission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_number int NOT NULL CHECK (attempt_number > 0),
  content text,
  submitted_at timestamptz NOT NULL,
  is_late boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, attempt_number)
);
ALTER TABLE public.submission_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_attempt
  ON public.submission_versions(submission_id, attempt_number DESC);

-- Students own their submission content but never their grade or feedback.
CREATE OR REPLACE FUNCTION public.protect_submission_academic_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_record assignments%ROWTYPE;
  enrolment_record enrolments%ROWTYPE;
  new_attempt boolean := TG_OP = 'INSERT';
BEGIN
  SELECT * INTO assignment_record FROM assignments WHERE id = NEW.assignment_id;
  IF NOT FOUND OR assignment_record.cohort_id IS NULL THEN
    RAISE EXCEPTION 'Invalid assignment';
  END IF;
  SELECT * INTO enrolment_record FROM enrolments WHERE id = NEW.enrolment_id;
  IF NOT FOUND
    OR enrolment_record.student_id <> NEW.student_id
    OR enrolment_record.cohort_id <> assignment_record.cohort_id THEN
    RAISE EXCEPTION 'Submission does not match the enrolment and assignment';
  END IF;

  IF public.is_admin() OR public.is_cohort_instructor(assignment_record.cohort_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.student_id <> auth.uid() THEN RAISE EXCEPTION 'Invalid submission owner'; END IF;
  IF NOT public.has_role('student') THEN RAISE EXCEPTION 'Student access is inactive'; END IF;
  IF enrolment_record.status <> 'active' OR NOT assignment_record.is_published THEN
    RAISE EXCEPTION 'Assignment is not available';
  END IF;
  IF assignment_record.lesson_id IS NOT NULL
    AND NOT public.is_lesson_released(assignment_record.lesson_id, assignment_record.cohort_id) THEN
    RAISE EXCEPTION 'Assignment is not released';
  END IF;
  IF assignment_record.due_date IS NOT NULL AND now() > assignment_record.due_date
    AND NOT assignment_record.allow_late_submission THEN
    RAISE EXCEPTION 'This assignment no longer accepts submissions';
  END IF;
  IF assignment_record.late_submission_deadline IS NOT NULL
    AND now() > assignment_record.late_submission_deadline THEN
    RAISE EXCEPTION 'The late submission deadline has passed';
  END IF;
  IF NEW.status NOT IN ('draft', 'submitted') THEN RAISE EXCEPTION 'Students may only save or submit work'; END IF;

  IF TG_OP = 'UPDATE' THEN
    new_attempt := NEW.status = 'submitted'
      AND (OLD.status <> 'submitted' OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at);
  END IF;
  IF new_attempt THEN
    IF COALESCE(CASE WHEN TG_OP = 'UPDATE' THEN OLD.attempt_count ELSE 0 END, 0)
      >= assignment_record.max_attempts THEN
      RAISE EXCEPTION 'Maximum submission attempts reached';
    END IF;
    NEW.attempt_count := COALESCE(CASE WHEN TG_OP = 'UPDATE' THEN OLD.attempt_count ELSE 0 END, 0) + 1;
    NEW.submitted_at := now();
  ELSE
    NEW.attempt_count := COALESCE(CASE WHEN TG_OP = 'UPDATE' THEN OLD.attempt_count ELSE 0 END, 0);
  END IF;

  NEW.grade := CASE WHEN TG_OP = 'UPDATE' THEN OLD.grade ELSE NULL END;
  NEW.max_grade := CASE WHEN TG_OP = 'UPDATE' THEN OLD.max_grade ELSE NULL END;
  NEW.feedback := CASE WHEN TG_OP = 'UPDATE' THEN OLD.feedback ELSE NULL END;
  NEW.graded_by := CASE WHEN TG_OP = 'UPDATE' THEN OLD.graded_by ELSE NULL END;
  NEW.graded_at := CASE WHEN TG_OP = 'UPDATE' THEN OLD.graded_at ELSE NULL END;
  NEW.late_penalty_applied := CASE WHEN TG_OP = 'UPDATE' THEN OLD.late_penalty_applied ELSE NULL END;
  NEW.is_late := assignment_record.due_date IS NOT NULL AND now() > assignment_record.due_date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_submission_academic_fields ON public.submissions;
CREATE TRIGGER trg_protect_submission_academic_fields
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_submission_academic_fields();

CREATE OR REPLACE FUNCTION public.snapshot_submission_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted'
    AND (TG_OP = 'INSERT' OR NEW.attempt_count > OLD.attempt_count) THEN
    INSERT INTO submission_versions (
      submission_id, assignment_id, enrolment_id, student_id,
      attempt_number, content, submitted_at, is_late
    ) VALUES (
      NEW.id, NEW.assignment_id, NEW.enrolment_id, NEW.student_id,
      NEW.attempt_count, NEW.content, NEW.submitted_at, NEW.is_late
    ) ON CONFLICT (submission_id, attempt_number) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_snapshot_submission_attempt ON public.submissions;
CREATE TRIGGER trg_snapshot_submission_attempt
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_submission_attempt();

ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS question_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_feedback text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revocation_reason text;

CREATE OR REPLACE FUNCTION public.get_assessment_for_student(assessment_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = assessment_uuid
      AND a.is_published = true
      AND public.is_enrolled(a.cohort_id)
      AND (a.lesson_id IS NULL OR public.is_lesson_released(a.lesson_id, a.cohort_id))
  ) THEN
    RAISE EXCEPTION 'Assessment is not available';
  END IF;

  SELECT jsonb_build_object(
    'id', a.id,
    'title', a.title,
    'description', a.description,
    'instructions', a.instructions,
    'time_limit_minutes', a.time_limit_minutes,
    'max_attempts', a.max_attempts,
    'passing_score', a.passing_score,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id,
        'question_type', q.question_type,
        'question_text', q.question_text,
        'options', q.options,
        'points', q.points,
        'display_order', q.display_order
      ) ORDER BY q.display_order)
      FROM assessment_questions q WHERE q.assessment_id = a.id
    ), '[]'::jsonb)
  ) INTO result
  FROM assessments a WHERE a.id = assessment_uuid;
  RETURN result;
END;
$$;

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
  IF NOT EXISTS (SELECT 1 FROM enrolments WHERE id = enrolment_uuid AND student_id = auth.uid() AND cohort_id = assessment_record.cohort_id AND status = 'active') THEN
    RAISE EXCEPTION 'Invalid enrolment';
  END IF;
  SELECT count(*) INTO attempt_count FROM assessment_attempts
  WHERE assessment_id = assessment_uuid
    AND enrolment_id = enrolment_uuid
    AND status IN ('completed', 'pending_review');
  IF attempt_count >= assessment_record.max_attempts THEN RAISE EXCEPTION 'Maximum attempts reached'; END IF;
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
        OR (q.question_type <> 'multiple_select' AND btrim(COALESCE(submitted_answers ->> q.id::text, '')) = '')
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
  FROM assessment_questions WHERE assessment_id = assessment_uuid;
  SELECT EXISTS (
    SELECT 1 FROM assessment_questions
    WHERE assessment_id = assessment_uuid
      AND question_type IN ('short_answer', 'long_answer')
  ) INTO has_manual_questions;
  percentage_value := CASE WHEN total_points > 0 THEN round((earned_points / total_points) * 100, 2) ELSE 0 END;

  INSERT INTO assessment_attempts (assessment_id, enrolment_id, student_id, completed_at, status, score, max_score, percentage, answers)
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

  IF NOT has_manual_questions THEN
    INSERT INTO grade_categories (cohort_id, name, description, weight, display_order)
    VALUES (assessment_record.cohort_id, 'Quizzes', 'Automatically graded assessments', 0, 20)
    ON CONFLICT (cohort_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO quiz_category_id;

    INSERT INTO grade_items (grade_category_id, assessment_id, name, max_points)
    VALUES (quiz_category_id, assessment_uuid, assessment_record.title, total_points)
    ON CONFLICT (assessment_id) WHERE assessment_id IS NOT NULL
    DO UPDATE SET name = EXCLUDED.name, max_points = EXCLUDED.max_points
    RETURNING id INTO quiz_grade_item_id;

    INSERT INTO grades (grade_item_id, enrolment_id, student_id, score, max_score, percentage, override_reason, graded_at)
    VALUES (quiz_grade_item_id, enrolment_uuid, auth.uid(), earned_points, total_points, percentage_value, 'New assessment attempt', now())
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
    'passed', CASE WHEN has_manual_questions THEN NULL ELSE assessment_record.passing_score IS NULL OR percentage_value >= assessment_record.passing_score END,
    'pending_review', has_manual_questions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_assessment_attempt(
  attempt_uuid uuid,
  manual_scores jsonb,
  feedback_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_record assessment_attempts%ROWTYPE;
  assessment_record assessments%ROWTYPE;
  manual_points numeric := 0;
  final_score numeric := 0;
  final_percentage numeric := 0;
  quiz_category_id uuid;
  quiz_grade_item_id uuid;
BEGIN
  SELECT * INTO attempt_record FROM assessment_attempts WHERE id = attempt_uuid;
  IF NOT FOUND OR attempt_record.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Assessment attempt is not awaiting review';
  END IF;
  SELECT * INTO assessment_record FROM assessments WHERE id = attempt_record.assessment_id;
  IF NOT (public.is_admin() OR public.is_cohort_instructor(assessment_record.cohort_id)) THEN
    RAISE EXCEPTION 'Only an administrator or assigned instructor may review this attempt';
  END IF;
  IF EXISTS (
    SELECT 1 FROM assessment_questions q
    WHERE q.assessment_id = attempt_record.assessment_id
      AND q.question_type IN ('short_answer', 'long_answer')
      AND NOT (manual_scores ? q.id::text)
  ) THEN
    RAISE EXCEPTION 'Every written response requires a score';
  END IF;
  IF EXISTS (
    SELECT 1 FROM assessment_questions q
    WHERE q.assessment_id = attempt_record.assessment_id
      AND q.question_type IN ('short_answer', 'long_answer')
      AND CASE
        WHEN jsonb_typeof(manual_scores -> q.id::text) = 'number' THEN
          (manual_scores ->> q.id::text)::numeric < 0
          OR (manual_scores ->> q.id::text)::numeric > q.points
        ELSE true
      END
  ) THEN
    RAISE EXCEPTION 'Written-response scores must be between zero and the question point value';
  END IF;
  SELECT COALESCE(sum((manual_scores ->> q.id::text)::numeric), 0)
    INTO manual_points
  FROM assessment_questions q
  WHERE q.assessment_id = attempt_record.assessment_id
    AND q.question_type IN ('short_answer', 'long_answer');
  final_score := COALESCE(attempt_record.score, 0) + manual_points;
  final_percentage := CASE WHEN attempt_record.max_score > 0
    THEN round((final_score / attempt_record.max_score) * 100, 2)
    ELSE 0 END;

  UPDATE assessment_attempts SET
    status = 'completed',
    score = final_score,
    percentage = final_percentage,
    question_scores = manual_scores,
    review_feedback = feedback_text,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  WHERE id = attempt_uuid;

  INSERT INTO grade_categories (cohort_id, name, description, weight, display_order)
  VALUES (assessment_record.cohort_id, 'Quizzes', 'Assessment and quiz grades', 0, 20)
  ON CONFLICT (cohort_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO quiz_category_id;
  INSERT INTO grade_items (grade_category_id, assessment_id, name, max_points)
  VALUES (quiz_category_id, assessment_record.id, assessment_record.title, attempt_record.max_score)
  ON CONFLICT (assessment_id) WHERE assessment_id IS NOT NULL
  DO UPDATE SET name = EXCLUDED.name, max_points = EXCLUDED.max_points
  RETURNING id INTO quiz_grade_item_id;
  INSERT INTO grades (
    grade_item_id, enrolment_id, student_id, score, max_score,
    percentage, feedback, override_reason, graded_by, graded_at
  ) VALUES (
    quiz_grade_item_id, attempt_record.enrolment_id, attempt_record.student_id,
    final_score, attempt_record.max_score, final_percentage, feedback_text,
    'Written assessment review', auth.uid(), now()
  )
  ON CONFLICT (grade_item_id, enrolment_id) DO UPDATE SET
    score = EXCLUDED.score,
    max_score = EXCLUDED.max_score,
    percentage = EXCLUDED.percentage,
    feedback = EXCLUDED.feedback,
    override_reason = EXCLUDED.override_reason,
    graded_by = EXCLUDED.graded_by,
    graded_at = EXCLUDED.graded_at;
  RETURN jsonb_build_object(
    'score', final_score,
    'max_score', attempt_record.max_score,
    'percentage', final_percentage,
    'passed', assessment_record.passing_score IS NULL OR final_percentage >= assessment_record.passing_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_assessment_for_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_assessment_attempt(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_assessment_attempt(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assessment_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_assessment_attempt(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_assessment_attempt(uuid, jsonb, text) TO authenticated;

-- One assignment maps to one canonical gradebook item, allowing safe upserts
-- when an instructor grades or revises a submission.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_items_assignment_unique
  ON public.grade_items(assignment_id)
  WHERE assignment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_items_assessment_unique
  ON public.grade_items(assessment_id)
  WHERE assessment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_enrolment_unique
  ON public.certificates(enrolment_id);

-- Complete the previously simplified after_previous release mode.
CREATE OR REPLACE FUNCTION public.is_lesson_released(lesson_uuid uuid, cohort_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  rule_record RECORD;
  cohort_start date;
  target_course_id uuid;
  target_module_id uuid;
  target_order int;
  previous_lesson_id uuid;
  self_paced boolean;
BEGIN
  SELECT co.start_date, co.course_id INTO cohort_start, target_course_id
  FROM cohorts co WHERE co.id = cohort_uuid;
  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT (public.is_admin() OR public.is_cohort_instructor(cohort_uuid) OR public.is_enrolled(cohort_uuid)) THEN
    RETURN false;
  END IF;

  SELECT c.is_self_paced INTO self_paced FROM courses c WHERE c.id = target_course_id;
  IF self_paced THEN RETURN true; END IF;

  SELECT l.module_id, l.display_order INTO target_module_id, target_order
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE l.id = lesson_uuid AND m.course_id = target_course_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO rule_record FROM content_release_rules
  WHERE cohort_id = cohort_uuid AND lesson_id = lesson_uuid LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO rule_record FROM content_release_rules
    WHERE cohort_id = cohort_uuid AND module_id = target_module_id AND lesson_id IS NULL LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN true; END IF;

  CASE rule_record.release_type
    WHEN 'immediate' THEN RETURN true;
    WHEN 'scheduled' THEN RETURN rule_record.release_date IS NOT NULL AND now() >= rule_record.release_date;
    WHEN 'days_from_start' THEN
      RETURN cohort_start IS NULL OR rule_record.days_offset IS NULL OR now() >= cohort_start + make_interval(days => rule_record.days_offset);
    WHEN 'after_previous' THEN
      SELECT l.id INTO previous_lesson_id FROM lessons l
      WHERE l.module_id = target_module_id AND l.display_order < target_order
      ORDER BY l.display_order DESC LIMIT 1;
      IF previous_lesson_id IS NULL THEN RETURN true; END IF;
      RETURN public.is_admin()
        OR public.is_cohort_instructor(cohort_uuid)
        OR EXISTS (
          SELECT 1 FROM progress_records p
          WHERE p.cohort_id = cohort_uuid
            AND p.lesson_id = previous_lesson_id
            AND p.student_id = auth.uid()
            AND p.status = 'completed'
        );
    ELSE RETURN true;
  END CASE;
END;
$$;

-- Completion rules live in courses.metadata.completion. Defaults require all
-- published lessons, assignments, and assessments. Optional numeric
-- min_grade and min_attendance thresholds can be added per course without a
-- schema change.
CREATE OR REPLACE FUNCTION public.get_completion_status(enrolment_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  enrolment_record enrolments%ROWTYPE;
  course_record courses%ROWTYPE;
  required_lessons int := 0;
  completed_lessons int := 0;
  required_assignments int := 0;
  completed_assignments int := 0;
  required_assessments int := 0;
  completed_assessments int := 0;
  attendance_total int := 0;
  attendance_present int := 0;
  attendance_rate numeric := NULL;
  grade_average numeric := NULL;
  require_lessons boolean;
  require_assignments boolean;
  require_assessments boolean;
  minimum_grade numeric;
  minimum_attendance numeric;
  eligible boolean;
BEGIN
  SELECT * INTO enrolment_record FROM enrolments WHERE id = enrolment_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrolment not found'; END IF;
  IF NOT (
    enrolment_record.student_id = auth.uid()
    OR public.is_admin()
    OR public.is_cohort_instructor(enrolment_record.cohort_id)
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT c.* INTO course_record
  FROM courses c JOIN cohorts co ON co.course_id = c.id
  WHERE co.id = enrolment_record.cohort_id;

  require_lessons := COALESCE((course_record.metadata #>> '{completion,require_all_lessons}')::boolean, true);
  require_assignments := COALESCE((course_record.metadata #>> '{completion,require_assignments}')::boolean, true);
  require_assessments := COALESCE((course_record.metadata #>> '{completion,require_assessments}')::boolean, true);
  minimum_grade := NULLIF(course_record.metadata #>> '{completion,min_grade}', '')::numeric;
  minimum_attendance := NULLIF(course_record.metadata #>> '{completion,min_attendance}', '')::numeric;

  SELECT count(*) INTO required_lessons
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE m.course_id = course_record.id AND m.is_published AND l.is_published;
  SELECT count(*) INTO completed_lessons
  FROM progress_records p
  JOIN lessons l ON l.id = p.lesson_id
  JOIN modules m ON m.id = l.module_id
  WHERE p.enrolment_id = enrolment_uuid AND p.status = 'completed'
    AND m.course_id = course_record.id AND m.is_published AND l.is_published;

  SELECT count(*) INTO required_assignments
  FROM assignments WHERE cohort_id = enrolment_record.cohort_id AND is_published;
  SELECT count(DISTINCT assignment_id) INTO completed_assignments
  FROM submissions s JOIN assignments a ON a.id = s.assignment_id
  WHERE s.enrolment_id = enrolment_uuid AND s.status IN ('submitted', 'graded')
    AND a.cohort_id = enrolment_record.cohort_id AND a.is_published;

  SELECT count(*) INTO required_assessments
  FROM assessments WHERE cohort_id = enrolment_record.cohort_id AND is_published;
  SELECT count(DISTINCT assessment_id) INTO completed_assessments
  FROM assessment_attempts aa JOIN assessments a ON a.id = aa.assessment_id
  WHERE aa.enrolment_id = enrolment_uuid AND aa.status = 'completed'
    AND a.cohort_id = enrolment_record.cohort_id AND a.is_published;

  WITH category_scores AS (
    SELECT gc.id, gc.weight, avg(g.percentage) AS category_average
    FROM grades g
    JOIN grade_items gi ON gi.id = g.grade_item_id
    JOIN grade_categories gc ON gc.id = gi.grade_category_id
    WHERE g.enrolment_id = enrolment_uuid AND NOT g.is_excused AND g.percentage IS NOT NULL
    GROUP BY gc.id, gc.weight
  )
  SELECT CASE
    WHEN sum(GREATEST(weight, 0)) > 0
      THEN sum(category_average * GREATEST(weight, 0)) / sum(GREATEST(weight, 0))
    ELSE avg(category_average)
  END INTO grade_average
  FROM category_scores;
  SELECT count(*) FILTER (WHERE status <> 'excused'),
    count(*) FILTER (WHERE status IN ('present', 'late', 'left_early'))
    INTO attendance_total, attendance_present
  FROM attendance_records WHERE enrolment_id = enrolment_uuid;
  attendance_rate := CASE WHEN attendance_total > 0
    THEN round((attendance_present::numeric / attendance_total) * 100, 2)
    ELSE NULL END;

  eligible :=
    (NOT require_lessons OR required_lessons = completed_lessons)
    AND (NOT require_assignments OR required_assignments = completed_assignments)
    AND (NOT require_assessments OR required_assessments = completed_assessments)
    AND (minimum_grade IS NULL OR COALESCE(grade_average, 0) >= minimum_grade)
    AND (minimum_attendance IS NULL OR COALESCE(attendance_rate, 0) >= minimum_attendance);

  RETURN jsonb_build_object(
    'eligible', eligible,
    'lessons', jsonb_build_object('required', required_lessons, 'completed', completed_lessons),
    'assignments', jsonb_build_object('required', required_assignments, 'completed', completed_assignments),
    'assessments', jsonb_build_object('required', required_assessments, 'completed', completed_assessments),
    'grade', grade_average,
    'minimum_grade', minimum_grade,
    'attendance', attendance_rate,
    'minimum_attendance', minimum_attendance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_enrolment(enrolment_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrolment_record enrolments%ROWTYPE;
  course_title text;
  completion jsonb;
  certificate_id uuid;
  certificate_number text;
  calculated_grade numeric;
  letter text;
BEGIN
  SELECT * INTO enrolment_record FROM enrolments WHERE id = enrolment_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrolment not found'; END IF;
  IF NOT (public.is_admin() OR public.is_cohort_instructor(enrolment_record.cohort_id)) THEN
    RAISE EXCEPTION 'Only an administrator or assigned instructor can complete an enrolment';
  END IF;
  completion := public.get_completion_status(enrolment_uuid);
  IF NOT (completion ->> 'eligible')::boolean THEN
    RAISE EXCEPTION 'Completion requirements have not been met';
  END IF;

  calculated_grade := (completion ->> 'grade')::numeric;
  letter := CASE
    WHEN calculated_grade IS NULL THEN NULL
    WHEN calculated_grade >= 90 THEN 'A'
    WHEN calculated_grade >= 80 THEN 'B'
    WHEN calculated_grade >= 70 THEN 'C'
    WHEN calculated_grade >= 60 THEN 'D'
    ELSE 'F'
  END;
  UPDATE enrolments SET status = 'completed', completion_date = now(), final_grade = calculated_grade
  WHERE id = enrolment_uuid;
  SELECT c.title INTO course_title
  FROM cohorts co JOIN courses c ON c.id = co.course_id
  WHERE co.id = enrolment_record.cohort_id;
  certificate_number := public.generate_certificate_number();
  INSERT INTO certificates (
    enrolment_id, student_id, cohort_id, course_id, certificate_number,
    title, issued_date, final_grade, letter_grade, issued_by
  )
  SELECT enrolment_record.id, enrolment_record.student_id, enrolment_record.cohort_id,
    co.course_id, certificate_number, course_title, now(), calculated_grade, letter, auth.uid()
  FROM cohorts co WHERE co.id = enrolment_record.cohort_id
  ON CONFLICT (enrolment_id) DO UPDATE SET
    final_grade = EXCLUDED.final_grade,
    letter_grade = EXCLUDED.letter_grade,
    issued_by = EXCLUDED.issued_by
  RETURNING id INTO certificate_id;
  RETURN completion || jsonb_build_object('certificate_id', certificate_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_completion_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_enrolment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_completion_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_enrolment(uuid) TO authenticated;

-- Enforce cohort membership and drip release at the table API boundary. The
-- client still uses release helpers for its locked-state UI, but direct REST
-- requests cannot read future lesson content or lesson-linked coursework.
DROP POLICY IF EXISTS "modules_select_visible" ON public.modules;
CREATE POLICY "modules_select_visible"
  ON public.modules FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohort_instructors ci
      JOIN public.cohorts co ON co.id = ci.cohort_id
      WHERE ci.instructor_id = auth.uid() AND co.course_id = modules.course_id
        AND public.is_cohort_instructor(co.id)
    )
    OR (
      modules.is_published
      AND EXISTS (
        SELECT 1 FROM public.cohorts co
        WHERE co.course_id = modules.course_id AND public.is_enrolled(co.id)
      )
    )
  );

DROP POLICY IF EXISTS "lessons_select_visible" ON public.lessons;
CREATE POLICY "lessons_select_visible"
  ON public.lessons FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.cohorts co ON co.course_id = m.course_id
      WHERE m.id = lessons.module_id AND public.is_cohort_instructor(co.id)
    )
    OR (
      lessons.is_published
      AND EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.cohorts co ON co.course_id = m.course_id
        WHERE m.id = lessons.module_id
          AND m.is_published
          AND public.is_enrolled(co.id)
          AND public.is_lesson_released(lessons.id, co.id)
      )
    )
  );

DROP POLICY IF EXISTS "lesson_blocks_select_visible" ON public.lesson_blocks;
CREATE POLICY "lesson_blocks_select_visible"
  ON public.lesson_blocks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      LEFT JOIN public.cohorts co ON co.course_id = m.course_id
      WHERE l.id = lesson_blocks.lesson_id
        AND (
          public.is_admin()
          OR public.is_cohort_instructor(co.id)
          OR (
            l.is_published AND m.is_published
            AND public.is_enrolled(co.id)
            AND public.is_lesson_released(l.id, co.id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "assignments_select_visible" ON public.assignments;
CREATE POLICY "assignments_select_visible"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (cohort_id IS NOT NULL AND public.is_cohort_instructor(cohort_id))
    OR (
      cohort_id IS NOT NULL
      AND is_published
      AND public.is_enrolled(cohort_id)
      AND (lesson_id IS NULL OR public.is_lesson_released(lesson_id, cohort_id))
    )
  );

DROP POLICY IF EXISTS "assessments_select_visible" ON public.assessments;
CREATE POLICY "assessments_select_visible"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (
      is_published
      AND public.is_enrolled(cohort_id)
      AND (lesson_id IS NULL OR public.is_lesson_released(lesson_id, cohort_id))
    )
  );

DROP POLICY IF EXISTS "resources_select_visible" ON public.resources;
CREATE POLICY "resources_select_visible"
  ON public.resources FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cohorts co
      WHERE co.course_id = resources.course_id
        AND public.is_cohort_instructor(co.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.cohorts co
      WHERE co.course_id = resources.course_id
        AND public.is_enrolled(co.id)
        AND (
          (resources.lesson_id IS NULL AND resources.module_id IS NULL)
          OR (
            resources.lesson_id IS NOT NULL
            AND public.is_lesson_released(resources.lesson_id, co.id)
          )
          OR (
            resources.lesson_id IS NULL
            AND resources.module_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.lessons l
              WHERE l.module_id = resources.module_id
                AND public.is_lesson_released(l.id, co.id)
            )
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.validate_progress_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrolment_record enrolments%ROWTYPE;
  lesson_course_id uuid;
BEGIN
  SELECT * INTO enrolment_record FROM enrolments WHERE id = NEW.enrolment_id;
  SELECT m.course_id INTO lesson_course_id
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id;
  IF NOT FOUND OR enrolment_record.id IS NULL
    OR enrolment_record.student_id <> NEW.student_id
    OR enrolment_record.cohort_id <> NEW.cohort_id
    OR lesson_course_id <> (SELECT course_id FROM cohorts WHERE id = NEW.cohort_id) THEN
    RAISE EXCEPTION 'Progress record does not match the enrolment, cohort, and lesson';
  END IF;
  IF NEW.status NOT IN ('not_started', 'in_progress', 'completed')
    OR NEW.progress_percent < 0 OR NEW.progress_percent > 100
    OR NEW.time_spent_seconds < 0 THEN
    RAISE EXCEPTION 'Invalid progress values';
  END IF;
  IF NOT (public.is_admin() OR public.is_cohort_instructor(NEW.cohort_id)) THEN
    IF NEW.student_id <> auth.uid() OR enrolment_record.status <> 'active'
      OR NOT public.is_lesson_released(NEW.lesson_id, NEW.cohort_id) THEN
      RAISE EXCEPTION 'Lesson progress is not available';
    END IF;
  END IF;
  IF NEW.status = 'completed' THEN
    NEW.progress_percent := 100;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status = 'not_started' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_progress_record ON public.progress_records;
CREATE TRIGGER trg_validate_progress_record
  BEFORE INSERT OR UPDATE ON public.progress_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_progress_record();

CREATE OR REPLACE FUNCTION public.validate_grade_category_weight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total_weight numeric;
BEGIN
  IF NEW.weight < 0 OR NEW.weight > 100 THEN
    RAISE EXCEPTION 'A grade category weight must be between 0 and 100';
  END IF;
  SELECT COALESCE(sum(weight), 0) INTO total_weight
  FROM grade_categories
  WHERE cohort_id = NEW.cohort_id AND id <> NEW.id;
  IF total_weight + NEW.weight > 100 THEN
    RAISE EXCEPTION 'Grade category weights cannot total more than 100 percent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_grade_category_weight ON public.grade_categories;
CREATE TRIGGER trg_validate_grade_category_weight
  BEFORE INSERT OR UPDATE OF cohort_id, weight ON public.grade_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_grade_category_weight();

CREATE OR REPLACE FUNCTION public.validate_grade_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record grade_items%ROWTYPE;
  category_cohort_id uuid;
  enrolment_record enrolments%ROWTYPE;
  trusted_assessment_grade boolean;
BEGIN
  SELECT * INTO item_record FROM grade_items WHERE id = NEW.grade_item_id;
  SELECT cohort_id INTO category_cohort_id
  FROM grade_categories WHERE id = item_record.grade_category_id;
  SELECT * INTO enrolment_record FROM enrolments WHERE id = NEW.enrolment_id;
  IF item_record.id IS NULL OR category_cohort_id IS NULL OR enrolment_record.id IS NULL
    OR enrolment_record.cohort_id <> category_cohort_id
    OR enrolment_record.student_id <> NEW.student_id THEN
    RAISE EXCEPTION 'Grade does not match the grade item, enrolment, and student';
  END IF;
  trusted_assessment_grade := item_record.assessment_id IS NOT NULL
    AND NEW.student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM assessment_attempts aa
      WHERE aa.assessment_id = item_record.assessment_id
        AND aa.enrolment_id = NEW.enrolment_id
        AND aa.student_id = auth.uid()
        AND aa.status = 'completed'
    );
  IF NOT (
    public.is_admin()
    OR public.is_cohort_instructor(category_cohort_id)
    OR trusted_assessment_grade
  ) THEN
    RAISE EXCEPTION 'Only an administrator or assigned instructor may record grades';
  END IF;
  IF TG_OP = 'UPDATE'
    AND OLD.score IS DISTINCT FROM NEW.score
    AND COALESCE(btrim(NEW.override_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required when changing an existing grade';
  END IF;
  NEW.max_score := COALESCE(NEW.max_score, item_record.max_points);
  IF NOT NEW.is_excused AND (
    NEW.max_score IS NULL OR NEW.max_score <= 0 OR NEW.score IS NULL
    OR NEW.score < 0 OR NEW.score > NEW.max_score
  ) THEN
    RAISE EXCEPTION 'Grade score must be between zero and the maximum score';
  END IF;
  IF NEW.is_excused THEN
    NEW.percentage := NULL;
    NEW.letter_grade := NULL;
  ELSE
    NEW.percentage := round((NEW.score / NEW.max_score) * 100, 2);
  END IF;
  NEW.graded_by := auth.uid();
  NEW.graded_at := COALESCE(NEW.graded_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_grade_record ON public.grades;
CREATE TRIGGER trg_validate_grade_record
  BEFORE INSERT OR UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.validate_grade_record();

CREATE OR REPLACE FUNCTION public.validate_attendance_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_cohort_id uuid;
  enrolment_record enrolments%ROWTYPE;
BEGIN
  SELECT cohort_id INTO session_cohort_id
  FROM live_sessions WHERE id = NEW.live_session_id;
  SELECT * INTO enrolment_record FROM enrolments WHERE id = NEW.enrolment_id;
  IF session_cohort_id IS NULL OR enrolment_record.id IS NULL
    OR enrolment_record.cohort_id <> session_cohort_id
    OR enrolment_record.student_id <> NEW.student_id THEN
    RAISE EXCEPTION 'Attendance does not match the session, enrolment, and student';
  END IF;
  IF NOT (public.is_admin() OR public.is_cohort_instructor(session_cohort_id)) THEN
    RAISE EXCEPTION 'Only an administrator or assigned instructor may record attendance';
  END IF;
  IF NEW.status NOT IN ('present', 'absent', 'late', 'excused', 'left_early', 'not_recorded') THEN
    RAISE EXCEPTION 'Invalid attendance status';
  END IF;
  NEW.recorded_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_attendance_record ON public.attendance_records;
CREATE TRIGGER trg_validate_attendance_record
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_record();

CREATE OR REPLACE FUNCTION public.validate_certificate_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('issued', 'revoked') THEN
    RAISE EXCEPTION 'Invalid certificate status';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
    RAISE EXCEPTION 'A revoked certificate cannot be reinstated';
  END IF;
  IF NEW.status = 'revoked' THEN
    IF btrim(COALESCE(NEW.revocation_reason, '')) = '' THEN
      RAISE EXCEPTION 'A revocation reason is required';
    END IF;
    NEW.revoked_at := COALESCE(NEW.revoked_at, now());
    NEW.revoked_by := COALESCE(NEW.revoked_by, auth.uid());
  ELSE
    NEW.revoked_at := NULL;
    NEW.revoked_by := NULL;
    NEW.revocation_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_certificate_status ON public.certificates;
CREATE TRIGGER trg_validate_certificate_status
  BEFORE INSERT OR UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.validate_certificate_status();

-- Private operational notes support instructor follow-up without exposing
-- staff observations to students or unrelated cohorts.
CREATE TABLE IF NOT EXISTS public.instructor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(btrim(note)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instructor_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_instructor_notes_enrolment
  ON public.instructor_notes(enrolment_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.can_manage_enrolment(enrolment_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM enrolments e
    WHERE e.id = enrolment_uuid AND public.is_cohort_instructor(e.cohort_id)
  );
$$;
DROP POLICY IF EXISTS "instructor_notes_select_staff" ON public.instructor_notes;
CREATE POLICY "instructor_notes_select_staff"
  ON public.instructor_notes FOR SELECT TO authenticated
  USING (public.can_manage_enrolment(enrolment_id));
DROP POLICY IF EXISTS "instructor_notes_insert_staff" ON public.instructor_notes;
CREATE POLICY "instructor_notes_insert_staff"
  ON public.instructor_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_manage_enrolment(enrolment_id));
DROP POLICY IF EXISTS "instructor_notes_update_author_or_admin" ON public.instructor_notes;
CREATE POLICY "instructor_notes_update_author_or_admin"
  ON public.instructor_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "instructor_notes_delete_author_or_admin" ON public.instructor_notes;
CREATE POLICY "instructor_notes_delete_author_or_admin"
  ON public.instructor_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin());
CREATE OR REPLACE FUNCTION public.update_instructor_notes_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.enrolment_id := OLD.enrolment_id;
  NEW.author_id := OLD.author_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_instructor_notes_updated_at ON public.instructor_notes;
CREATE TRIGGER trg_instructor_notes_updated_at
  BEFORE UPDATE ON public.instructor_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_instructor_notes_updated_at();

-- Ownership alone must not bypass account suspension. Keep access to the own
-- profile row so the pending-access screen can explain the state, while all
-- academic and communication records require an active account.
CREATE OR REPLACE FUNCTION public.is_active_account()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_active);
$$;

DROP POLICY IF EXISTS "enrolments_select_own_or_instructor_or_admin" ON public.enrolments;
CREATE POLICY "enrolments_select_own_or_instructor_or_admin"
  ON public.enrolments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (student_id = auth.uid() AND public.has_role('student'))
  );

DROP POLICY IF EXISTS "progress_select_own_or_instructor_or_admin" ON public.progress_records;
CREATE POLICY "progress_select_own_or_instructor_or_admin"
  ON public.progress_records FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (student_id = auth.uid() AND public.has_role('student'))
  );

DROP POLICY IF EXISTS "submissions_select_own_or_instructor_or_admin" ON public.submissions;
CREATE POLICY "submissions_select_own_or_instructor_or_admin"
  ON public.submissions FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND public.has_role('student'))
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "submission_files_select_visible" ON public.submission_files;
CREATE POLICY "submission_files_select_visible"
  ON public.submission_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_files.submission_id
        AND (
          public.is_admin()
          OR public.is_cohort_instructor(a.cohort_id)
          OR (s.student_id = auth.uid() AND public.has_role('student'))
        )
    )
  );

DROP POLICY IF EXISTS "submission_versions_select_visible" ON public.submission_versions;
CREATE POLICY "submission_versions_select_visible"
  ON public.submission_versions FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND public.has_role('student'))
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submission_versions.assignment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "submissions_delete_own_draft_or_admin" ON public.submissions;
CREATE POLICY "submissions_delete_own_draft_or_admin"
  ON public.submissions FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND status = 'draft' AND public.has_role('student'))
  );

DROP POLICY IF EXISTS "submission_files_insert_visible" ON public.submission_files;
CREATE POLICY "submission_files_insert_visible"
  ON public.submission_files FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_files.submission_id
        AND (
          public.is_admin()
          OR public.is_cohort_instructor(a.cohort_id)
          OR (s.student_id = auth.uid() AND public.has_role('student'))
        )
    )
  );
DROP POLICY IF EXISTS "submission_files_delete_visible" ON public.submission_files;
CREATE POLICY "submission_files_delete_visible"
  ON public.submission_files FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_files.submission_id
        AND s.student_id = auth.uid()
        AND s.status = 'draft'
        AND public.has_role('student')
    )
  );

DROP POLICY IF EXISTS "attempts_select_own_or_instructor_or_admin" ON public.assessment_attempts;
CREATE POLICY "attempts_select_own_or_instructor_or_admin"
  ON public.assessment_attempts FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND public.has_role('student'))
    OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_attempts.assessment_id
        AND public.is_cohort_instructor(a.cohort_id)
    )
  );

DROP POLICY IF EXISTS "grades_select_own_or_instructor_or_admin" ON public.grades;
CREATE POLICY "grades_select_own_or_instructor_or_admin"
  ON public.grades FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND public.has_role('student'))
    OR EXISTS (
      SELECT 1 FROM public.grade_items gi
      JOIN public.grade_categories gc ON gc.id = gi.grade_category_id
      WHERE gi.id = grades.grade_item_id
        AND public.is_cohort_instructor(gc.cohort_id)
    )
  );

DROP POLICY IF EXISTS "attendance_select_own_or_instructor_or_admin" ON public.attendance_records;
CREATE POLICY "attendance_select_own_or_instructor_or_admin"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND public.has_role('student'))
    OR EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = attendance_records.live_session_id
        AND public.is_cohort_instructor(ls.cohort_id)
    )
  );

DROP POLICY IF EXISTS "certificates_select_own_or_instructor_or_admin" ON public.certificates;
CREATE POLICY "certificates_select_own_or_instructor_or_admin"
  ON public.certificates FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (student_id = auth.uid() AND public.has_role('student'))
    OR public.is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_account());
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_active_account())
  WITH CHECK (user_id = auth.uid() AND public.is_active_account());
DROP POLICY IF EXISTS "notifications_delete_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_delete_own_or_admin"
  ON public.notifications FOR DELETE TO authenticated
  USING ((user_id = auth.uid() AND public.is_active_account()) OR public.is_admin());

DROP POLICY IF EXISTS "direct_messages_select_participants" ON public.direct_messages;
CREATE POLICY "direct_messages_select_participants"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_active_account() AND (sender_id = auth.uid() OR recipient_id = auth.uid()))
  );
DROP POLICY IF EXISTS "direct_messages_insert_allowed" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_allowed"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_active_account()
    AND EXISTS (SELECT 1 FROM public.profiles recipient WHERE recipient.id = recipient_id AND recipient.is_active)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.cohort_instructors ci
        JOIN public.enrolments e ON e.cohort_id = ci.cohort_id
        WHERE e.status = 'active'
          AND (
            (ci.instructor_id = sender_id AND e.student_id = recipient_id AND public.has_role('instructor'))
            OR (e.student_id = sender_id AND ci.instructor_id = recipient_id AND public.has_role('student'))
          )
      )
    )
  );
DROP POLICY IF EXISTS "direct_messages_update_recipient" ON public.direct_messages;
CREATE POLICY "direct_messages_update_recipient"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (public.is_admin() OR (recipient_id = auth.uid() AND public.is_active_account()))
  WITH CHECK (public.is_admin() OR (recipient_id = auth.uid() AND public.is_active_account()));

DROP POLICY IF EXISTS "discussions_update_author_or_instructor_or_admin" ON public.discussions;
CREATE POLICY "discussions_update_author_or_instructor_or_admin"
  ON public.discussions FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (author_id = auth.uid() AND public.is_enrolled(cohort_id))
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (author_id = auth.uid() AND public.is_enrolled(cohort_id))
  );
DROP POLICY IF EXISTS "discussions_delete_author_or_instructor_or_admin" ON public.discussions;
CREATE POLICY "discussions_delete_author_or_instructor_or_admin"
  ON public.discussions FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.is_cohort_instructor(cohort_id)
    OR (author_id = auth.uid() AND public.is_enrolled(cohort_id))
  );

DROP POLICY IF EXISTS "discussion_posts_update_author_or_instructor_or_admin" ON public.discussion_posts;
CREATE POLICY "discussion_posts_update_author_or_instructor_or_admin"
  ON public.discussion_posts FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND (
          public.is_cohort_instructor(d.cohort_id)
          OR (discussion_posts.author_id = auth.uid() AND public.is_enrolled(d.cohort_id))
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND (
          public.is_cohort_instructor(d.cohort_id)
          OR (discussion_posts.author_id = auth.uid() AND public.is_enrolled(d.cohort_id))
        )
    )
  );
DROP POLICY IF EXISTS "discussion_posts_delete_author_or_instructor_or_admin" ON public.discussion_posts;
CREATE POLICY "discussion_posts_delete_author_or_instructor_or_admin"
  ON public.discussion_posts FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = discussion_posts.discussion_id
        AND (
          public.is_cohort_instructor(d.cohort_id)
          OR (discussion_posts.author_id = auth.uid() AND public.is_enrolled(d.cohort_id))
        )
    )
  );

-- Public verification codes must not be enumerable. Existing sequential
-- certificates remain valid, while newly issued records use a random suffix.
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE candidate text;
BEGIN
  LOOP
    candidate := 'SYN-' || EXTRACT(YEAR FROM now())::int || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM certificates WHERE certificate_number = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_certificate(certificate_code text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'certificate_number', cert.certificate_number,
    'student_name', COALESCE(
      NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
      'Synergy Academy learner'
    ),
    'course_title', c.title,
    'issued_date', cert.issued_date,
    'status', cert.status,
    'revocation_reason', CASE WHEN cert.status = 'revoked' THEN cert.revocation_reason ELSE NULL END
  )
  FROM certificates cert
  JOIN profiles p ON p.id = cert.student_id
  JOIN courses c ON c.id = cert.course_id
  WHERE cert.certificate_number = certificate_code
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;