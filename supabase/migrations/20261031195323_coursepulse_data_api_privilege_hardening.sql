-- Prevent accidental Data API exposure for future public-schema objects.
-- New public tables/functions must receive explicit GRANTs in their migrations.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Remove inherited broad table grants from the existing app tables.
-- The grants below mirror the app's RLS and column-level write model.
REVOKE ALL PRIVILEGES ON TABLE
  public.users,
  public.courses,
  public.feedback,
  public.responses
FROM anon, authenticated;

GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (full_name) ON public.users TO authenticated;

GRANT SELECT ON public.courses TO authenticated;
GRANT INSERT (instructor_id, title, description, status) ON public.courses TO authenticated;
GRANT UPDATE (title, description, status) ON public.courses TO authenticated;
GRANT DELETE ON public.courses TO authenticated;

GRANT SELECT ON public.feedback TO authenticated;
GRANT INSERT (course_id, created_by, title, description, form_schema, is_open, retention_days) ON public.feedback TO authenticated;
GRANT UPDATE (title, description, form_schema, is_open, retention_days) ON public.feedback TO authenticated;
GRANT DELETE ON public.feedback TO authenticated;

GRANT SELECT, INSERT ON public.responses TO authenticated;
