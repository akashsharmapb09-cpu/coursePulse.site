# CoursePulse master-prompt compliance audit

Audit date: 1 November 2026  
Repository: akashsharmapb09-cpu/coursePulse.site  
Branch: feat/master-prompt-completion  
Latest application-code commit reviewed: 2948614d83caa88cdec545bef51f63a61579992e  
PR #2: open, draft  
Production alias: https://coursepulse-production.vercel.app

## Executive verdict

PARTIAL — not approved for production release. The latest application-code commit builds and automated CI passes. The requested core student, instructor, administrator, academic, feedback, search, analytics and public-site functionality is substantially implemented. Production readiness is still blocked by a current exact-SHA Vercel deployment, isolated staging/E2E, adversarial privacy/security tests, accessibility/performance evidence, administrator MFA enrollment, Supabase Auth security settings and institution-approved legal text.

A passing build is not proof of full end-to-end function.

## Latest automated evidence

GitHub Actions run #316 completed successfully for application commit 2948614d on 1 November 2026:

- npm audit --audit-level=moderate: 0 reported vulnerabilities.
- Prisma schema validation: PASS.
- TypeScript: PASS.
- Vitest: 28 test files / 103 tests PASS.
- Next.js production build: PASS.

The workflow uses placeholder public Supabase settings at build time. It does not log in to real accounts, run browser E2E, verify live user roles or prove production credentials.

## Implemented scope

- Three roles, server-side profile lookup, RLS and admin TOTP AAL2 gates.
- Separate new anonymous answer store and private eligibility/duplicate-prevention ledger. The legacy public.responses table remains for compatibility and was empty at cutover; it must not be described as anonymous legacy data.
- Multi-question forms supporting rating, number, choice, multiple select, yes/no and text; seven categories; stable question IDs; reorder; deadlines; lifecycle and version restore.
- Course management, course codes, departments, semesters, student enrollment and instructor-course assignments.
- Student pending/completed form state, submission confirmation, display-name updates and deletion-request tracking.
- Instructor/admin aggregate analytics, filters, rating distributions, donut charts, sentiment bars, reportable category-weighted radar, weekly trends, two-course comparison and CSV/XLS/XLSX/PDF exports.
- Admin user management, audit history, academic setup, institution overview, low-participation alerts and deletion-request review.
- Password reset/change, same-origin mutation checks, per-user rate limits and permission-aware debounced search with filtered navigation.
- Public landing page with required headline/CTAs, About and Contact pages, Features section, complete footer, honest free-project refund information, technical policy pages, canonical/OG metadata, robots/sitemap, custom 404 and error pages.
- PRD, architecture, security, code style, API reference, testing guide, seed strategy, plan and current compliance audit.

## Live database and privacy checks

The active Supabase project has 34 migration-history entries. The repository's latest applied migration versions match the remote ledger. The database contains the private eligibility ledger, anonymous answer storage, feedback version history, rate-limit ledger and data-deletion request workflow.

Read-only RLS inspection confirmed:

- Student course SELECT policy requires a published course and a matching course_enrollments row.
- Student feedback SELECT requires an enrollment in the related published course and an open form, or a consumed eligibility record for a completed form.
- public.anonymous_submissions has an explicit deny-direct-access policy for anon/authenticated.
- Authenticated users have no direct SELECT or INSERT grant on private.data_deletion_requests.
- Selected admin/security RPCs deny anon execution and require the administrator role plus AAL2 inside the database.

New anonymous_submissions rows do not store student identifiers or eligibility references. Eligibility is separately stored in private.feedback_eligibility. Legacy public.responses historically stores student_id alongside answers; it was empty at cutover and remains for compatibility/retention. Do not claim cryptographic anonymity. Timing inference, complementary suppression and repeated-query differencing still need independent review.

Deletion requests can be submitted by users and reviewed/audited by AAL2 administrators. The application has no privileged Supabase service-role credential, so an authorized project owner must perform and verify Auth-user deletion before a request is marked complete.

The live database currently has one course and one feedback form, no student/instructor accounts and no feedback submissions. Real student data has not been used for these verification steps.

## Deployment status

- PR #2 remains open and draft.
- The latest application-code commit 2948614 has passing GitHub CI but no Vercel deployment associated with that exact SHA.
- The newest READY feature-branch deployment currently visible is an earlier commit (cea171f8) and is not the current application commit.
- The production alias still points to an older main deployment. Current feature branch changes are not deployed to the production alias.
- Vercel Preview and Production environments share the same Supabase project URL. Treat preview writes as production writes; use a separate staging Supabase project before browser E2E that creates records.
- A network smoke test from the available execution environment could not reach the Vercel hostname because DNS resolution was unavailable. Do not claim a live browser smoke test was completed.

## Master-prompt section status

| Section | Status | Evidence / remaining work |
|---|---|---|
| 1. Engineering role and quality | PARTIAL | Feature branch and CI pass; end-to-end acceptance not met. |
| 2. Existing project audit | PARTIAL | Repository, routes, schema, DB, CI and deployment reviewed; browser link/button/console audit open. |
| 3. Product and personas | PASS | PRD describes student, instructor and administrator workflows. |
| 4. Technology stack | PASS | Next.js 15.5.28, React 19, TypeScript, Supabase, Prisma schema tooling, Zod and exports. |
| 5. Roles and permissions | PARTIAL | RBAC/RLS and AAL2 controls exist; exhaustive role-matrix and IDOR tests open. |
| 6. Core application functionality | PARTIAL | Core academic, feedback, student, admin and instructor flows present; privacy-reviewed comments and advanced reporting remain open. |
| 7. Database design | PARTIAL | Entity model, RLS and anonymity/eligibility separation present; full migration replay on disposable DB and adversarial role matrix open. |
| 8. Application security | PARTIAL | Auth, RLS, Zod, same-origin checks, rate limits, headers, audit and MFA gates; adversarial XSS/CSRF/IDOR and secret-history scan open. |
| 9. Privacy, minors and deletion | PARTIAL | Technical privacy docs and deletion request flow; actual Auth deletion owner operation, consent/minor policy and legal approval open. |
| 10. Navigation and clickable elements | PARTIAL | Core navigation, search result filters, landing/footer and custom errors exist; complete browser click/link audit open. |
| 11. Smart search | PASS | Debounced authorized search, filtered result navigation and per-user rate limit; answer text excluded. |
| 12. SEO and page structure | PARTIAL | Metadata, canonical/OG, robots/sitemap and private noindex exist; contact/refund pages remain noindex and institution domain approval is open. |
| 13. Authentic product content | PASS | No fabricated partnerships, testimonials or live metrics; public preview data is labelled illustrative. |
| 14. Performance | BLOCKED | No Lighthouse or field Core Web Vitals measurements yet. |
| 15. UI/UX and accessibility | PARTIAL | Responsive interface exists; WCAG 2.2 AA, contrast, keyboard and screen-reader checks unverified. |
| 16. Public website | PARTIAL | Landing, About, Contact, Features, footer and refund info exist; verified institutional support details remain missing. |
| 17. Legal/privacy policies | BLOCKED | Policy pages are technical drafts; institution identity, jurisdiction, legal basis, retention, student-minor policy and legal approval required. |
| 18. Product analytics | NOT APPLICABLE to current build | No third-party analytics provider is configured. Do not add non-essential tracking without an approved consent decision. |
| 19. Documentation | PASS | PRD, architecture, security, code style, AGENTS, plan, API, testing and seed-strategy docs present. |
| 20. Project structure | PASS | Existing App Router structure is modular; no empty scaffolding added. |
| 21. Testing and QA | PARTIAL | 28 Vitest files/103 tests and CI build pass; integration, Playwright, RLS, accessibility and device tests open. |
| 22. Final quality checklist | PARTIAL | Selected controls verified; production, browser, privacy, legal and performance gates open. |
| 23. Implementation roadmap | PARTIAL | Core phases implemented; final QA/release phase not complete. |
| 24. Engineering report | PARTIAL | This report records evidence and blockers; final PASS report awaits release-gate evidence. |
| 25. Production-ready goal | BLOCKED | No current exact-SHA Vercel deployment; owner/institution gates remain. |

## Remaining release blockers

1. Exact-SHA deployment and smoke test: application commit 2948614 has no Vercel build/preview. Production alias is older. Resolve Vercel deployment availability before sign-off.
2. Disposable staging: Preview and Production share the current Supabase project; write-based E2E requires an isolated QA database.
3. Supabase Auth settings: leaked-password protection is disabled in the Security Advisor. Current Supabase project is Free tier; upgrade or a documented risk decision is required.
4. Admin MFA: the active administrator must personally enroll and verify TOTP AAL2.
5. Backup/restore: no restore drill evidence; downloadable database backups require a paid Supabase plan.
6. Legal/consent: institution/controller identity, verified contacts, jurisdiction, minor/student policy, legal basis, retention and policy approval must be supplied.
7. Accessibility/performance: no WCAG 2.2 AA audit, viewport matrix or Lighthouse/Core Web Vitals results.
8. Anonymity: minimum-five suppression is not proof against differencing; timing/re-identification review remains, and free-text comment release is not implemented.

## Release recommendation

Keep PR #2 in draft. Do not merge into main or promote this branch until staging, current exact-SHA deployment, role-specific E2E, adversarial security/privacy tests, accessibility/performance evidence and institution/owner decisions are complete.
