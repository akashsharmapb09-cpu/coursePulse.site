# CoursePulse

Production-ready course feedback and aggregate analytics application.

## Stack

- Next.js App Router, TypeScript, React
- Supabase Auth + PostgreSQL with row-level security
- Prisma schema and Postgres model contract
- Zod request validation
- CSV, Excel-compatible XLS, native XLSX, and PDF aggregate exports

The app uses request-scoped Supabase clients so the authenticated user's JWT reaches PostgreSQL and RLS remains active. It does not use the service-role key for ordinary application queries.

## Database

Supabase project: `fwmovyitmtpnwhqmvrgh`

Applied migrations:
- `20261031162341_coursepulse_initial_schema_rls_aggregates_retention`
- `20261031162429_coursepulse_fix_numeric_aggregation`
- `20261031162901_coursepulse_private_helpers_cron_hardening`
- `20261031164000_coursepulse_feedback_creator_index`

Tables `users`, `courses`, `feedback`, and `responses` all have RLS enabled. Instructors cannot select raw response rows. Instructor reporting uses an aggregate RPC with a minimum group size of five and omits free-text answers. Supabase security advisor returned zero findings after hardening.

Retention cleanup is scheduled in Supabase pg_cron as `coursepulse-retention-cleanup`.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the Supabase URL and publishable/anon key.
3. Set `DATABASE_URL` and `DIRECT_URL` from Supabase database connection details for Prisma tooling.
4. Run:

```bash
npm install
npx prisma generate
npx prisma validate
npm run typecheck
npm test
npm run dev
```

New signups default to `STUDENT`. Promote instructor/admin roles only from the Supabase SQL Editor using the reviewed statements in `scripts/promote-role.sql`.

## Exports

Instructors and admins can export CSV, XLS, XLSX, and PDF. Exports contain only aggregate rows and suppress groups below five responses. Individual student answers and identities are not exported.

## GitHub

Repository: https://github.com/akashsharmapb09-cpu/coursePulse.site

The `main` branch has been initialized. To add the downloaded CoursePulse source bundle to this repository, clone it, extract the bundle contents into the clone, then commit and push:

```bash
git clone https://github.com/akashsharmapb09-cpu/coursePulse.site.git
cd coursePulse.site
# Extract the CoursePulse source bundle into this directory.
git add -A
git commit -m "feat: add CoursePulse production application"
git push origin main
```

## Security notes

- Do not add `.env.local`, Postgres passwords, service-role keys, or Vercel tokens to Git.
- Keep `DATABASE_URL` and `DIRECT_URL` server-side only.
- Set Supabase Auth Site URL and redirect URLs to the deployed Vercel domain.
- Admin/instructor role assignment is an operator action, never a self-service API.
