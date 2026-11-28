# CoursePulse

CoursePulse is a single-college course-feedback workspace built with Next.js, React, TypeScript and Supabase. It connects Student feedback submissions with Teacher course management and privacy-protected aggregate reporting. Public self-registration creates Student accounts; Teacher access is provisioned by invitation. Admin/HOD is not a public signup or dashboard role.

## Roles and access

### Students
- Register with full name, unique username, programme and password. No email address or email verification is required for Student self-registration.
- Sign in with username and password.
- View published courses and open feedback forms only when enrolled and eligible.
- Submit validated feedback once per eligible form and view pending/completed status.
- Update permitted profile details, change a password while signed in, and submit an account/data-deletion request.

### Teachers
- Receive access through an invitation or approved account-provisioning process.
- Sign in with their provisioned demo username or registered college email and password.
- Access courses they own or have been assigned.
- Create and manage feedback forms, structured questions, categories, due dates and form versions.
- View filtered aggregate analytics, response trends, rating distributions and two-course comparisons.
- Export aggregate reports as CSV, Excel-compatible XLS, XLSX or PDF.

### Restricted administration
Privileged account and academic-management operations are not public self-service features. Where enabled, administrative changes are protected by server-side authorization, MFA assurance checks and audit logging.

## Feedback storage and privacy

Student feedback is submitted to the application server and written to the connected Supabase database through a validation and eligibility-checking transaction. New anonymous answer records store the feedback form reference, answer payload and date-level receipt; they do not contain the student's user ID, username or email. A separate private eligibility record controls course/form access and duplicate-submission prevention.

This is an identity-separation design, not a guarantee of absolute or cryptographic anonymity. Course/form context, timing and free-text comments can still create identification risks. Students should not include names, roll numbers, contact details or other identifying information in comments.

Teacher analytics and exports use aggregate database functions rather than raw answer rows. Question groups and rating bins with fewer than five responses are suppressed, and free-text answers are excluded from ordinary reports. The minimum-five rule reduces disclosure but does not by itself eliminate re-identification or repeated-query risks.

Feedback-form retention is configurable within the supported 30-to-730-day range. A scheduled cleanup process removes expired answer records and old rate-limit data. Account/data-deletion requests can be submitted in the workspace and are reviewed; submitting a request does not automatically delete a Supabase Auth account.

## Technology

- Next.js App Router, React and TypeScript
- Tailwind CSS and Lucide icons
- Supabase Auth and PostgreSQL with Row Level Security (RLS)
- Supabase Edge Function for username-based Student registration/sign-in
- Supabase RPCs for anonymous submission, eligibility and aggregate reporting
- Prisma schema/client tooling and migrations
- Vercel hosting and optional public-page Analytics/Speed Insights (loaded only after consent)

Runtime data access uses signed-in Supabase session clients and database policies. The Supabase publishable/anon key may be used by browser clients only with RLS; service-role and secret keys must remain server-side and must never be committed.

## Run locally

~~~bash
npm ci
npm run dev
~~~

Create a local `.env.local` with the Supabase project URL and publishable key:

~~~bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
~~~

Deploy the required Edge Function `student-username-auth` to the connected Supabase project. Supabase supplies its server-side Auth keys to the Edge Function environment; never put service/secret keys in browser code or commit them to this repository.

Open http://localhost:3000.

## Validate locally

~~~bash
npm run typecheck
npm test
npm run build
~~~

## Environment and test-data safety

Production and Vercel Preview currently share the production Supabase project. Treat Preview writes as production writes. Do not run write-heavy browser tests, seed synthetic identities, or create fake feedback cohorts against production. Use a separate disposable Supabase QA project for synthetic accounts, fixture submissions, authenticated browser E2E and destructive tests. Never fabricate responses to bypass the five-response privacy threshold.
