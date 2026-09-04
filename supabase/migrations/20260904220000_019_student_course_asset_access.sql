/*
  Allow active students to read private course resources.

  Resource objects use this path:
    <course-id>/<resource-id>/<filename>

  This direct enrolment policy complements the general course-assets policy
  and avoids relying on helper-function context while Storage evaluates RLS.
*/

DROP POLICY IF EXISTS "course_assets_enrolled_resource_read" ON storage.objects;
CREATE POLICY "course_assets_enrolled_resource_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-assets'
    AND EXISTS (
      SELECT 1
      FROM public.resources resource
      JOIN public.cohorts cohort ON cohort.course_id = resource.course_id
      JOIN public.enrolments enrolment ON enrolment.cohort_id = cohort.id
      WHERE resource.course_id::text = (storage.foldername(name))[1]
        AND resource.id::text = (storage.foldername(name))[2]
        AND enrolment.student_id = auth.uid()
        AND enrolment.status = 'active'
        AND (
          (resource.lesson_id IS NULL AND resource.module_id IS NULL)
          OR (
            resource.lesson_id IS NOT NULL
            AND public.is_lesson_released(resource.lesson_id, cohort.id)
          )
          OR (
            resource.lesson_id IS NULL
            AND resource.module_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.lessons lesson
              WHERE lesson.module_id = resource.module_id
                AND public.is_lesson_released(lesson.id, cohort.id)
            )
          )
        )
    )
  );
