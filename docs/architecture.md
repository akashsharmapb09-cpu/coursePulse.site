# CoursePulse Architecture

## Current implementation baseline
- Next.js App Router 15.5.28, React 19, TypeScript, Tailwind and Lucide.
- Supabase Auth + Postgres with RLS, private-schema SECURITY DEFINER helpers and RPC wrappers.
- Prisma is the typed schema/client-generation and migration tooling contract; request runtime data access uses signed-in Supabase session clients, not a global Prisma/service-role connection.
- Vercel hosting; GitHub Actions dependency audit, Prisma validation, TypeScript, Vitest and Next.js production build.

## Runtime modules
- Identity and profile: sign-up, email confirmation, login/logout, password reset/change, display-name update, active-account checks and role protection.
- Academic catalogue: departments, semesters, courses/course codes, enrollments and instructor assignments.
- Feedback lifecycle: multi-question form schema, categories, deadlines, open/close, form version snapshots and restore.
- Student submission: private eligibility ledger, atomic duplicate prevention, anonymous answer storage, completion status, history and confirmation.
- Analytics/reporting: filtered aggregate RPCs, rating bins, weekly trends, category filters, donut/sentiment/radar presentation, two-course comparison and CSV/XLS/XLSX/PDF.
- Administration: user role/suspension, academic setup, audit log, institution overview, privacy-request review and low-participation alerts.
- Search and public pages: debounced permission-aware search, public landing/features/legal drafts, metadata, canonical/OG, robots/sitemap and private-page noindex.

## Privacy boundary and limitations
New submissions are written to `public.anonymous_submissions` with `feedback_id`, `answers` and date-level `received_on`. That table has no student ID or reference to eligibility. One-time eligibility/duplicate prevention is separate in `private.feedback_eligibility`, with direct Data API access denied. The submission RPC validates schema/answer types, atomically consumes eligibility and inserts answer payloads in one database transaction.

The legacy `public.responses` table still has `student_id` alongside answers. It was empty at cutover and remains for compatibility/retention. Do not relabel legacy records or claim cryptographic anonymity. Timing/aggregate inference, complementary suppression and repeated-query differencing still need independent review.

Free-text questions can be collected, but raw text is not included in ordinary analytics or exports. A privacy-reviewed anonymized comment workflow is not implemented.

## Authorization and operations
Every route authenticates and resolves role from protected server-side profile data. RLS scopes student enrollments, instructor ownership/assignment and admin actions. The private schema contains eligibility, rate limits, feedback-version snapshots, deletion requests and SECURITY DEFINER helpers. Admin RPCs require AAL2. Profile self-update is limited to `users.full_name`. Deletion requests can be reviewed and audited, but actual Supabase Auth account deletion is a separate authorized owner operation; the app has no service-role credential for automatic deletion.

Production database changes must be additive, reviewed, recorded in the Supabase migration ledger and tested before deployment. Never reset production or use student data for an unreviewed test. Preview and production currently share the production Supabase project, so browser tests that create records require a disposable staging project.

## Reporting pipeline
1. Authenticate and apply course/institution scope.
2. Query aggregate RPCs only; do not read raw response rows.
3. Suppress rating bins and question groups below five responses.
4. Use category-level teaching effectiveness only when each contributing question is reportable.
5. Exclude free-text answers from ordinary reports and exports.
6. Reuse the same aggregate service for dashboards and downloadable reports.

Minimum-five suppression does not by itself prove resistance to complementary suppression or repeated-query differencing.

## Deployment gates
Before production sign-off verify a current preview of the exact commit; role-specific browser flows; RLS/IDOR/XSS/CSRF and rate limits; WCAG 2.2 AA; responsive viewports; Lighthouse/Core Web Vitals; backup/restore and cron execution; legal/policy approval; and production smoke tests. Do not infer deployment success from CI success alone.