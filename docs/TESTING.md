# Testing and release verification

## Automated CI

Workflow: .github/workflows/ci.yml. It runs on pull requests and on pushes to main or feat/master-prompt-completion.

Commands:

- npm ci
- npm audit --audit-level=moderate
- npx prisma validate
- npm run typecheck
- npm test
- npm run build

Latest GitHub Actions evidence at feature commit 0c71aecca715e6f79c25570ee6b54896ee9cf48a on 1 November 2026:

- Dependency audit: 0 npm vulnerabilities reported.
- Prisma schema validation: PASS.
- TypeScript: PASS.
- Vitest: 29 files / 107 tests PASS.
- Next.js production build: PASS; static pages 17/17 generated.
- Vercel exact-SHA feature preview: READY; deployment ID dpl_G96JHPSwEkeJpPSZsRXy4oeNT9PT. HTTP/browser GET smoke test could not be completed because DNS resolution failed in the runner.

CI uses placeholder public Supabase values for build-time rendering. It does not exercise real authentication, live database RLS, real provider settings or browser journeys.

## Automated test coverage

The Vitest suite has contract/unit coverage for export escaping and formula neutralization, analytics filters/chart calculations, anonymous submission and eligibility contracts, date-only precision, question types/categories/editor behavior, feedback lifecycle/deadlines/version history, mutation guards, account profile/password boundaries, admin overview, deletion requests, course details/lifecycle and smart search.

These tests do not replace authenticated database role-matrix tests or browser E2E.

## Completed rollback-only live-schema integration checks (1 November 2026)

Two SQL integration scripts were run as explicit transactions against the active schema and ended with ROLLBACK. Follow-up queries confirmed zero synthetic Auth users, profiles, courses, forms, answers and deletion requests persisted.

Student/anonymous flow PASS:
- A synthetic enrolled student sees their published course and eligible open feedback form, but not a published course without enrollment.
- Completion state changes from pending to submitted after calling the anonymous submission RPC.
- A repeated submission is rejected with the duplicate/unique-violation path.
- A private eligibility row is consumed atomically with one anonymous answer record.
- Authenticated direct reads of anonymous_submissions and private.feedback_eligibility are denied.
- The anonymous answer table contains no student_id, user_id or eligibility_id column.

Instructor analytics/privacy PASS:
- Five identical rating answers form a reportable aggregate with response_count 5 and average 4.
- A four-response form is suppressed from aggregate/rating distribution results.
- A second instructor's course aggregate is not returned to the tested instructor.
- Weekly trend count correctly includes nine responses across the tested instructor's two forms.
- Free-text answers are excluded from aggregate option_value output.
- A student-role identity cannot call instructor aggregate analytics.

These checks use synthetic fixtures inside one rollback-only SQL transaction. They validate selected database behavior; they are not browser E2E or a complete policy matrix.

## Controlled integration tests still required

Run only against a disposable Supabase QA project with synthetic accounts. Never create synthetic student submissions in the production project.

1. Student: sign up/confirm/sign in, view only enrolled published courses, see pending/completed forms, submit a form once, verify duplicate prevention and confirmation, update own display name, submit/view deletion request.
2. Instructor: access only owned/assigned courses; create/edit/publish/close/deadline a form; reorder questions without changing IDs; review aggregate analytics; download CSV/XLSX/PDF; restore a form version.
3. Admin: verify TOTP AAL2 gate; manage users/departments/semesters/enrollments/assignments; inspect audit log, institution overview and deletion requests.
4. Negative tests: manipulate course/form/user IDs across owners; attempt role escalation; attempt direct access to private answer/eligibility/deletion tables and raw response rows; request admin actions without MFA; send cross-origin mutations; submit invalid answer types; repeat a submission; exceed rate limits.
5. Verify password reset and password change using a real synthetic account, including global session revocation.
6. Verify the retention cron schedule and run history; perform a backup/restore drill in an isolated recovery project.

## Browser, accessibility and performance release gates

Not yet evidenced for the latest feature commit:

- Playwright browser E2E for student, instructor and admin.
- Keyboard-only navigation, focus visibility, accessible names, semantic errors and screen-reader announcements.
- WCAG 2.2 AA color contrast and keyboard/screen-reader review.
- Viewport matrix: 320–480, 481–768, 769–1024, 1025–1440 and 1441+ pixels.
- Horizontal overflow, table/chart wrapping and touch-target checks.
- Lighthouse/Core Web Vitals: LCP, INP and CLS. Do not claim the two-second target without measurements.
- Chromium, Firefox and WebKit smoke checks.

## Retention/cron verification (1 November 2026)

- Cron job `coursepulse-retention-cleanup` is active on schedule `17 20 * * *` UTC.
- Last recorded job run: 31 October 2026 20:17 UTC, status `succeeded`.
- Cleanup function is owned by postgres, executable by service_role, and not executable by anon/authenticated.
- Rollback-only SQL smoke test inserted 31-day-old legacy and anonymous answer rows plus a three-day-old rate-limit row, invoked the cleanup function, and asserted that all three were deleted.
- A follow-up query confirmed that no synthetic course/form/response fixtures persisted after rollback.

This proves one recorded cron execution and the function's expiration behavior; it does not prove long-term recurring reliability or backup restoration.

## Test data safety

No default admin credentials or production demo students are seeded. Preview and production currently share the same Supabase project URL; treat preview writes as production writes. Follow docs/SEEDING.md for an isolated QA project.
