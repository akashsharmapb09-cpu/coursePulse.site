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

## Test data safety

No default admin credentials or production demo students are seeded. Preview and production currently share the same Supabase project URL; treat preview writes as production writes. Follow docs/SEEDING.md for an isolated QA project.
