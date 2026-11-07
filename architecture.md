# CoursePulse Architecture

## System overview
- **Web:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Lucide.
- **Auth/data:** Supabase Auth + Postgres. Server routes use request-scoped Supabase clients so RLS is evaluated for the real user.
- **Validation:** Zod schemas shared by route handlers and UI flows.
- **Reporting:** database aggregate RPCs; CSV/XLSX/PDF export handlers.
- **Hosting:** Vercel; managed Supabase Postgres.

## Request path
Browser -> Next middleware (origin checks on API mutations and Supabase session refresh) -> route handler -> authenticate current user -> role/resource authorization -> Zod validation -> request-scoped Supabase/RPC -> Postgres RLS/constraints -> safe response. Mutating routes use a database-backed per-user rate limiter where wired.

## Privacy boundary
`private.feedback_eligibility` maintains the student/form eligibility and one-time-submission state. `public.submit_anonymous_feedback` validates the signed-in student, enrollment, publication state, deadline, question schema and answers, then records answer JSON in `public.anonymous_submissions` without a student identifier. Instructors receive aggregate RPC outputs only; groups under five responses are suppressed. The legacy `public.responses` table still contains `student_id` and prior answer records; do not represent historical records as retroactively anonymous.

## Core entities
User/profile, department, semester, course, course enrollment, instructor assignment, feedback form/schema, private eligibility ledger, anonymous submission, legacy response, audit log, deletion request, API rate-limit state. Foreign keys, row-level policies, and private helper functions implement database-side access boundaries.

## Role-specific access
- Student form eligibility and responses are evaluated in Postgres.
- Instructor analytics queries are scoped to instructor/course assignments and aggregate-only functions.
- Admin operations are guarded by both application role and Supabase MFA AAL2, then rechecked by database SECURITY DEFINER helpers.

## Deployment and migration notes
The live database migration history has evolved beyond the migration files currently present in this repository. Do not run `prisma migrate deploy`, `supabase db push`, or destructive schema changes until a fresh schema dump, local migration reconciliation, backup, and reviewed forward-only migration plan exist. Use the existing live RPC contracts as the integration boundary.

## Current limitations
Chart coverage, course comparison UI, full feedback form lifecycle (edit/reorder/delete), verified institutional/legal policy details, a third-party analytics provider, and end-to-end/security/performance certification remain unfinished or configuration-dependent.
