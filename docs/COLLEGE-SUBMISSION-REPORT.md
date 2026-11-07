# CoursePulse — College Project Submission Report

**Project:** CoursePulse (.site college demonstration application)  
**Repository:** `akashsharmapb09-cpu/coursePulse.site`  
**Implementation branch:** `feat/master-prompt-completion`  
**Current feature head reviewed:** `cd4a5332c497d17d5c5d221cb20689bb8e46c22a`  
**Public deployment:** https://coursepulse-site.vercel.app  
**Report date:** 2 November 2026

## 1. Project overview

CoursePulse is a web-based course feedback and academic feedback-management application. It separates student, instructor and administrator capabilities and uses database-enforced authorization and aggregate-only reporting to reduce access to individual feedback answers.

The application is built with Next.js App Router, React, TypeScript, Supabase Auth, PostgreSQL Row Level Security (RLS), Prisma schema tooling, Zod validation and CSV/XLS/XLSX/PDF export libraries.

## 2. Implemented capabilities

### Student experience
- Sign-up/sign-in and password recovery/reset flows.
- View courses and feedback forms only when enrolled and eligible.
- Submit eligible feedback once and view pending/completed state.
- Support for rating, numeric, single-choice, multiple-choice, checkbox, Yes/No and text questions.
- Update own display name and submit an account-deletion request.

### Instructor experience
- Access owned or assigned courses.
- Create/edit/archive/republish courses and create/edit/open/close feedback forms.
- Configure deadlines and question categories, reorder questions and restore form-definition versions.
- View aggregate analytics with date, course, semester, department and question-category filters.
- Download CSV, XLS, XLSX and PDF aggregate reports.

### Administrator experience
- MFA-gated administrative workspace and privileged RPCs (TOTP AAL2).
- Manage users, roles, suspension, courses, departments, semesters, student enrollments and instructor assignments.
- Review audit history, institution overview, low-participation alerts and account-deletion requests.

### Privacy and security design
- RLS enabled on all 10 exposed public tables at the time of the latest schema inspection.
- New answer records are stored separately from the private eligibility ledger and do not contain student identifiers or eligibility references.
- Instructors and administrators use aggregate RPCs rather than direct access to raw answer rows.
- Small aggregate cohorts are suppressed below five responses.
- Same-origin checks and database-backed per-user rate limits cover sensitive mutations and selected analytics/export paths.
- A daily retention-cleanup cron is configured; two successful executions have been recorded.
- Security and privacy documentation explicitly notes that aggregate suppression is not a proof of cryptographic anonymity and that timing/re-identification risks still need independent review.

## 3. Deployment and automated verification

The current feature head is deployed to the Vercel Production target:
- Deployment: `dpl_ETbYkFQdiTeJ7QB6dm5bPeeYQK7i`
- Deployment state: `READY`
- Production alias: https://coursepulse-site.vercel.app
- Git source: `feat/master-prompt-completion`, commit `cd4a5332c497d17d5c5d221cb20689bb8e46c22a`

GitHub Actions PR validation run #385 passed for the PR merge candidate, which included the current feature head:
- `npm ci`: PASS
- `npm audit --audit-level=moderate`: PASS, zero reported vulnerabilities
- Prisma schema validation: PASS
- TypeScript typecheck: PASS
- Vitest: 34 test files / 130 tests PASS
- Next.js production build: PASS, 19/19 static pages generated

Selected rollback-only database integration checks have passed for enrollment/form eligibility, one-time submission and duplicate prevention, direct answer/eligibility access denial, instructor course scoping, five-response aggregation suppression, weekly trends and free-text exclusion.

The live Supabase project has 36 migration-history entries through `20261102102457_coursepulse_private_fk_indexes`. The latest additive migration adds indexes to two private foreign-key columns. The subsequent performance advisor run no longer reports unindexed foreign keys.

## 4. Important limitations and outstanding acceptance gates

A READY deployment and passing CI do not establish complete real-user operation. The following remain open and must not be represented as completed:

1. **Real-browser acceptance:** Root, login, signup, privacy routes and end-to-end student/instructor/admin journeys have not been independently verified in a real browser during this review. CI uses placeholder Supabase values and does not authenticate real users.
2. **Isolated staging:** Vercel Preview and Production currently share the same Supabase project. Write-based E2E tests must run against a disposable QA database, never against the college demo database. No Supabase development branch currently exists. A new branch was quoted at USD $0.01344/hour; it requires owner approval before creation.
3. **Supabase Auth leaked-password protection:** Security Advisor reports this disabled. Supabase documentation states the feature is available on Pro and above; the connected organization is on the Free plan. The project owner/institution must upgrade or record explicit risk acceptance.
4. **Auth provider settings:** Verify the actual Supabase Site URL and allowed redirect URLs, then test signup confirmation and password reset end to end.
5. **Administrator MFA:** One active administrator has a verified TOTP factor. Fresh sign-in proving AAL2 and the recovery path still need browser verification.
6. **Accessibility and devices:** WCAG 2.2 AA, keyboard/screen-reader checks, color contrast, touch targets and the full mobile/tablet/desktop viewport matrix remain unverified.
7. **Performance:** No Lighthouse/Core Web Vitals or query-performance report has been produced. A two-second load target must not be claimed without measurement.
8. **Security/privacy adversarial testing:** Full student/instructor/admin RLS matrix, cross-resource IDOR, XSS/CSRF, distributed abuse, statistical differencing and independent re-identification review remain open.
9. **Backup and recovery:** No isolated backup/restore drill evidence is available.
10. **Institution/legal decisions:** Institution/controller identity, approved support contact, jurisdiction, privacy/terms/cookie wording, legal basis, retention schedule, consent/minor policy and accessibility contact must be supplied and approved by the institution. This report does not invent legal approval.
11. **Account deletion:** The application records and audits requests, but the institution's authorized Supabase owner must perform and verify Auth-user deletion before a request is marked completed.

At the 2 November 2026 snapshot, the live database contains one active ADMIN profile and one STUDENT profile, but no INSTRUCTOR profile; one course (`cse111`) is ARCHIVED; one feedback form is closed; there are zero departments, semesters, student-course enrollments, instructor-course assignments, legacy responses or anonymous submissions. No college roster has been loaded. Do not use real student information until Auth redirects are verified, institutional approval is signed and the outstanding release gates are complete.

## 5. Submission and demonstration guidance

For a supervised college demonstration:
- Use the public URL above.
- Demonstrate the public landing page, authentication UI, and role-specific workflows only with approved test accounts and synthetic data in an isolated QA environment.
- Do not create fake student records in the production Supabase project.
- Do not distribute administrator credentials or secrets in a report or presentation.
- Explain the privacy separation, RLS and aggregate suppression as design controls, while acknowledging their stated limitations.

## 6. Release verdict

**Implementation status: Substantially implemented.**  
**Deployment status: Vercel Production READY.**  
**Automated CI status: PASS (34 test files / 130 tests).**  
**College/institution acceptance status: NOT YET SIGNED OFF.**

The project is deployable and can be presented as a working implementation, but it is not honestly certifiable as having every master-prompt requirement fully completed until the browser, security, accessibility, operational and institution-owner gates above are evidenced.

Pull Request #2 remains open and draft. The feature branch has not been merged into `main`.
