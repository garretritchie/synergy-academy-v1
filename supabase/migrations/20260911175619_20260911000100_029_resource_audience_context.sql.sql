-- A program resource has no cohort_id and automatically serves future cohorts.
-- A cohort resource is limited to that cohort. Reuse the existing release rules.

CREATE OR REPLACE FUNCTION public.get_available_course_resources(cohort_uuid uuid)
RETURNS SETOF public.resources
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT r.*
  FROM public.resources r
  JOIN public.cohorts c ON c.course_id=r.course_id
  WHERE c.id=cohort_uuid
    AND (r.cohort_id IS NULL OR r.cohort_id=c.id)
    AND (public.is_admin() OR public.is_cohort_instructor(c.id)
      OR (public.has_role('student') AND public.is_enrolled(c.id)))
    AND public.is_resource_released(r.id,c.id,auth.uid())
  ORDER BY r.display_order,r.created_at,r.id;
$$;
REVOKE ALL ON FUNCTION public.get_available_course_resources(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_course_resources(uuid) TO authenticated;

DROP POLICY IF EXISTS resources_select_visible ON public.resources;
CREATE POLICY resources_select_visible ON public.resources FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.cohorts c WHERE c.course_id=resources.course_id
      AND (resources.cohort_id IS NULL OR resources.cohort_id=c.id)
      AND public.is_cohort_instructor(c.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.cohorts c WHERE c.course_id=resources.course_id
      AND (resources.cohort_id IS NULL OR resources.cohort_id=c.id)
      AND public.has_role('student') AND public.is_enrolled(c.id)
      AND public.is_resource_released(resources.id,c.id,auth.uid())
  )
);

COMMENT ON COLUMN public.resources.cohort_id IS
  'NULL: shared program library for all current and future enrolled cohorts. Non-NULL: this cohort only.';
NOTIFY pgrst, 'reload schema';