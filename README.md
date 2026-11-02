# CoursePulse

## Project guides

- PRD.md — product requirements.
- docs/architecture.md — architecture and privacy model.
- docs/SECURITY.md — security controls and open risks.
- docs/API.md — API route reference.
- docs/TESTING.md — automated/manual QA and release gates.
- docs/SEEDING.md — isolated test-data strategy.
- docs/plan.md — current implementation plan.
- docs/MASTER-PROMPT-AUDIT.md — evidence-based compliance status.


CoursePulse is a role-isolated course feedback application built with Next.js App Router, TypeScript, Supabase Auth/Postgres, Prisma schema tooling, and aggregate-only reporting.

## Stack

- Next.js `15.5.28` (patched Maintenance LTS), React `19.1.10`, TypeScript
- Supabase Auth + Postgres RLS (`@supabase/ssr`, `@supabase/supabase-js`)
- Prisma schema/client generation for typed Postgres models
- Zod validation, ExcelJS (`.xlsx`), PDFKit (PDF), CSV

The requested Next.js 14 baseline was intentionally moved to 15.5.28 because Next.js 14 has no patched release for the critical October 2026 advisories. The Next.js security notice identifies 15.5.28 as patched: https://nextjs.org/blog/nextjs-security-update-october-14-2026. A national cyber authority independently lists versions 10.x-15.x before 15.5.28 as affected: https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2026-148/.

## Quick start

```bash
cp .env.example .env.local
# Fill the values from Supabase Dashboard > Project Settings > API and Database.
npm install
npx prisma generate
npx prisma validate
npm run typecheck
npm test
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or a Supabase publishable key) for Auth/Data API. Set `DATABASE_URL` and `DIRECT_URL` to the project's Postgres connection strings for Prisma tooling. The web application uses the signed-in Supabase session client for request-scoped data access so RLS is evaluated as the real user, rather than using a service-role client for ordinary queries.

## Database project

The migrations under `supabase/migrations/` correspond to the applied migrations on Supabase project `fwmovyitmtpnwhqmvrgh`. The live database has `users`, `courses`, `feedback`, legacy `responses`, and `anonymous_submissions`. All exposed application tables have RLS enabled. New feedback is written to `anonymous_submissions`; one-time eligibility is held separately in the unexposed `private.feedback_eligibility` table. Students can view pending forms only for courses where an administrator has enrolled them; closed completed forms remain visible only to the student whose private eligibility record was consumed. Optional form deadlines are enforced by a database trigger at submission time. Instructors can edit form questions/content, set deadlines, open/close forms, and edit/archive/republish their courses. Its migration history is:

- `20261031162341_coursepulse_initial_schema_rls_aggregates_retention`
- `20261031162429_coursepulse_fix_numeric_aggregation`
- `20261031162901_coursepulse_private_helpers_cron_hardening`
- `20261031163820_coursepulse_feedback_creator_index`
- `20261031195323_coursepulse_data_api_privilege_hardening`
- `20261031202355_coursepulse_anonymous_feedback_storage`
- `20261031202452_coursepulse_anonymous_storage_policy_hardening`
- `20261031202848_coursepulse_mutation_rate_limits`
- `20261031203740_coursepulse_academic_admin_lifecycle` (duplicate history entry from initial management apply)
- `20261031203913_coursepulse_academic_admin_lifecycle`
- `20261031203917_coursepulse_assignment_course_policies`
- `20261031203934_coursepulse_admin_audit_rpc`
- `20261031204219_coursepulse_student_feedback_progress`
- `20261031204820_coursepulse_admin_fk_indexes`
- `20261031204847_coursepulse_rls_policy_optimization`
- `20261031205554_coursepulse_feedback_deadlines_and_completed_visibility`
- `20261031210207_coursepulse_filtered_analytics`
- `20261031210516_coursepulse_rating_distributions`
- `20261031210728_coursepulse_department_analytics_filter`
- `20261031210853_coursepulse_response_trends`
- `20261031211404_coursepulse_anonymous_date_precision`
- `20261031211443_coursepulse_remove_obsolete_analytics_overloads`
- `20261031214742_coursepulse_admin_user_department_assignment`
- `20261031215225_coursepulse_account_password_rate_limit`
- `20261031215804_coursepulse_feedback_version_history`
- `20261031220141_coursepulse_feedback_eligibility_policy_helper`
- `20261101065511_coursepulse_yes_no_question_type`
- `20261101065824_coursepulse_multiple_select_question_type`
- `20261101070445_course_codes`
- `20261101070626_course_instructor_directory`
- `20261101073156_account_profile_update`
- `20261101074059_admin_dashboard_overview`
- `20261101074717_data_deletion_requests`
- `20261101075037_search_rate_limit`
- `20261102051456_coursepulse_report_rate_limits`

The version list is aligned to the live Supabase migration ledger. Some management-applied versions are represented remotely with `select 1;` placeholder statements even though the corresponding SQL is preserved in the local migration files. For example, the duplicate academic-admin and assignment-policy entries are explicit no-op files because those policies are already included in the primary academic-admin migration; the student completion RPC is preserved in `20261031204219`. Before any CLI `db push`, compare `supabase migration list` and the live schema; do not reset or blindly replay the production project.\n\nDefault public-schema grants are disabled for future tables, sequences, and functions. Existing app tables grant only the operations required by the RLS model; anonymous users have no access to the app tables. Future migrations must explicitly grant only the privileges their features need. Because the migrations were applied through the connected Supabase management integration, compare `supabase migration list` with remote history before running `supabase db push` from a local CLI checkout. Do not reset the production database.

## First admin / instructor setup

New signups are `STUDENT` by default. Sign in to Supabase SQL Editor and run a reviewed statement from `scripts/promote-role.sql` to assign `INSTRUCTOR` or the first `ADMIN`. The application intentionally has no self-service role escalation endpoint. Signed-in users can update only their `users.full_name` field; role, ownership, and response permissions are not client-editable. Administrators must enroll and verify a TOTP authenticator (AAL2) before accessing the admin workspace or privileged APIs. Admins can manage user roles, suspend accounts, create departments/semesters, enroll students and assign instructors. Account suspension blocks subsequent application data access.

## Reports

Instructors and admins can export CSV, Excel-compatible XLS, XLSX and PDF. The `.xls` route is an HTML Spreadsheet document labelled as Excel MIME type for interoperability; `.xlsx` is a native Office Open XML workbook. Every format reads from `public.get_instructor_aggregates_filtered()`, which enforces role/course scope, optional course/semester/department/date filters and suppresses groups under five responses. Rating-distribution buckets are separately aggregated and each bucket below five is suppressed. Anonymous submissions retain only a date-level receipt value for date-bounded reporting, avoiding precise submission-time correlation. Text answers are not returned from the RPC. Instructors and administrators cannot select raw rows from either response store. New submissions have no student identifier or eligibility reference in the answer table; the separate eligibility ledger is inaccessible through the Data API. Students can see pending/completed forms only for courses in which they are explicitly enrolled. The legacy `responses` table remains for compatibility and retention, but had zero rows when the migration was applied. A database transaction smoke test confirmed the new RPC accepts a valid student submission and rejects a duplicate.

## Retention

A daily Supabase Cron job named `coursepulse-retention-cleanup` runs at 20:17 UTC (01:47 India time) and executes `public.cleanup_expired_responses()`. Inspect the Supabase Cron UI/job run history to confirm each execution.

## Deploy to Vercel

Import the GitHub repository into Vercel or run `vercel link` after creating it. Set these Vercel env vars for Production, Preview and Development as appropriate:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (public app origin, including the production URL)
- `DATABASE_URL` (server-only Postgres URL)
- `DIRECT_URL` (server-only direct Postgres URL)

Do not configure `SUPABASE_SERVICE_ROLE_KEY` for normal app functionality; the app does not need it. Use Node.js 22.x and the Next.js framework defaults. In Supabase Auth > URL Configuration, set the Site URL to `https://coursepulse-production.vercel.app` and add both `https://coursepulse-production.vercel.app` and `https://coursepulse-production.vercel.app/auth/confirm` to the allowed redirect URLs. Signup confirmation links return through the app's `/auth/confirm` route.

## GitHub

Administrator workspace access requires verified TOTP MFA (AAL2). The admin console supports user roles/suspension, departments, semesters, course metadata, student enrollments and instructor assignments; privileged actions are audit logged. Password recovery and reset flows are available. Same-origin checks and per-user database rate limits protect authenticated mutations.

The connected GitHub integration in this workspace can write files into existing repositories but does not expose repository creation. Create `CoursePulse.site` once with GitHub CLI, then push this project:

```bash
git init
git add .
git commit -m "feat: initial CoursePulse production application"
gh repo create CoursePulse.site --private --source=. --remote=origin --push
```

If the repository already exists, use:

```bash
git remote add origin https://github.com/<YOUR_GITHUB_OWNER>/CoursePulse.site.git
git branch -M main
git push -u origin main
```

## Note on Prisma and RLS

Prisma schema is maintained as the typed model contract and client generation target. App request paths intentionally use the Supabase session client, not a global Prisma connection, so the caller's JWT reaches PostgreSQL RLS. This avoids an application-wide privileged database connection accidentally bypassing student/instructor boundaries.
