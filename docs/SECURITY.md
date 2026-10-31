# CoursePulse security model

## Identity and roles

Supabase Auth owns credentials. `public.users` is a profile table created by an `auth.users` trigger. New users always receive `STUDENT`; role assignment is an administrative SQL operation and is not exposed by the application. Profile self-updates are limited by column grants to `full_name`.

## RLS boundaries

- Students can read only their own profile and submitted responses. They can view published courses and open feedback forms, and can submit at most one response per form.
- Instructors can select and mutate only courses they own. Feedback forms are scoped through the owned course. There is intentionally no instructor `SELECT` policy on `public.responses`.
- Admins can manage all courses and read responses for support/compliance purposes.
- `private` contains `SECURITY DEFINER` authorization and aggregation helpers. It is not intended to be exposed through the Supabase Data API. Exposed `public.get_instructor_aggregates()` is a `SECURITY INVOKER` wrapper.

## Export privacy

All instructor exports call the aggregate RPC. Groups with fewer than five unique responses are omitted. Text/textarea question values are never returned by the RPC. CSV output quotes all cells and prefixes formula-leading values. XLSX and PDF are generated from the same aggregate projection. Never add a raw response query to export code.

## Retention

Every feedback form has `retention_days` constrained to 30-730 days. Supabase `pg_cron` runs `public.cleanup_expired_responses()` daily at 20:17 UTC. Deleting a feedback form or course cascades to its responses. Review the Supabase Cron job history periodically.

## Operational requirements

- Keep `DATABASE_URL` and `DIRECT_URL` server-only. Never add `NEXT_PUBLIC_` prefixes to them.
- The Supabase publishable/anon key is designed for public clients only when paired with RLS. Never expose service-role or secret keys.
- Configure Supabase Auth redirect URLs for the production domain.
- Enforce MFA for admins in the Supabase Auth project settings.
- Use a strong database password and SSL (`sslmode=require`).
- Keep retention days no longer than the actual educational purpose requires.
