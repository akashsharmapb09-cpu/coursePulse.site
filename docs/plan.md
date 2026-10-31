# Master Prompt Completion Plan

Status: DONE means implementation and verification evidence exist; IN PROGRESS means partially implemented; NOT STARTED means missing; BLOCKED means owner decision or external capability is required.

## P0 — Privacy and data model
- [x] DONE: threat model and target separation documented.
- [x] DONE: migration design for eligibility and anonymous answer storage.
- [x] PARTIAL: atomic eligibility consumption and duplicate prevention without identity-answer mapping are implemented in the database RPC; full end-to-end verification and adversarial tests remain open.
- [x] DONE: no legacy response rows existed at migration time; legacy table retained under existing retention policy.
- [x] PARTIAL: RLS matrix and automated contract tests added; exhaustive role-matrix, IDOR and statistical re-identification testing remains open.
- [x] PARTIAL: app writes new answers to separate storage; completed-form visibility is eligibility-scoped; policy pages are technical drafts and require institution/legal review.

## P1 — Identity and security
- [x] DONE: password recovery/reset and signed-in password change are implemented. The change flow verifies the current password in an isolated Auth client, uses a dedicated per-user rate limit, and attempts global session revocation; real-account/session end-to-end verification remains open.
- [x] DONE: account suspension blocks application access through active-profile checks and role helper. Global token revocation remains outstanding.
- [x] DONE: admin workspace and admin RPCs require TOTP AAL2; user and academic actions write audit events.
- [x] DONE: database-backed per-user/action rate limits and same-origin checks cover course, form, response, admin and signed-in password-change mutations. Auth-provider rate limits still require dashboard verification.
- [x] DONE: baseline Content-Security-Policy added; nonce-based strict CSP and browser validation remain open.
- [x] PARTIAL: password reset uses generic confirmation; consistent generic sign-in error normalization and provider-level rate-limit verification remain open.
- [ ] Supabase leaked-password protection (dashboard setting), secret-history scan and credential rotation evidence.

## P2 — Academic administration
- [x] PARTIAL: departments and semesters can be created and edited; semester active state can be changed; courses can be linked to departments/semesters; users can be assigned/cleared from departments through an MFA-protected, audited RPC. Full archival/lifecycle controls remain open.
- [x] DONE: student course enrollments and instructor-course assignments with scoped RLS.
- [x] DONE: MFA-protected user role/suspension API and console; last-active-admin guard.
- [x] PARTIAL: course create/edit/archive/republish and feedback create/edit/open/close/deadline enforcement implemented; form-definition version snapshots and owner/admin restore are implemented; deletion recovery, scheduling and full lifecycle audit remain open.
- [x] DONE: admin audit table and privileged audit RPC. Append-only Data API grants (no direct INSERT/UPDATE/DELETE).

## P3 — Student experience
- [x] DONE: eligibility, pending and completed forms; closed completed forms remain visible only to the student who submitted.
- [x] PARTIAL: optional deadlines are enforced by the database; cohort participation progress and richer history remain open.
- [x] PARTIAL: multi-question response form supports all configured question types and confirmation; WCAG/keyboard/screen-reader validation remains open.

## P4 — Instructor analytics
- [x] PARTIAL: assigned-course dashboard and aggregate metrics; additional instructor assignments are supported.
- [x] PARTIAL: course, semester, department/category and date filters, privacy-suppressed rating distributions, weekly response trends and cross-course comparison are implemented; advanced longitudinal analysis remains open.
- [x] PARTIAL: two-course comparison uses the filtered aggregate RPC and minimum-five cohort suppression; multi-course comparison and statistical significance context remain open.
- [ ] Privacy-reviewed anonymized comment workflow remains open.
- [x] DONE: CSV, XLSX and PDF downloads use the shared aggregate service; legacy XLS is also available.

## P5 — Public site, search and SEO
- [x] PARTIAL: public landing page, features section and footer; institution about/contact content remains open.
- [ ] Privacy/terms pages are technical drafts and need institution/legal approval.
- [x] DONE: permission-aware search across courses/forms and admin-only user search.
- [x] DONE: metadata, canonical, Open Graph, sitemap, robots and noindex for private routes.
- [x] DONE: custom not-found and error pages; full navigation audit remains open.

## P6 — QA and operations
- [x] PARTIAL: GitHub CI runs dependency audit, Prisma validation, TypeScript, 14 Vitest files/54 tests and a Next.js production build. Real role-by-role integration and browser E2E remain open.
- [ ] RLS, IDOR, XSS, CSRF and rate-limit tests (same-origin and database rate-limit controls are implemented; adversarial tests remain open).
- [ ] WCAG 2.2 AA, keyboard and screen-reader review.
- [ ] Mobile/tablet/desktop browser matrix.
- [ ] Lighthouse/Core Web Vitals and query performance.
- [ ] Backup/restore and cron execution evidence.
- [x] PARTIAL: PRD, architecture, code standards, security and CI documentation added; full API reference and seed strategy remain open.
- [ ] Production smoke test and evidence-based sign-off.

## Current external blockers
- Latest feature branch is not deployed to a verified preview or production. The newest READY Vercel preview is an older commit; the latest feature commit has a Vercel build-rate-limit/upgrade-to-Pro status. Verify a current preview and quota before promotion.
- Supabase Auth leaked-password protection is still disabled in the project security advisor; enable it in Supabase Dashboard → Authentication → Security and rerun the advisor.
- Admin MFA enrollment must be completed by the active administrator in the app before using the admin console.
- Institution-approved privacy/terms content and verified contact/legal details are still required.

## Owner decisions required
Institution name/branding; verified support contact; department and semester catalogue; student age/minor policy; legal basis and retention schedule; cookie/analytics policy; paid/free status; official accessibility/support contact. Do not publish guessed legal statements or contacts.
