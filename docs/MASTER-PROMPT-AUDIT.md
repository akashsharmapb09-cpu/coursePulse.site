# CoursePulse master-prompt compliance audit

Audit date: 1 November 2026  
Repository: akashsharmapb09-cpu/coursePulse.site  
Branch / reviewed commit: feat/master-prompt-completion / cfe8fb5da84f1a2fb9d6574901d9646b28723041  
Pull request: #2, open and draft  
Production alias: https://coursepulse-production.vercel.app

## Executive verdict

PARTIAL — not approved for production release. The feature branch builds and automated CI passes. The product scope is substantially implemented, but verified browser E2E, adversarial database security checks, accessibility/performance measurements, legal approval and a current exact-commit Vercel preview are still missing. CI passing does not imply that the entire master prompt has passed.

## Latest automated evidence

GitHub Actions runs #308 and #309 completed successfully for commit cfe8fb5 on 1 November 2026:

- npm audit --audit-level=moderate: 0 reported npm vulnerabilities.
- Prisma schema validation: PASS.
- TypeScript: PASS.
- Vitest: 27 test files / 100 tests PASS.
- Next.js production build: PASS.

CI uses placeholder public Supabase settings for build-time compilation. It does not log in to real accounts, exercise live database role policies, run browser E2E or verify production credentials.

## Implemented scope

- Three roles with server-side profile lookup, RLS and admin TOTP AAL2 gates.
- Separate new anonymous answer store and private eligibility/duplicate-prevention ledger. The legacy public.responses table remains for compatibility; it was empty at cutover and must not be described as anonymous legacy data.
- Multi-question feedback forms with rating, number, single/multiple choice, multiple select, yes/no, short/long text, seven categories, stable question IDs, reorder controls, deadlines, lifecycle and version restore.
- Course management, course codes, departments, semesters, student enrollment and instructor assignments.
- Student pending/completed forms, anonymous submission, confirmation, profile update and deletion-request history.
- Instructor/admin filtered aggregate analytics, rating distributions, donut charts, sentiment bars, reportable category-weighted radar, weekly trends, two-course comparison and CSV/XLS/XLSX/PDF exports.
- Admin user management, audit history, academic setup, institution overview, low-participation alerts and deletion-request review.
- Password reset/change flow, per-user mutation rate limits and permission-aware debounced search.
- Public landing page, features and footer, technical legal pages, canonical/OG metadata, robots/sitemap, custom 404 and error pages.
- Current GitHub CI and updated PRD, architecture, security, code-style, API, testing, seeding and release-plan documentation.

## Database and privacy evidence

The active Supabase project currently has 34 migration-history entries. The live schema includes application roles and policies, the private eligibility ledger, anonymous answer storage, feedback version history, per-user rate limits and privacy deletion-request records.

New anonymous_submissions rows do not store student identifiers or eligibility references. Eligibility is separately stored in private.feedback_eligibility. Legacy public.responses historically includes student_id next to answers; it was empty at the anonymous cutover and remains for compatibility/retention. Do not claim cryptographic anonymity. Timing inference, complementary suppression and repeated-query differencing still need independent review.

Selected database checks verified that the admin overview and deletion-request RPCs are not executable by anon, and that authenticated users have no direct SELECT/INSERT grants on the private deletion-request table. This is not a full RLS role matrix.

Deletion requests can be submitted by a user and reviewed/audited by an AAL2 administrator. The app has no privileged Supabase service-role credential; an authorized owner must perform and verify Auth-user deletion before a request is marked complete.

Minimum-five suppression alone does not prove resistance to complementary suppression or re-identification. A privacy-reviewed anonymized free-text comment workflow is not implemented.

## Deployment status

- PR #2 is open and draft.
- The latest READY Vercel preview is commit f4f7ba3, older than current branch head cfe8fb5.
- The production alias still points to an older main deployment. Latest branch changes are not deployed to production.
- Recent later feature deployments returned Vercel build errors/rate-limit status. Do not merge or promote until Vercel can build the exact reviewed commit and the preview passes smoke checks.
- Vercel Preview and Production currently share the same Supabase project URL. Preview writes must be treated as production writes; use a disposable staging project for browser tests that create records.

## Master-prompt section status

| Section | Status | Evidence / remaining work |
|---|---|---|
| 1. Engineering role and quality | PARTIAL | Feature branch and CI exist; end-to-end acceptance not met. |
| 2. Existing project audit | PARTIAL | Repository, routes, schema, DB, CI and deployment reviewed; complete browser link/button/console audit open. |
| 3. Product and personas | PASS | PRD describes student, instructor and admin workflows. |
| 4. Technology stack | PASS | Next.js 15.5.28, React 19, TypeScript, Supabase, Prisma schema tooling, Zod and export stack. |
| 5. Roles and permissions | PARTIAL | RBAC/RLS and AAL2 controls exist; exhaustive role-matrix and IDOR tests open. |
| 6. Core application functionality | PARTIAL | Core academic, feedback, student, admin and instructor flows present; advanced workflows remain open. |
| 7. Database design | PARTIAL | Entity model, RLS and anonymous/eligibility separation present; full migration replay on disposable DB and role matrix open. |
| 8. Application security | PARTIAL | Auth, RLS, Zod, same-origin checks, rate limits, headers, audit and MFA gates; adversarial XSS/CSRF/IDOR and secret-history scan open. |
| 9. Privacy, minors and deletion | PARTIAL | Technical privacy docs and deletion request flow; actual Auth deletion owner operation, consent/minor policy and legal approval open. |
| 10. Navigation and clickable elements | PARTIAL | Core navigation, landing/footer and custom errors exist; full browser click/link audit open. |
| 11. Smart search | PASS | Debounced permission-aware search with per-user API rate limit; answer text excluded. |
| 12. SEO and page structure | PARTIAL | Metadata, canonical/OG, robots/sitemap and private noindex exist; only public root is in sitemap; actual domain/content review open. |
| 13. Authentic product content | PASS | No fabricated partnership, testimonial or live KPI claims; hero illustration is labelled as illustrative. |
| 14. Performance | BLOCKED | No Lighthouse or field Core Web Vitals measurement yet. |
| 15. UI/UX and accessibility | PARTIAL | Custom responsive interface exists; WCAG 2.2 AA, focus, contrast, keyboard and screen-reader checks unverified. |
| 16. Public website | PARTIAL | Landing/features/footer, thank-you, 404 and error pages exist; verified about/contact content remains open. |
| 17. Legal/privacy policies | BLOCKED | Pages are technical drafts; institution identity, jurisdiction, legal basis, retention, minor policy and legal approval required. |
| 18. Product analytics | NOT APPLICABLE to current build | No third-party analytics provider is configured. Do not add non-essential tracking without an approved consent decision. |
| 19. Documentation | PARTIAL | PRD, architecture, security, code style, AGENTS, plan, API, testing and seed strategy docs exist; owner-specific operating details remain. |
| 20. Project structure | PASS | Existing App Router structure is modular; no empty scaffolding added. |
| 21. Testing and QA | PARTIAL | 27 Vitest files/100 tests and CI build pass; integration, Playwright, RLS, accessibility and device tests open. |
| 22. Final quality checklist | PARTIAL | Selected controls verified; production, browser, privacy, legal and performance gates open. |
| 23. Implementation roadmap | PARTIAL | Core phases implemented; final QA/release phase not complete. |
| 24. Engineering report | PARTIAL | This report records evidence/blockers; final PASS report awaits release-gate evidence. |
| 25. Production-ready goal | BLOCKED | No current exact-SHA preview or production deployment; owner/institution gates remain. |

## Remaining release blockers

1. Exact-SHA preview and smoke test: current feature head cfe8fb5 has no verified Vercel preview; production alias is older. Project owner must resolve Vercel deployment quota/upgrade status.
2. Disposable staging: preview and production currently share the same Supabase project; write-based E2E requires isolated QA database.
3. Supabase Auth settings: leaked-password protection is disabled in the security advisor. The current project is Free tier; upgrade or documented risk decision is required.
4. Admin MFA: active administrator must personally enroll and verify TOTP AAL2.
5. Backup/restore: no restore drill evidence; downloadable database backups require a paid Supabase plan.
6. Legal/consent: institution/controller identity, verified contacts, jurisdiction, minor/student policy, legal basis, retention and policy approval must be supplied.
7. Accessibility/performance: no WCAG 2.2 AA audit, viewport matrix or Lighthouse/Core Web Vitals results.
8. Anonymity: minimum-five suppression is not proof against differencing; timing/re-identification review remains, and free-text comment release is not implemented.

## Release recommendation

Keep PR #2 in draft. Do not merge into main or promote this branch until staging, current exact-SHA preview, role-specific E2E, adversarial security/privacy tests, accessibility/performance evidence and institution/owner decisions are complete.
