/*
  Certificate directory scaling

  Keeps the administrator certificate directory responsive as issued records
  grow into the thousands by supporting filtered date/status/course scans and
  contains-search across certificate codes, learner names, and course titles.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_certificates_issued_date_id
  ON public.certificates(issued_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_status_issued_date
  ON public.certificates(status, issued_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_course_issued_date
  ON public.certificates(course_id, issued_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_certificates_student_name_search
  ON public.certificates USING gin (student_name_snapshot extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_certificates_course_title_search
  ON public.certificates USING gin (course_title_snapshot extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_certificates_number_search
  ON public.certificates USING gin (certificate_number extensions.gin_trgm_ops);
