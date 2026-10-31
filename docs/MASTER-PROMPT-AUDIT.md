# Master Prompt Compliance Audit

**Audit date:** 2026-11-01  
**Prompt reviewed:** `ULTIMATE MASTER DEVELOPMENT PROMPT — SMART COURSE FEEDBACK & ANALYTICS PORTAL` (1,926 lines / 25 sections)  
**Repository reviewed:** `akashsharmapb09-cpu/coursePulse.site`, branch `feat/master-prompt-completion`  
**Production:** `https://coursepulse-production.vercel.app`

## Executive verdict

**NOT COMPLETE — release gates remain open.** The feature branch now includes the privacy-separated submission model, role-aware course/feedback workflows, admin/academic management, filtered analytics and exports. It is not production-ready until browser E2E, adversarial security testing, accessibility/performance/backup evidence, owner MFA and legal approval are complete.

This is a source-code and configuration audit. A feature is not marked PASS merely because a route or component exists. The user-facing and real database behavior must be tested before sign-off.

## Verified baseline

This section supersedes the historical baseline further down this document. The detailed section-by-section table below was written against an early `main` snapshot and must not be read as the current feature status; see `docs/plan.md` for the live gap list.

- Latest reviewed feature commit: `17097af2c80b5e58287e9cd86b339a8134abe571` on `feat/master-prompt-completion`.
- GitHub CI run #210 passed dependency audit (0 reported npm vulnerabilities), Prisma validation, TypeScript, 13 Vitest files / 47 tests, and Next.js production build.
- Supabase project has 24 migration-history entries. Repository migration filenames now match all 24 remote version/name entries; the local SQL source is preserved and the student-completion RPC migration is represented.
- Supabase smoke checks passed for filtered aggregate analytics, rating distributions, response trends, anonymous date precision and expired-deadline enforcement.
- Supabase Security Advisor currently reports one warning: leaked-password protection is disabled. Performance Advisor reports unused-index INFO notices; do not drop indexes without workload evidence.
- Exposed app tables use RLS and scoped policies; private answer-eligibility storage is not directly accessible through the Data API.
- The admin account is verified and has ADMIN role. The app requires TOTP AAL2 for admin paths; owner MFA enrollment still needs to be completed and verified.
- Current production has not been updated to this feature commit. Vercel previously rejected deployment creation because the Hobby daily deployment API quota was exhausted; do not merge or promote until a current preview is available and verified.
- Browser E2E, RLS/IDOR/XSS/CSRF attack tests, WCAG 2.2 AA review, responsive-device matrix, Core Web Vitals, backup/restore and production smoke-signoff remain open.
- Privacy/terms/cookie pages remain technical drafts and require institution/legal approval.

## Section-by-section result

| Master prompt section | Status | Audit result |
|---|---|---|
| 1. Role and expectations | PARTIAL | A working implementation exists, but the required full audit, feature coverage, tests, and final acceptance evidence are not complete. |
| 2. Existing project audit | PARTIAL | Repository, dependencies, routes, schema, auth, headers, and deployment were inspected in this review. No complete pre-change audit report, broken-link sweep, secret-history scan, console audit, or viewport test evidence was found. |
| 3. Project overview | PARTIAL | The product domain and three roles are reflected in the code. Department, semester, enrollment, institution-wide workflows, and complete user journeys are absent. |
| 4. Technology stack | PARTIAL | Next.js App Router, React, TypeScript, Tailwind, Lucide, Zod, Supabase/Postgres, and a Prisma schema exist. shadcn/ui, Recharts, Framer Motion, React Hook Form, and a real Prisma-backed application data layer are not present. |
| 5. Roles and permissions | PARTIAL | STUDENT, INSTRUCTOR, and ADMIN roles plus server-side checks and RLS exist. User/role management, instructor assignment, department/semester management, and admin audit logging UI are missing. |
| 6. Core application features | PARTIAL | Basic auth, courses, one-question form creation, student response submission, aggregate analytics, and export endpoints exist. Many required workflows listed below are missing or incomplete. |
| 7. Database design and minimization | PARTIAL | Four tables, foreign keys, constraints, indexes, RLS, and retention exist. The broader entity model (profiles, departments, enrollment, instructor assignment, semesters, eligibility/submission separation, comments, audit logs, consent, deletion requests) is not implemented. |
| 8. Security | PARTIAL | Auth provider, server-side role checks, input schemas, RLS, restricted grants, and several security headers exist. Rate limiting, CSRF/Origin controls, CSP, security test suite, admin audit log, MFA enforcement, secret scanning evidence, and session/password recovery controls are missing or unverified. |
| 9. Privacy, children, deletion | PARTIAL | Basic minimization and retention are present. Anonymous eligibility/answer separation, a user deletion-request workflow, consent records, children's data process, cookie consent, and a published privacy policy are absent. |
| 10. Navigation and clickable-element audit | PARTIAL | Logo links to the dashboard and the current dashboard navigation works at a basic level. A full clickable-element audit, public footer, email/telephone links, deep-linked KPI cards, and all prompt navigation destinations are absent. |
| 11. Smart search | FAIL | No global permission-aware search UI or search API exists. |
| 12. SEO and page structure | FAIL | Root redirects to login; there is no public marketing landing page, sitemap, robots route, canonical/OG setup, or per-page metadata strategy. Private routes are not explicitly documented as noindex in metadata. |
| 13. No AI-generated filler | PARTIAL | No AI-generated features or fabricated testimonials were found in the inspected app. A full content truthfulness audit has not been recorded. |
| 14. Performance | FAIL | No Lighthouse or Core Web Vitals measurements are recorded. The under-2-second target, INP, CLS, mobile/desktop route performance, and query latency have not been measured. |
| 15. Premium UI/UX and accessibility | PARTIAL | The existing interface has a coherent custom design and responsive CSS breakpoints. The requested palette/components differ; contrast, WCAG 2.2 AA, keyboard, focus, assistive technology, and the full viewport matrix are not tested. |
| 16. Website experience | FAIL | No public landing page, full footer, feature/about/contact pages, sticky public CTA, dedicated feedback thank-you page, or branded custom 404/error boundary was found. |
| 17. Legal/privacy pages | FAIL | Privacy, terms, and cookie preference pages/components are absent. Refund policy is conditional on payment; the product must first establish whether it is free or paid before policy wording is created. |
| 18. Product analytics installation | FAIL | No analytics provider/configuration or consent-aware event delivery was found. |
| 19. Documentation | PARTIAL | README, security documentation, Prisma schema, environment example, migrations, and a small test exist. PRD, architecture, codestyle, AGENTS, plan, seed, API reference, and testing documentation are missing. |
| 20. Recommended project structure | PARTIAL | The current small App Router structure is modular enough for the implemented scope, but the student/instructor/admin modules, services, security helpers, and test layers from the proposed structure are largely absent. |
| 21. Testing and QA | PARTIAL | Typecheck, production build, npm audit, and five export-focused unit tests pass. There is no evidence of integration, E2E, browser, RLS role-matrix, IDOR, CSRF, XSS, rate-limit, navigation, SEO, accessibility, or performance testing. |
| 22. Final security and quality checklist | FAIL | A subset of security/deployment items is verified; most detailed security, privacy, functionality, SEO, performance, accessibility, and documentation checkboxes remain open. |
| 23. Implementation roadmap | PARTIAL | Foundation phases have been implemented, but there is no `plan.md` and phases for full dashboards, administration, analytics/comparison, search, SEO, legal/privacy, hardening, QA, and full documentation are not complete. |
| 24. Final engineering report | PARTIAL | This audit records current evidence and remaining risks. Several measurements and security tests still need to be executed before a final PASS report is possible. |
| 25. Final senior developer instruction | PARTIAL | The project is deployed and some hardening is verified, but the final product goal is not achieved yet. |

## Core functional gaps

### Authentication and account lifecycle

**Present:** signup, password login, logout, email confirmation callback, protected dashboard route, server-side profile/role lookup.

**Missing or not verified:** forgot password, recovery completion, authenticated password change, session revocation after credential change, account suspension, user enumeration resistance tests, login/signup/password-reset rate limits, and admin MFA enforcement.

### Student experience

**Present:** published course visibility under RLS, open form listing, response submission, duplicate submission constraint.

**Missing:** enrollment model, pending/completed state, submission history, course codes, instructor/department details, due dates, participation progress, and course-specific feedback deadlines.

### Feedback form management

The dashboard's quick-create form creates exactly one question and exposes only rating or text in its UI. The API schema supports up to 30 questions and additional types, but this is not a complete administrator form builder.

Missing UI/workflows include form list management by admin, edit/delete, activate/deactivate, deadlines, assign-to-course workflows, question add/edit/delete/reorder, categories, mandatory configuration, and form version/change controls.

### Anonymous feedback

The current `responses` table stores `student_id` alongside `answers` and has a unique constraint on `(feedback_id, student_id)`. This prevents duplicate submissions but keeps a direct identity-to-response relationship. Instructors are denied raw response reads and the aggregate RPC suppresses groups under five; administrators have a raw-response read policy.

**Therefore the current design is access-restricted/pseudonymous feedback, not anonymous feedback as specified.** The prompt explicitly requires separating eligibility from anonymous answers. This requires a redesigned submission/eligibility model and careful migration; the current UI should not promise complete anonymity.

### Instructor and administrator experiences

The same dashboard component is rendered for all roles with some role-based controls. There is no separate full admin console.

Missing: instructor KPI suite, category charts, rating distribution, semester trends, anonymized comments/theme views, historical comparison, and course comparison. Admin user/role, instructor assignment, department, semester, form/question, settings, audit-log, institution KPI, low-participation, and department comparison workflows are missing.

### Analytics and exports

**Present:** database-backed aggregate RPC, course scoping, minimum group size 5, CSV/XLS/XLSX/PDF export API.

**Missing:** all prompt filters, chart visualizations, category/semester/institution comparisons, course comparison UI, report metadata (instructor/semester/category trends), and an XLSX download link in the dashboard UI. The XLS endpoint is documented as an HTML Spreadsheet document served with an Excel MIME type, not a native BI workbook.

## Security and operational gaps

- CSP was not present in the inspected live response.
- Rate limiting/distributed throttling and bot protection were not found in the app.
- CSRF token / Origin / Referer checks for mutations were not found in the inspected handlers.
- No dedicated security integration/E2E test suite exists.
- No admin action audit log table or UI exists.
- The current response model retains student identity mapping; this conflicts with the required anonymous-submission separation.
- Private file storage/upload flows are not implemented; this item is not currently applicable to an app with no upload feature, but must be addressed before adding uploads.
- No webhooks or AI features were found; webhook signature and prompt-injection controls are therefore not applicable to the current feature set.
- The PostgreSQL default-privilege hardening migration covers objects created by role `postgres`; the Supabase-managed `supabase_admin` role retains its existing default ACL. Review this with Supabase's managed-role constraints before claiming blanket future-object defaults are hardened.
- Production environment listing showed Supabase URL, publishable key, and app URL. `DATABASE_URL` and `DIRECT_URL` for Prisma CLI operations were not present in the reviewed Vercel environment list. The runtime app currently uses Supabase session clients rather than Prisma queries.
- No repository-history secret scan or verified credential rotation report was found. `.gitignore` excludes `.env*` other than `.env.example`; this is not a substitute for a historical scan.

## SEO, content, and public site

The root currently sends signed-out visitors to `/login`. There is no public landing page carrying the prompt's specified headline, description, and CTAs. No privacy/terms/contact/features pages or footer exist. There are no sitemap/robots endpoints or Open Graph/canonical strategy. The current shared metadata gives the login page a title/description but does not satisfy the per-page SEO requirements.

## Documentation and QA gaps

Existing: `README.md`, `docs/SECURITY.md`, `prisma/schema.prisma`, `.env.example`, `.gitignore`, five Supabase migrations, `tests/exports.test.ts`.

Missing: `PRD.md`, `architecture.md`, `codestyle.md`, `AGENTS.md`, `plan.md`, seed script, API documentation, testing guide, and dedicated integration/E2E/security test directories. The current five tests focus on CSV escaping, spreadsheet formula neutralization, aggregate projection, empty CSV headers, and XLSX archive generation.

## Prioritized completion plan

1. **Privacy model redesign:** separate eligibility/duplicate prevention from anonymous answer storage; define exactly what admins may see; migrate safely; update UI copy and test instructor/admin/student RLS.
2. **Identity lifecycle:** password recovery/change, session invalidation, suspension, MFA policy, rate limits, generic auth responses, and audit trails.
3. **Admin management:** users/roles, instructors, departments, semesters, courses/assignments, form/question lifecycle, deadlines, settings, audit logs.
4. **Student experience:** enrollments, pending/completed forms, deadlines, participation, history, submission confirmation.
5. **Instructor analytics:** real charts, course/category/semester filters, historical trends, anonymized comment treatment, insights, course comparison.
6. **Reporting:** complete UI download options and context-rich reports, preserving aggregate privacy.
7. **Search/navigation:** permission-aware global search and a full link/button audit.
8. **Public website/SEO/legal:** landing page, verified content, footer, policy pages reviewed by the institution, cookie controls if needed, metadata, canonical, robots, sitemap, OG, and custom error pages.
9. **Security hardening:** CSP, CSRF/Origin, distributed rate limiting, bot controls where appropriate, secret/history scanning, RLS role-matrix tests, IDOR/XSS tests, privacy and admin audit.
10. **Accessibility/performance:** WCAG 2.2 AA review, full viewport/browser tests, Lighthouse and real Core Web Vitals measurements, pagination/query optimization.
11. **Documentation/QA:** required documentation set, seed strategy, API docs, integration/E2E/security tests, final evidence-backed report.
12. **Deployment sign-off:** production smoke tests for all roles and flows after migrations; verify backups/restore strategy and cron execution history.

## Owner/institution inputs needed later

The code can be prepared without inventing these facts, but production policy copy and institution workflows require decisions from the owner/institution: institution name/branding, department and semester catalogue, verified support contact, academic deadlines, whether students may be minors and the institution's consent policy, data retention/legal basis, paid/free status, and analytics/cookie-consent policy.

## Sign-off

**Current status: NOT READY for the master prompt's final acceptance.**

Production deployment is healthy for the current implemented scope, but production health is not equivalent to feature completeness. Do not mark the whole master prompt PASS until all missing items above are implemented and independently tested.