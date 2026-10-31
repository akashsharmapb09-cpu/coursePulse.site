# CoursePulse Architecture

## Current production baseline
Next.js App Router 15.5.28, React 19, TypeScript, Tailwind, Supabase Auth/Postgres with RLS, Prisma schema/client tooling, and Vercel hosting. Runtime request data access uses request-scoped Supabase session clients so the caller JWT reaches Postgres RLS; Prisma is not the runtime data layer.

## Target logical modules
- Identity: auth callbacks, recovery, session policy, profiles and role administration.
- Academic: departments, semesters, courses, enrollments and instructor assignments.
- Feedback: form definitions, question versions, eligibility and submission workflow.
- Anonymous response store: answer payloads without student identifiers or reversible identity references.
- Reporting: one server-side aggregate service applying cohort suppression before charts, exports and APIs.
- Administration: user lifecycle, academic configuration, retention and append-only audit events.
- Public site: landing, features, legal and contact content with crawl controls.

## Privacy boundary
Eligibility asks whether an authenticated student may submit and whether the permission has been used. Anonymous answer storage records only the answer content. No stable shared ID, foreign key, timestamp precision, request metadata or administrator-accessible mapping may reconstruct the student-to-answer relationship.

The existing response model stores student_id with answers and is not anonymous. It must not be silently relabelled. Migration requires a reviewed threat model, compatibility plan, duplicate-prevention design and tests before production cutover.

## Authorization
Authenticate at route entry; resolve role from protected server-controlled data, never user-editable metadata; check role and resource ownership in route code and RLS; avoid service-role clients for ordinary requests. Admin operations use explicit allowlists and append-only audit records. Review views/RPC security mode and EXECUTE grants.

## Target data entities
users, departments, semesters, courses, course_enrollments, instructor_course_assignments, feedback_forms, feedback_questions, feedback_eligibility, anonymous_submissions, anonymous_answers, audit_logs, consent_records and data_deletion_requests.

Inspect live constraints/data before selecting identifiers or retention. No destructive migration or production reset is permitted.

## Reporting pipeline
1. Authenticate and scope to assigned courses or authorized institution scope.
2. Aggregate in Postgres or trusted server-side service.
3. Apply minimum cohort threshold before returning metrics or categories.
4. Suppress small complementary groups to prevent subtraction attacks.
5. Exclude free text from ordinary reports.
6. Reuse the same aggregate service for dashboard and exports.

## Operations
Keep secrets server-only; version and review migrations; CI gates typecheck, tests, build, dependency and secret scans; validate on preview before production. Verify backups, restore and cron history before sign-off.
