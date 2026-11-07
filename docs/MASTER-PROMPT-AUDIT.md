# Master Prompt Compliance Audit — Current Working Branch

**Audit date:** 2026-11-07
**Repository:** `akashsharmapb09-cpu/coursePulse.site`
**Branch:** `coursepulse/master-prompt-implementation` (working copy)
**Production project:** `coursepulse-site.vercel.app`
**Database:** Supabase project `fwmovyitmtpnwhqmvrgh`

## Executive verdict

**PARTIAL — meaningful implementation completed in a review branch; not production-certified.** The changes below compile and pass the current automated tests/build in a Vercel sandbox. They have not yet passed a full live role-matrix test, independent security review, browser E2E, measured Core Web Vitals, or institution/legal approval. The live production deployment has not been replaced.

## Verified in this working copy

- Baseline audited before editing. Existing Next.js/Supabase/RLS architecture preserved.
- New public landing page plus Features, About, Privacy, Terms, Contact, Support, and Refund Policy pages.
- Public-only robots/sitemap, per-page canonical metadata, OG metadata, favicon, custom 404 and error boundary.
- Authenticated dashboard and admin pages carry noindex metadata.
- Feedback builder creates up to 30 questions with rating/number/single-choice/multi-select/yes-no/short/long text and optional due date.
- Student form UI answers all supported question types, displays submission state, and refreshes after successful submit.
- New answer submissions call `submit_anonymous_feedback`; legacy student-linked response insertion is removed from the new API path.
- Analytics API calls the filtered aggregate, rating-distribution, and weekly-trend RPCs; supports course, semester, department and date filters, exposes weekly activity and matching 1–5 rating-question course comparison; returns cohort threshold and no raw answers.
- Course/form/response/search/analytics/export and selected admin actions use the database-backed rate limiter.
- Search API is role/RLS scoped; privileged user search requires MFA AAL2.
- Admin workspace/API add MFA-gated user role/status management, department/semester create, student enrollment, instructor assignment, deletion-request review, aggregate overview and recent audit log.
- Password-change UI globally signs out sessions after successful credential update.
- API mutation origin checks and CSP/security headers were added.
- TypeScript check: PASS.
- Vitest: PASS — 5 existing export tests at first run; new validation tests are tracked separately if added.
- Next.js production build: PASS — 18 pages generated in the initial build after core page implementation.

## PARTIAL or not yet verified

- The analytics UI now has course/semester/department/date filters, rating distribution, weekly activity and matching-question rating comparisons. A fuller chart suite (radar/category charts, response sentiment, instructor filters and a complete trend visualization) remains.
- Feedback form edit/reorder/question deletion/deactivation lifecycle is not complete; current builder is create-oriented.
- Admin course CRUD/settings and full form/question management are incomplete.
- Admin deletion review records workflow state and note; it does not automatically erase every external/legal record. Completion requires operator-verified deletion work.
- Account registration/password-reset lifecycle and account-suspension behavior need comprehensive live testing.
- Existing tests do not constitute an E2E, accessibility, security, or database role matrix.
- Vercel Web Analytics and Speed Insights are now wired behind explicit optional consent and only report public-page views/performance. Project-level feature enablement must be confirmed in the Vercel dashboard after deploying; custom interaction events remain off.
- No CAPTCHA/bot challenge integration is configured.
- No age-assurance or parental-consent workflow is implemented.
- No institutional phone/email/address supplied; public policies explicitly request operator review and contain no invented contact details.
- LCP/INP/CLS targets have not been measured.
- No browser/mobile visual QA or screen-reader audit is claimed.
- No historical Git secret scan or credential-rotation evidence is claimed.

## Database and security findings

- Live DB contains the anonymous submission RPC, separate eligibility ledger, no-student-ID anonymous answer table, minimum-five aggregate suppression, filtered reporting RPCs, admin MFA checks, last-admin guard, audit RPCs, deletion request workflow, and database rate limiter.
- Legacy `public.responses` still has `student_id` and historical linked records. Do not claim those old records are anonymous.
- Supabase security advisor warns that leaked-password protection is disabled.
- Advisor warns `public.claim_admin_signup(p_code text)` is an authenticated-callable SECURITY DEFINER function; bootstrap intent, grants and limits require review.
- `private.admin_signup_settings` was previously flagged for missing RLS. Current observed grants deny `anon` schema access and deny `authenticated` direct table privileges, but an owner-approved RLS/grant design and fresh advisor verification are still required.
- Live migration history has evolved beyond migration files in the repository. Do not deploy Prisma/Supabase migrations until history is reconciled, schema-diff reviewed and backup/rollback prepared.
- CSP currently allows inline scripts/styles for Next.js compatibility; nonce hardening remains future work.

## Next priorities

1. Create branch preview/PR and run route smoke tests with dedicated test accounts.
2. Add integration tests for student/instructor/admin, AAL1/AAL2, anonymous submission and IDOR/RLS.
3. Finish analytics charts/filters, course comparison, complete form lifecycle and admin course/settings tools.
4. Enable Supabase leaked-password protection; review `claim_admin_signup`; agree RLS policy for private admin settings.
5. Reconcile migrations and legacy response retention strategy.
6. Review legal/privacy notices and age policy with the operating institution.
7. Run Playwright, accessibility, Lighthouse, performance, backup/restore and production rollout checks.

## Evidence policy
Use `PASS` only for checks run against this branch in this working environment. Use `PARTIAL` where code exists but live behavior is untested. Do not infer production readiness from a successful build.
