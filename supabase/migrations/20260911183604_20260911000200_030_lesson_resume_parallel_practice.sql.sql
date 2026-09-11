-- Resume bookmarks are private to each student and cohort. No grades are changed.

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
     OR (a.assessment_type<>'practice' OR m.display_order<target.display_order) AND EXISTS(SELECT 1 FROM assignments t WHERE t.module_id=m.id AND t.cohort_id=a.cohort_id AND t.assignment_type='activity' AND t.is_published AND NOT EXISTS(SELECT 1 FROM submissions s WHERE s.assignment_id=t.id AND s.student_id=auth.uid() AND s.status IN ('submitted','graded')))
     OR EXISTS(SELECT 1 FROM assessments q WHERE q.module_id=m.id AND q.cohort_id=a.cohort_id AND q.is_published AND q.assessment_type='practice' AND q.id<>a.id AND (a.assessment_type<>'practice' OR m.display_order<target.display_order) AND NOT EXISTS(SELECT 1 FROM assessment_attempts x WHERE x.assessment_id=q.id AND x.student_id=auth.uid() AND x.status='completed' AND x.percentage>=COALESCE(q.passing_score,0)))
   )
 )
 );
$$;


CREATE TABLE public.lesson_bookmarks (
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 screen_index integer NOT NULL CHECK(screen_index BETWEEN 0 AND 100000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,cohort_id,lesson_id)
);
ALTER TABLE public.lesson_bookmarks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_bookmarks FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.lesson_bookmarks TO authenticated;
CREATE POLICY bookmark_read ON public.lesson_bookmarks FOR SELECT TO authenticated
USING(student_id=auth.uid() AND public.is_enrolled(cohort_id));
CREATE POLICY bookmark_insert ON public.lesson_bookmarks FOR INSERT TO authenticated
WITH CHECK(student_id=auth.uid() AND public.is_enrolled(cohort_id) AND EXISTS(
 SELECT 1 FROM public.lessons l JOIN public.modules m ON m.id=l.module_id
 JOIN public.cohorts c ON c.course_id=m.course_id
 WHERE l.id=lesson_id AND c.id=cohort_id AND l.is_published AND m.is_published
 AND public.is_lesson_released(l.id,c.id)
));
CREATE POLICY bookmark_update ON public.lesson_bookmarks FOR UPDATE TO authenticated
USING(student_id=auth.uid() AND public.is_enrolled(cohort_id))
WITH CHECK(student_id=auth.uid() AND public.is_enrolled(cohort_id) AND EXISTS(
 SELECT 1 FROM public.lessons l JOIN public.modules m ON m.id=l.module_id
 JOIN public.cohorts c ON c.course_id=m.course_id
 WHERE l.id=lesson_id AND c.id=cohort_id AND l.is_published AND m.is_published
 AND public.is_lesson_released(l.id,c.id)
));
NOTIFY pgrst,'reload schema';