# CoursePulse

CoursePulse is an institution-managed course-feedback and aggregate analytics portal. It is built with Next.js App Router, TypeScript, Supabase Auth/Postgres RLS, and server-side aggregate RPCs.

## Stack
- Next.js 15 App Router, React 19, TypeScript
- Supabase Auth + PostgreSQL RLS and private helper functions
- Zod validation, Lucide, Tailwind CSS
- CSV, ExcelJS, PDFKit aggregate exports
- Vercel deployment
- Optional, consent-gated Vercel Web Analytics and Speed Insights (public routes only)

## Local setup
```bash
cp .env.example .env.local
# Fill Supabase URL and publishable/anon key from the project settings.
npm ci
npx prisma generate
npx prisma validate
npm run typecheck
npm test
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the browser/session client. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are server-side aliases; database tooling may also require `DATABASE_URL` and `DIRECT_URL`. Keep service credentials private and never place them in `NEXT_PUBLIC_` variables. See `.env.example` for names only.

## Important architecture and privacy boundary
The application uses request-scoped Supabase clients so Postgres evaluates each query using the signed-in user's JWT and RLS policies. New feedback submissions use `submit_anonymous_feedback`: eligibility/duplicate tracking is separated from anonymous answer storage, and aggregate reporting suppresses groups under five. The historical `responses` table still contains student-linked records; those legacy records are not retroactively anonymous.

## Useful commands
```bash
npm run typecheck
npm test
npm run build
npm run start
npm run prisma:validate
```

## Documentation
- `PRD.md` — product scope and requirements
- `architecture.md` — system/data flow and database boundary
- `security.md` — implemented controls and open risks
- `codestyle.md`, `AGENTS.md` — development conventions and guardrails
- `plan.md` — implementation roadmap
- `docs/API.md` — route overview
- `docs/TESTING.md` — automated and integration test plan
- `docs/MASTER-PROMPT-AUDIT.md` — evidence-based implementation status

## Database and deployment warning
The connected Supabase database currently contains later schema/RPC changes than the migration set tracked in this repository. Do not run `prisma migrate deploy`, `supabase db push`, or destructive SQL on production until the schema history is reconciled, a backup is verified, and a forward-only migration plan is reviewed. A branch build is not equivalent to production verification.

## Institutional configuration still required
The operating institution must supply its identity, contact details, privacy/legal review, age/minor policy, retention decisions, analytics consent requirements and operational contacts. The repository deliberately does not invent these values.
