/*
# Restrict SECURITY DEFINER Function Execution to Authenticated Role

## Purpose
Revokes EXECUTE permission from the `anon` role on all SECURITY DEFINER helper functions so unauthenticated users cannot call them. Since this application has a sign-in screen, only authenticated users should be able to invoke these functions.

## Changes
For each of the following functions, `REVOKE EXECUTE FROM anon` and `GRANT EXECUTE TO authenticated`:
- get_user_roles()
- has_role(text)
- is_admin()
- is_instructor()
- is_student()
- is_cohort_instructor(uuid)
- is_enrolled(uuid)
- get_student_enrolment_id(uuid)
- is_lesson_released(uuid, uuid)
- get_released_lesson_ids(uuid)
- generate_certificate_number()
- handle_new_user() (trigger function — already restricted to postgres)
- update_*_updated_at() (trigger functions — already restricted to postgres)

## Security
- The anon role can no longer execute any SECURITY DEFINER function.
- The authenticated role retains EXECUTE on all user-facing helper functions.
- Trigger functions (handle_new_user, update_*_updated_at) are only executable by their table owner / postgres — no change needed.
*/

REVOKE EXECUTE ON FUNCTION public.get_user_roles() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_instructor() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_instructor() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_student() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_cohort_instructor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_cohort_instructor(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_enrolled(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_student_enrolment_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_enrolment_id(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_lesson_released(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_lesson_released(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_released_lesson_ids(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_released_lesson_ids(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_certificate_number() FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_certificate_number() TO authenticated;