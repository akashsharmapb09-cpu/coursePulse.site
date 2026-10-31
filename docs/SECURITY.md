# CoursePulse security model

## Identity and roles

Supabase Auth owns credentials. `public.users` is a profile table created by an `auth.users` trigger. New users always receive `STUDENT`; role assignment is an administrative SQL operation and is not exposed by the application. Profile self-updates are limited by column grants to `full_name`.

## RLS boundaries

- Students can read only their own profile and legacy response rows. They can view published courses and open feedback forms. New submissions consume a private one-time eligibility record and write answers to `public.anonymous_submissions` without a student ID or eligibility reference.
- Instructors can select and mutate only courses they own. Feedback forms are scoped through the owned course. They cannot select raw rows from either response store.
- Admins can manage workspace courses but cannot select raw response rows. Student eligibility is held in `private.feedback_eligibility`; the private ledger and answer store are not readable through the Data API.
- The submission RPC validates the form and all answer values at the database boundary, atomically consumes eligibility, and raises a duplicate-submission error when the same student attempts a second submission.
- `private` contains `SECURITY DEFINER` authorization and aggregation helpers. It is not intended to be exposed through the Supabase Data API. Exposed `public.get_instructor_aggregates()` is a `SECURITY INVOKER` wrapper.

## Export privacy

All instructor/admin exports call the aggregate RPC, which unions legacy and anonymous answer stores. Groups with fewer than five unique responses are omitted. Text/textarea question values are never returned by the RPC. CSV output quotes all cells and prefixes formula-leading values. XLSX and PDF are generated from the same aggregate projection. Never add a raw response query to export code.

## Retention

Every feedback form has `retention_days` constrained to 30-730 days. Supabase `pg_cron` runs `public.cleanup_expired_responses()` daily at 20:17 UTC. It removes expired legacy answers, anonymous answers and old rate-limit buckets. Deleting a feedback form or course cascades to its answer rows and eligibility ledger. Review the Supabase Cron job history periodically.

## Mutation protections

- Authenticated course creation, feedback form creation and response submission enforce same-origin Origin/Referer checks.
- A private Postgres rate-limit ledger enforces per-user action windows; the API fails closed if the rate-limit RPC is unavailable.
- The Next.js response headers include a baseline CSP, frame denial, MIME sniffing protection, referrer policy and permissions policy. The current CSP still permits inline/eval scripts for Next.js compatibility; nonce-based strict CSP remains future work.
- Supabase Auth leaked-password protection is currently reported disabled by the security advisor and must be enabled in the Auth dashboard.

## Operational requirements

- Keep `DATABASE_URL` and `DIRECT_URL` server-only. Never add `NEXT_PUBLIC_` prefixes to them.
- The Supabase publishable/anon key is designed for public clients only when paired with RLS. Never expose service-role or secret keys.
- Configure Supabase Auth redirect URLs for the production domain.
- Enforce MFA for admins in the Supabase Auth project settings and verify the assurance level on privileged actions.
- Use a strong database password and SSL (`sslmode=require`).
- Keep retention days no longer than the actual educational purpose requires.
