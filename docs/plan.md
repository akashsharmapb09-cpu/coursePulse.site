# Master Prompt Completion Plan

Status: DONE means implementation and verification evidence exist; IN PROGRESS means partially implemented; NOT STARTED means missing; BLOCKED means owner decision or external capability is required.

## P0 — Privacy and data model
- [x] DONE: threat model and target separation documented.
- [x] DONE: migration design for eligibility and anonymous answer storage.
- [x] DONE: atomic eligibility consumption and duplicate prevention without identity-answer mapping implemented in the database RPC; end-to-end verification remains open.
- [x] DONE: no legacy response rows existed at migration time; legacy table retained under existing retention policy.
- [ ] NOT STARTED: RLS matrix and re-identification tests.
- [ ] IN PROGRESS: app writes new answers to separate storage; policy pages are technical drafts and require institution/legal review.

## P1 — Identity and security
- [x] DONE: password recovery email flow and reset page added. Password change while signed in remains open.
- [x] DONE: account suspension blocks application access through active-profile checks and role helper. Global token revocation remains outstanding.
- [x] DONE: admin workspace and admin RPCs require TOTP AAL2; user and academic actions write audit events.
- [x] DONE: database-backed user/action rate limits and same-origin checks for course, form and response mutations. Auth-provider rate limits still require dashboard verification.
- [x] DONE: baseline Content-Security-Policy added; nonce-based strict CSP and browser validation remain open.
- [ ] Generic authentication errors, password recovery/change and session revocation.
- [ ] Supabase leaked-password protection (dashboard setting), secret-history scan and credential rotation evidence.

## P2 — Academic administration
- [x] PARTIAL: departments, semesters and course metadata created; edit/archive/activate lifecycle and user department assignment remain open.
- [x] DONE: student course enrollments and instructor-course assignments with scoped RLS.
- [x] DONE: MFA-protected user role/suspension API and console; last-active-admin guard.
- [ ] Course and form/question lifecycle, deadlines and versioning.
- [x] DONE: admin audit table and privileged audit RPC. Append-only Data API grants (no direct INSERT/UPDATE/DELETE).

## P3 — Student experience
- [ ] Eligible, pending and completed forms.
- [ ] Due dates, participation progress and submission history.
- [ ] Multi-question accessible response forms and confirmation.

## P4 — Instructor analytics
- [x] PARTIAL: assigned-course dashboard and aggregate metrics; additional instructor assignments are supported.
- [ ] Rating distributions, trend charts and date/semester/category filters remain open.
- [ ] Course comparison with cohort safeguards remains open.
- [ ] Privacy-reviewed anonymized comment workflow remains open.
- [x] DONE: CSV, XLSX and PDF downloads use the shared aggregate service; legacy XLS is also available.

## P5 — Public site, search and SEO
- [x] PARTIAL: public landing page, features section and footer; institution about/contact content remains open.
- [ ] Privacy/terms pages are technical drafts and need institution/legal approval.
- [x] DONE: permission-aware search across courses/forms and admin-only user search.
- [x] DONE: metadata, canonical, Open Graph, sitemap, robots and noindex for private routes.
- [x] DONE: custom not-found and error pages; full navigation audit remains open.

## P6 — QA and operations
- [ ] Integration and E2E tests for all roles (unit/static contract tests and SQL transaction smoke tests exist; browser E2E remains open).
- [ ] RLS, IDOR, XSS, CSRF and rate-limit tests.
- [ ] WCAG 2.2 AA, keyboard and screen-reader review.
- [ ] Mobile/tablet/desktop browser matrix.
- [ ] Lighthouse/Core Web Vitals and query performance.
- [ ] Backup/restore and cron execution evidence.
- [x] PARTIAL: PRD, architecture, code standards, security and CI documentation added; full API reference and seed strategy remain open.
- [ ] Production smoke test and evidence-based sign-off.

## Current external blockers
- Supabase Auth leaked-password protection is still disabled in the project security advisor; enable it in Supabase Dashboard → Authentication → Security and rerun the advisor.
- Admin MFA enrollment must be completed by the active administrator in the app before using the admin console.
- Institution-approved privacy/terms content and verified contact/legal details are still required.

## Owner decisions required
Institution name/branding; verified support contact; department and semester catalogue; student age/minor policy; legal basis and retention schedule; cookie/analytics policy; paid/free status; official accessibility/support contact. Do not publish guessed legal statements or contacts.
