# CoursePulse master-prompt compliance audit

Audit date: 2 November 2026  
Repository: akashsharmapb09-cpu/coursePulse.site  
Branch: feat/master-prompt-completion  
Latest application commit reviewed: 6a4512289c33298531df6ea55bac9132741e7b16  
Pull request: #2, open and draft  
Production alias: https://coursepulse-site.vercel.app

## Executive verdict

PARTIAL — not approved for production release. The latest feature branch has a passing CI build and a READY exact-SHA Vercel preview. The core student, instructor, administrator, academic, feedback, search, analytics and public-site functionality is substantially implemented. Production readiness still requires browser/E2E and adversarial privacy/security tests, accessibility/performance evidence, administrator MFA enrollment, Supabase Auth security configuration, institution-approved legal wording, and production smoke/sign-off.

A successful build is not proof of complete end-to-end operation.

## Latest automated evidence

GitHub Actions runs #382 (push) and #383 (pull request) completed successfully for commit `6a4512289c33298531df6ea55bac9132741e7b16` on 2 November 2026:

- npm audit --audit-level=moderate: 0 reported vulnerabilities.
- Prisma schema validation: PASS.
- TypeScript: PASS.
- Vitest: 34 test files / 130 tests PASS.
- Next.js production build: PASS; static pages 19/19 generated.

Vercel built the same exact SHA and marked preview deployment `dpl_27TdEpa7g5ksA9b3pxTYEgjN7FeX` READY at `https://coursepulse-site-b2drs22w1-akashsharmapb09-8177.vercel.app`. This deployment is a preview (`target=null`), not a production promotion. The production alias `https://coursepulse-site.vercel.app` is still assigned to the older feature-branch deployment at commit `2c4bdbed42eceee3de8a2a89c1058f35c95fb7f4`.

The workflow uses placeholder public Supabase settings for build-time rendering. It does not authenticate real accounts, run browser E2E, exercise every live RLS policy, or verify provider settings. Browser access to the latest Vercel preview was unavailable from the current runner, so URL/browser smoke-test status remains NOT VERIFIED.

## Implemented scope

- Three roles with server-side profile lookup, RLS and admin TOTP AAL2 gates.
- Separate new anonymous answer store and private eligibility/duplicate-prevention ledger. The legacy public.responses table remains for compatibility and was empty at cutover; it must not be described as anonymous legacy data.
- Multi-question feedback forms with rating, number, choice, multiple select, yes/no and text types; seven categories; stable question IDs; reorder; deadlines; lifecycle and version restore.
- Course management, course codes, departments, semesters, student enrollment and instructor-course assignments.
- Student pending/completed form state, submission confirmation, eligible-form completion progress, display-name updates and deletion-request tracking.
- Instructor/admin aggregate analytics, filters, rating distributions, donut charts, sentiment bars, reportable category-weighted radar, weekly trends, two-course comparison and CSV/XLS/XLSX/PDF exports.
- Admin user management, audit history, academic setup, institution overview, low-participation alerts and deletion-request review.
- Password reset/change, same-origin mutation checks, per-user rate limits and permission-aware debounced search with filtered navigation.
- Public landing page with required headline/CTAs, About and Contact pages, Features section, footer, honest free-project refund information, technical policy pages, canonical/OG metadata, robots/sitemap, custom 404/error pages, SVG icon and web-app manifest.
- PRD, architecture, security, code style, API reference, testing guide, seed strategy, plan and current compliance audit.

## Live database and privacy checks

The active Supabase project has 35 migration-history entries, including the aligned `20261102051456_coursepulse_report_rate_limits` migration. The repository migration versions match the remote ledger. The database contains the private eligibility ledger, anonymous answer storage, feedback version history, rate-limit ledger and data-deletion request workflow.

Read-only RLS inspection confirmed:

- Student course SELECT policy requires a published course and matching course_enrollments row.
- Student feedback SELECT requires enrollment in the published course and an open form, or a consumed eligibility record for a completed form.
- public.anonymous_submissions has an explicit deny-direct-access policy for anon/authenticated.
- Authenticated users have no direct SELECT or INSERT grant on private.data_deletion_requests.
- Selected admin/security RPCs deny anon execution and require administrator role plus AAL2 inside the database.
- The daily `coursepulse-retention-cleanup` cron job is active (`17 20 * * *` UTC); two successful runs are recorded, latest on 1 November 2026 20:17 UTC. The cleanup RPC is executable by `service_role` only. A rollback-only expiry smoke test proved old legacy and anonymous answers plus expired rate-limit rows are deleted; no QA rows persisted.
- All 10 public tables have RLS enabled. The report-rate-limit migration's authenticated analytics/export paths return allowed in a rollback-only check; `anon` cannot execute the private limiter.
- Rollback-only live-schema student/instructor integration tests passed course/enrollment scoping, one-time eligibility consumption, duplicate rejection, direct answer/eligibility read denial, five-response suppression, other-instructor course isolation, weekly response aggregation and free-text exclusion; post-rollback verification found zero synthetic rows persisted.

New anonymous_submissions rows do not store student identifiers or eligibility references. Eligibility is separately stored in private.feedback_eligibility. Legacy public.responses historically stores student_id alongside answers; it was empty at cutover and remains for compatibility/retention. Do not claim cryptographic anonymity. Timing inference, complementary suppression and repeated-query differencing still need independent review.

Deletion requests can be submitted by users and reviewed/audited by AAL2 administrators. The app has no privileged Supabase service-role credential, so an authorized project owner must perform and verify Auth-user deletion before a request is marked complete.

Current live project has one course and one feedback form, one active ADMIN account with one verified TOTP factor, no student/instructor accounts and no feedback submissions. These checks did not create synthetic student data in production.

## Deployment status

- PR #2 remains open and draft; it has not been merged.
- The intended college-demo deployment is the Vercel project `coursepulse-site` (project ID `prj_qUCS5b2uHOwwyqvOMg2FrC5uKnKd`) connected to `akashsharmapb09-cpu/coursePulse.site`.
- The verified project domain is `https://coursepulse-site.vercel.app`.
- Current exact-HEAD preview is READY at `https://coursepulse-site-b2drs22w1-akashsharmapb09-8177.vercel.app`, deployment `dpl_27TdEpa7g5ksA9b3pxTYEgjN7FeX`, branch `feat/master-prompt-completion`, commit `6a4512289c33298531df6ea55bac9132741e7b16`.
- Production alias `https://coursepulse-site.vercel.app` is assigned to older deployment `dpl_pFf7k7AZ9jftMMp4S5dnXSrsYNjw`, commit `2c4bdbed42eceee3de8a2a89c1058f35c95fb7f4`. The current HEAD has not been promoted to that alias.
- Browser smoke verification of the current preview is not evidenced; direct browsing from the available runner was unavailable.
- Preview and Production environments share the same Supabase project URL. Treat preview writes as production writes; use a disposable QA DB before running browser journeys that create records.

## Master-prompt section status

| Section | Status | Evidence / remaining work |
|---|---|---|
| 1. Engineering role and quality | PARTIAL | Feature branch and CI pass; end-to-end acceptance not met. |
| 2. Existing project audit | PARTIAL | Repository, routes, schema, DB, CI and deployment reviewed; browser link/button/console audit and smoke test open. |
| 3. Product and personas | PASS | PRD describes student, instructor and admin workflows. |
| 4. Technology stack | PASS | Next.js 15.5.28, React 19, TypeScript, Supabase, Prisma schema tooling, Zod and exports. |
| 5. Roles and permissions | PARTIAL | RBAC/RLS and AAL2 controls exist; exhaustive role-matrix, cross-resource IDOR and re-identification tests open. |
| 6. Core application functionality | PARTIAL | Core academic, feedback, student, admin and instructor flows present; privacy-reviewed comments and advanced reporting remain open. |
| 7. Database design | PARTIAL | Entity model, RLS and anonymity/eligibility separation present; full migration replay on disposable DB and adversarial role matrix open. |
| 8. Application security | PARTIAL | Auth, RLS, Zod, same-origin checks, rate limits, headers, audit and MFA gates; adversarial XSS/CSRF/IDOR and secret-history scan open. |
| 9. Privacy, minors and deletion | PARTIAL | Technical privacy docs and deletion request flow; actual Auth deletion owner operation, consent/minor policy and legal approval open. |
| 10. Navigation and clickable elements | PARTIAL | Core navigation, search-result filters, landing/footer and custom errors exist; complete browser click/link audit open. |
| 11. Smart search | PASS | Debounced authorized search, filtered result navigation and per-user rate limit; answer text excluded. |
| 12. SEO and page structure | PARTIAL | Metadata, canonical/OG, robots/sitemap, private noindex, SVG icon and manifest exist; final custom-domain and browser validation open. |
| 13. Authentic product content | PASS | No fabricated partnerships, testimonials or live metrics; hero artwork is labelled illustrative. |
| 14. Performance | BLOCKED | No Lighthouse or field Core Web Vitals measurements yet. |
| 15. UI/UX and accessibility | PARTIAL | Responsive interface exists; WCAG 2.2 AA, contrast, keyboard and screen-reader checks unverified. |
| 16. Public website | PARTIAL | Landing, About, Contact, Features, footer, refund info and error pages exist; verified institution support details remain missing. |
| 17. Legal/privacy policies | BLOCKED | Policy pages are technical drafts; institution identity, jurisdiction, legal basis, retention, minor policy and legal approval required. |
| 18. Product analytics | NOT APPLICABLE to current build | No third-party analytics provider is configured. Do not add non-essential tracking without approved consent decision. |
| 19. Documentation | PASS | PRD, architecture, security, code style, AGENTS, plan, API, testing and seed strategy docs present. |
| 20. Project structure | PASS | Existing App Router structure is modular; no empty scaffolding added. |
| 21. Testing and QA | PARTIAL | 34 Vitest files/130 tests and exact-HEAD CI/Vercel preview build pass; integration, Playwright, full RLS, browser, accessibility and device tests open. |
| 22. Final quality checklist | PARTIAL | Selected controls verified; production, browser, privacy, legal and performance gates open. |
| 23. Implementation roadmap | PARTIAL | Core phases implemented; final QA/release phase not complete. |
| 24. Engineering report | PARTIAL | This report records evidence and blockers; final PASS report awaits release-gate evidence. |
| 25. Production-ready goal | BLOCKED | Exact-HEAD preview is ready, but the production alias still points to an older feature commit; browser smoke, staging and owner/institution gates remain. |

## Remaining release blockers

1. Public URL smoke: latest preview deployment is READY for exact HEAD, but root/login/signup/privacy routes and full browser journeys still need real-browser verification.
2. Auth redirects: the app builds callback URLs from `NEXT_PUBLIC_APP_URL`; confirm Supabase Auth Site URL and allowed redirect URL include `https://coursepulse-site.vercel.app/auth/confirm`, then test signup confirmation and password reset. The preview environment currently shares the production database and public app origin.
3. Disposable staging: Preview and Production share the live Supabase project; write-based browser E2E requires an isolated QA database.
4. Supabase Auth settings: leaked-password protection remains disabled in Security Advisor; enable where supported by the Free plan or document explicit risk acceptance.
5. Admin MFA: one active admin has a verified TOTP factor; verify fresh sign-in reaches AAL2 and recovery works.
6. Backup/restore: no restore drill evidence; downloadable database backups may require a paid Supabase plan.
7. Legal/consent: institution/controller identity, verified contacts, jurisdiction, student/minor policy, legal basis, retention and policy approval must be supplied.
8. Accessibility/performance: no WCAG 2.2 AA audit, viewport matrix or Lighthouse/Core Web Vitals results.
9. Authorization/security: exhaustive student/instructor/admin RLS matrix, cross-resource IDOR, XSS/CSRF and distributed abuse tests remain open.
10. Anonymity: minimum-five suppression is not proof against differencing; timing/re-identification review remains, and free-text comment release is intentionally not implemented.

## Release recommendation

Keep PR #2 in draft. Do not merge into main or promote this branch until public route smoke, isolated staging, role-specific E2E, adversarial security/privacy tests, accessibility/performance evidence and institution/owner decisions are complete.
