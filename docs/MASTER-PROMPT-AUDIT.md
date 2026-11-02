# CoursePulse master-prompt compliance audit

Audit date: 2 November 2026  
Repository: akashsharmapb09-cpu/coursePulse.site  
Branch: feat/master-prompt-completion  
Latest application commit reviewed: 01c4f461fb60905b3a1ed0f94745428353ec5d25  
Pull request: #2, open and draft  
Production alias: https://coursepulse-site.vercel.app

## Executive verdict

PARTIAL — the previous feature build is deployed to Vercel Production, but the newer feature branch hardening is not deployed yet and the project is not approved for real-college data or final production release. Core student, instructor, administrator, academic, feedback, search, analytics and public-site functionality is substantially implemented. Remaining release gates include exact-HEAD deployment and live-header verification, authenticated role journeys, adversarial privacy/security tests, accessibility/performance evidence, fresh admin MFA/recovery verification, Supabase Auth security configuration, institution-approved legal wording, backup/restore evidence and owner sign-off.

A successful build is not proof of complete end-to-end operation.

## Latest automated evidence

GitHub Actions PR validation run #385 completed successfully on 2 November 2026. It checked the PR merge candidate `7b0823302d7f740c4f73ae9d9287d89230892aaa`, which includes feature HEAD `cd4a5332c497d17d5c5d221cb20689bb8e46c22a`:

- npm audit --audit-level=moderate: 0 reported vulnerabilities.
- Prisma schema validation: PASS.
- TypeScript: PASS.
- Vitest: 34 test files / 130 tests PASS.
- Next.js production build: PASS; static pages 19/19 generated.

Vercel deployment `dpl_ETbYkFQdiTeJ7QB6dm5bPeeYQK7i` is `READY`, target `production`, and built exact feature SHA `cd4a5332c497d17d5c5d221cb20689bb8e46c22a`. Its aliases include `https://coursepulse-site.vercel.app`; a separate alias lookup confirmed that the production domain maps to this deployment. Browser-level functional smoke testing remains NOT VERIFIED.

The workflow uses placeholder public Supabase settings for build-time and local browser checks. The browser suite is being moved to the exact locally built production bundle so it does not rely on a stale hosted preview and does not write to Supabase. It does not authenticate real accounts, exercise every live RLS policy, or verify provider settings.

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
- Premium forest-green / warm-ivory workspace styling and consistent CoursePulse pulse mark across public, authentication and dashboard surfaces.
- Per-request nonce-based CSP using `script-src 'self' 'nonce-…' 'strict-dynamic'`, with no `unsafe-inline`, `unsafe-eval` or `data:` in `script-src`; `object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'` and `X-XSS-Protection: 0`.
- RFC 9116 `/.well-known/security.txt` with HTTPS contact/policy/expiry/canonical fields; repository private vulnerability reporting still requires owner-side enablement and verification.
- Static XSS sink regression checks prohibit raw HTML assignment, `dangerouslySetInnerHTML`, `document.write`, `eval` and `new Function` in app/components/lib code.
- Playwright browser coverage now checks actual CSP nonce propagation into executable script tags and the security.txt HTTP response.
- PRD, architecture, security, code style, API reference, testing guide, seed strategy, plan and current compliance audit.

## Live database and privacy checks

The active Supabase project has 36 migration-history entries through `20261102102457_coursepulse_private_fk_indexes`. The repository migration versions match the remote ledger. The new additive migration indexes the `reviewed_by` and `changed_by` foreign-key columns in private tables. A fresh performance advisor run no longer reports unindexed foreign keys; it still reports informational unused indexes on this low-traffic database. The database contains the private eligibility ledger, anonymous answer storage, feedback version history, rate-limit ledger and data-deletion request workflow.

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
- Previous feature HEAD `cd4a5332c497d17d5c5d221cb20689bb8e46c22a` remains deployed to Vercel Production as `dpl_ETbYkFQdiTeJ7QB6dm5bPeeYQK7i` (`READY`, target `production`); production alias `https://coursepulse-site.vercel.app` maps to it.
- Current feature HEAD `01c4f461fb60905b3a1ed0f94745428353ec5d25` is committed to `feat/master-prompt-completion` and remains in draft PR #2; it is not the current production deployment.
- Latest known READY branch-preview deployment is still the older CSP-helper commit `5aab9b17526ebd354ec22b81afddc89233a58fea`; therefore its HTTP headers do not yet verify the newer middleware/CSP/security.txt changes.
- A new Vercel deployment could not be created during this work because the Vercel API returned the account's `api-deployments-free-per-day` limit (HTTP 402). Do not claim the branch head is live or promote an unverified build.
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
| 8. Application security | PARTIAL | Auth, RLS, Zod, same-origin checks, rate limits, audit and MFA gates; nonce CSP, RFC 9116 security.txt and unsafe-sink regression tests added. Private reporting enablement, live header check and adversarial XSS/CSRF/IDOR review remain open. |
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
| 21. Testing and QA | PARTIAL | Unit/type/build checks and XSS/CSP contract tests pass on recent branch CI runs; exact-HEAD browser suite is being rerun locally against the build. Live deployment smoke, role-specific E2E, full RLS and device/accessibility evidence remain open. |
| 22. Final quality checklist | PARTIAL | Selected controls verified; production, browser, privacy, legal and performance gates open. |
| 23. Implementation roadmap | PARTIAL | Core phases implemented; final QA/release phase not complete. |
| 24. Engineering report | PARTIAL | This report records evidence and blockers; final PASS report awaits release-gate evidence. |
| 25. Production-ready goal | BLOCKED | Current branch HEAD is not deployed; only the earlier feature build is on the production alias. Exact-HEAD deploy, isolated staging, adversarial QA, accessibility/performance, legal and owner/institution sign-off remain. |

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

Keep PR #2 in draft. The current feature head is not yet serving the `.site` production alias. Do not merge into `main` or declare the college project fully accepted until the exact branch head is deployed, nonce CSP and security.txt are verified over HTTPS, public/browser and role-specific E2E pass, isolated staging and adversarial security/privacy tests are evidenced, accessibility/performance checks are complete, and Auth dashboard plus institution/owner decisions are signed off.
