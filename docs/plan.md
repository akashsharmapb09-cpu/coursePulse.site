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
- [ ] Password recovery/reset and password change.
- [x] DONE: account suspension blocks application access through active-profile checks and role helper. Global token revocation remains outstanding.
- [x] DONE: admin workspace and admin RPCs require TOTP AAL2; user and academic actions write audit events.
- [x] DONE: database-backed user/action rate limits and same-origin checks for course, form and response mutations. Auth-provider rate limits still require dashboard verification.
- [x] DONE: baseline Content-Security-Policy added; nonce-based strict CSP and browser validation remain open.
- [ ] Generic authentication errors, password recovery/change and session revocation.
- [ ] Supabase leaked-password protection (dashboard setting), secret-history scan and credential rotation evidence.

## P2 — Academic administration
- [x] DONE: departments, semesters, course department/semester relations created.
- [x] DONE: student course enrollments and instructor-course assignments with scoped RLS.
- [x] DONE: MFA-protected user role/suspension API and console; last-active-admin guard.
- [ ] Course and form/question lifecycle, deadlines and versioning.
- [x] DONE: admin audit table and privileged audit RPC. Append-only Data API grants (no direct INSERT/UPDATE/DELETE).

## P3 — Student experience
- [ ] Eligible, pending and completed forms.
- [ ] Due dates, participation progress and submission history.
- [ ] Multi-question accessible response forms and confirmation.

## P4 — Instructor analytics
- [ ] Assigned-course dashboard and participation metrics.
- [ ] Rating distributions, trend charts and date/semester/category filters.
- [ ] Course comparison with cohort safeguards.
- [ ] Privacy-reviewed anonymized comment workflow.
- [ ] CSV, XLSX and PDF downloads from shared aggregate service.

## P5 — Public site, search and SEO
- [ ] Public landing/features/about/contact pages and footer.
- [ ] Privacy/terms pages with institution-approved content.
- [ ] Permission-aware global search.
- [ ] Metadata, canonical, Open Graph, sitemap, robots and noindex for private routes.
- [ ] Custom not-found/error pages and navigation audit.

## P6 — QA and operations
- [ ] Integration and E2E tests for all roles (unit/static contract tests only so far).
- [ ] RLS, IDOR, XSS, CSRF and rate-limit tests.
- [ ] WCAG 2.2 AA, keyboard and screen-reader review.
- [ ] Mobile/tablet/desktop browser matrix.
- [ ] Lighthouse/Core Web Vitals and query performance.
- [ ] Backup/restore and cron execution evidence.
- [ ] API/testing documentation and seed strategy.
- [ ] Production smoke test and evidence-based sign-off.

## Owner decisions required
Institution name/branding; verified support contact; department and semester catalogue; student age/minor policy; legal basis and retention schedule; cookie/analytics policy; paid/free status; official accessibility/support contact. Do not publish guessed legal statements or contacts.
