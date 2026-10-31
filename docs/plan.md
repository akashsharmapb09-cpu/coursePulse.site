# Master Prompt Completion Plan

Status: DONE means implementation and verification evidence exist; IN PROGRESS means partially implemented; NOT STARTED means missing; BLOCKED means owner decision or external capability is required.

## P0 — Privacy and data model
- [ ] IN PROGRESS: threat model and target separation documented.
- [ ] NOT STARTED: migration design for eligibility and anonymous answer storage.
- [ ] NOT STARTED: atomic eligibility consumption and duplicate prevention without identity-answer mapping.
- [ ] NOT STARTED: legacy response migration/retirement under approved retention rules.
- [ ] NOT STARTED: RLS matrix and re-identification tests.
- [ ] NOT STARTED: correct privacy language in product UI and policy.

## P1 — Identity and security
- [ ] Password recovery/reset and password change.
- [ ] Session invalidation and account suspension.
- [ ] Admin MFA policy and privileged-action audit.
- [ ] Distributed rate limits, CSRF/Origin controls and generic auth errors.
- [ ] CSP, security header review, secret-history scan and credential rotation evidence.

## P2 — Academic administration
- [ ] Departments and semesters.
- [ ] Student enrollment and instructor-course assignments.
- [ ] Admin user/role management and account lifecycle.
- [ ] Course and form/question lifecycle, deadlines and versioning.
- [ ] Append-only admin audit log.

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
- [ ] Integration and E2E tests for all roles.
- [ ] RLS, IDOR, XSS, CSRF and rate-limit tests.
- [ ] WCAG 2.2 AA, keyboard and screen-reader review.
- [ ] Mobile/tablet/desktop browser matrix.
- [ ] Lighthouse/Core Web Vitals and query performance.
- [ ] Backup/restore and cron execution evidence.
- [ ] API/testing documentation and seed strategy.
- [ ] Production smoke test and evidence-based sign-off.

## Owner decisions required
Institution name/branding; verified support contact; department and semester catalogue; student age/minor policy; legal basis and retention schedule; cookie/analytics policy; paid/free status; official accessibility/support contact. Do not publish guessed legal statements or contacts.
