# CoursePulse

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

The migrations under `supabase/migrations/` correspond to the three applied migrations on Supabase project `fwmovyitmtpnwhqmvrgh`. The live database now has `users`, `courses`, `feedback`, and `responses`, all with RLS enabled. Its migration history is:

- `20261031162341_coursepulse_initial_schema_rls_aggregates_retention`
- `20261031162429_coursepulse_fix_numeric_aggregation`
- `20261031162901_coursepulse_private_helpers_cron_hardening`
- `20261031164000_coursepulse_feedback_creator_index`

Because the migrations were applied through the connected Supabase management integration, compare `supabase migration list` with remote history before running `supabase db push` from a local CLI checkout. Do not reset the production database.

## First admin / instructor setup

New signups are `STUDENT` by default. Sign in to Supabase SQL Editor and run a reviewed statement from `scripts/promote-role.sql` to assign `INSTRUCTOR` or the first `ADMIN`. The application intentionally has no self-service role escalation endpoint.

## Reports

Instructors and admins can export CSV, Excel-compatible XLS, XLSX and PDF. The `.xls` route is an HTML Spreadsheet document labelled as Excel MIME type for interoperability; `.xlsx` is a native Office Open XML workbook. Every format reads from `public.get_instructor_aggregates()`, which enforces role/course scope and suppresses groups under five responses. Text answers are not returned from the RPC. Instructors cannot select the `responses` table.

## Retention

A daily Supabase Cron job named `coursepulse-retention-cleanup` runs at 20:17 UTC (01:47 India time) and executes `public.cleanup_expired_responses()`. Inspect the Supabase Cron UI/job run history to confirm each execution.

## Deploy to Vercel

Import the GitHub repository into Vercel or run `vercel link` after creating it. Set these Vercel env vars for Production, Preview and Development as appropriate:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL` (server-only Postgres URL)
- `DIRECT_URL` (server-only direct Postgres URL)

Do not configure `SUPABASE_SERVICE_ROLE_KEY` for normal app functionality; the app does not need it. Select Node.js 20.9+ and Next.js framework defaults. Set Supabase Auth site URL and allowed redirect URLs to the Vercel production domain.

## GitHub

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
