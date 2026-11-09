# Master Prompt Completion Plan

Status: DONE means implementation and verification evidence exist; IN PROGRESS means partially implemented; NOT STARTED means missing; BLOCKED means owner decision or external capability is required.

## P0 — Privacy and data model
- [x] DONE: threat model and target separation documented.
- [x] DONE: migration design for eligibility and anonymous answer storage.
- [x] PARTIAL: atomic eligibility consumption and duplicate prevention without identity-answer mapping are implemented in the database RPC; full end-to-end verification and adversarial tests remain open.
- [x] DONE: no legacy response rows existed at migration time; legacy table retained under existing retention policy.
- [x] PARTIAL: RLS matrix and automated contract tests added; rollback-only live-schema tests passed for enrolled-course scope, eligible form visibility, anonymous eligibility consumption, duplicate prevention, direct answer/eligibility denial, instructor course scope, five-response threshold and free-text exclusion. Exhaustive role-matrix, IDOR and statistical re-identification testing remains open.
- [x] PARTIAL: app writes new answers to separate storage; completed-form visibility is eligibility-scoped; policy pages are technical drafts and require institution/legal review.

## P1 — Identity and security
- [x] DONE: password recovery/reset and signed-in password change are implemented. The change flow verifies the current password in an isolated Auth client, uses a dedicated per-user rate limit, and attempts global session revocation; real-account/session end-to-end verification remains open.
- [x] DONE: account suspension blocks application access through active-profile checks and role helper. Global token revocation remains outstanding.
- [x] DONE: admin workspace and admin RPCs require TOTP AAL2; user and academic actions write audit events.
- [x] DONE: database-backed per-user/action rate limits and same-origin checks cover course, form, response, admin and signed-in password-change mutations. Auth-provider rate limits still require dashboard verification.
- [x] DONE: per-request nonce-based strict CSP added through middleware. script-src uses nonce + strict-dynamic with no unsafe-inline/unsafe-eval/data sources; object-src/frame-src are none and frame-ancestors is none. Browser header/nonce verification is included in Playwright and awaits exact-HEAD browser run.
- [x] PARTIAL: password reset uses generic confirmation; consistent generic sign-in error normalization and provider-level rate-limit verification remain open.
- [x] DONE: CI gitleaks secret-history scan passes on current PR runs; static XSS sink regression test prohibits raw HTML assignment, document.write, eval and Function constructors.
- [x] DONE: RFC 9116 security.txt published under public/.well-known with HTTPS contact, policy, canonical and expiry fields. Owner must still enable and verify GitHub private vulnerability reporting.
- [ ] Supabase leaked-password protection (Auth dashboard setting, unavailable through current Free-tier integration) and credential-rotation evidence.

## P2 — Academic administration
- [x] PARTIAL: departments and semesters can be created and edited; semester active state can be changed; courses can be linked to departments/semesters; users can be assigned/cleared from departments through an MFA-protected, audited RPC. Full archival/lifecycle controls remain open.
- [x] DONE: student course enrollments and instructor-course assignments with scoped RLS.
- [x] DONE: MFA-protected user role/suspension API and console; last-active-admin guard.
- [x] DONE: admin institution overview with live counts, participation rate, reportable average rating, and privacy-safe low-participation alerts.
- [x] PARTIAL: course create/edit/archive/republish and feedback create/edit/open/close/deadline enforcement implemented; form-definition version snapshots and owner/admin restore are implemented; deletion recovery, scheduling and full lifecycle audit remain open.
- [x] DONE: admin audit table and privileged audit RPC. Append-only Data API grants (no direct INSERT/UPDATE/DELETE).

## P3 — Student experience
- [x] DONE: eligibility, pending and completed forms; closed completed forms remain visible only to the student who submitted.
- [x] DONE: students, instructors and admins can update their own display name through a column-scoped RLS-protected profile endpoint.
- [x] PARTIAL: users can submit and track deletion requests; admins can review and document outcomes with MFA. Actual Auth-user deletion must be carried out and verified through the institution's authorized Supabase process before a request is marked COMPLETED.
- [x] PARTIAL: optional deadlines are enforced by the database; students see their own eligible-form completion progress and history. Cohort-level participation is restricted to privacy-safe admin aggregates.
- [x] PARTIAL: multi-question response form supports rating, numeric, single-choice, multiple-choice, checkbox multiple selection, short/long text and Yes/No; questions can be assigned one of seven academic categories, reordered, and retain stable IDs when edited. Category filters are available in analytics and exports. WCAG/keyboard/screen-reader validation remains open.

## P4 — Instructor analytics
- [x] PARTIAL: assigned-course dashboard and aggregate metrics; additional instructor assignments are supported.
- [x] PARTIAL: course, semester, department, question-category and date filters, privacy-suppressed rating distributions with donut charts, rating sentiment bars, reportable category-weighted teaching-effectiveness radar (when at least three categories meet the threshold), weekly response trends and two-course comparison are implemented; weekly response trends remain course-wide rather than category-specific, and advanced longitudinal analysis remains open.
- [x] PARTIAL: two-course comparison uses the filtered aggregate RPC and minimum-five cohort suppression; multi-course comparison and statistical significance context remain open.
- [ ] Privacy-reviewed anonymized comment workflow remains open.
- [x] DONE: CSV, XLSX and PDF downloads use the shared aggregate service; legacy XLS is also available.

## P5 — Public site, search and SEO
- [x] PARTIAL: public landing page with required headline/CTAs, About and Contact information pages, Features section, complete footer and free-project refund information; verified institutional support contact/legal approval remain open.
- [ ] Privacy/terms pages are technical drafts and need institution/legal approval.
- [x] DONE: permission-aware debounced search across course titles/codes, feedback forms, departments, student-visible instructor names and admin-only user search. Search uses a per-user rate limit and excludes response text.
- [x] DONE: metadata, canonical, Open Graph, sitemap, robots and noindex for private routes.
- [x] DONE: custom not-found and error pages; full navigation audit remains open.

## P6 — QA and operations
- [x] PARTIAL: GitHub CI runs dependency audit, Prisma validation, TypeScript, Vitest (35+ files / 136+ tests on recent runs) and a Next.js production build; secret-history scan also passes. Real role-by-role integration and authenticated browser E2E remain open.
- [x] PARTIAL: selected rollback-only student/instructor RLS, duplicate-prevention and aggregate-suppression integration tests passed. Full role-matrix, cross-resource IDOR, adversarial XSS/CSRF and distributed abuse tests remain open.
- [x] PARTIAL: keyboard focus and 768px auth overflow regressions were fixed; automated Axe scans then exposed reduced-contrast animation frames. Entrance/scroll motion now moves via transforms without fading text opacity; exact-HEAD WCAG rerun remains in progress.
- [ ] WCAG 2.2 AA manual review, screen-reader review and full device matrix.
- [ ] Mobile/tablet/desktop browser matrix.
- [ ] Lighthouse/Core Web Vitals and query performance.
- [ ] Backup/restore evidence (downloadable backups require a paid Supabase plan).
- [x] PARTIAL: daily retention cron job is active (`17 20 * * *` UTC) with two successful recorded runs (latest 1 November 2026 at 20:17 UTC); rollback-only expiry test confirmed legacy responses, anonymous submissions and old rate-limit rows are cleaned. Ongoing schedule monitoring remains open.
- [x] PARTIAL: PRD, architecture, code standards, security and CI documentation added; API reference, testing guide and seed strategy are documented; staging data fixtures and manual QA evidence remain open.
- [ ] Production smoke test and evidence-based sign-off.

## Current external blockers
- Security hardening adds a per-request nonce CSP, explicit legacy XSS-auditor disable header (`X-XSS-Protection: 0`), security.txt, unsafe DOM/script sink checks and Playwright assertions for response nonce propagation and security.txt HTTP delivery.
- The browser workflow now starts the exact local production build and targets localhost for Playwright/Lighthouse rather than relying on the Vercel preview alias. Recent runs through #470 pass npm ci, audit, Prisma, typecheck, unit tests and build; the newest local-browser workflow run #471 is still in progress.
- GitHub Actions PR validation run #385 completed successfully on 2 November 2026. The PR merge candidate included feature HEAD `cd4a5332c497d17d5c5d221cb20689bb8e46c22a` (merge commit `7b0823302d7f740c4f73ae9d9287d89230892aaa`): `npm ci`, npm audit (0 vulnerabilities), Prisma validation, TypeScript, 34 Vitest files / 130 tests, and the Next.js 15.5.28 production build (19/19 static pages) all passed.
- The previous feature HEAD `cd4a5332c497d17d5c5d221cb20689bb8e46c22a` remains deployed to Vercel Production as `dpl_ETbYkFQdiTeJ7QB6dm5bPeeYQK7i` (`READY`). Current branch HEAD is newer and is not deployed. Vercel deployment creation returned HTTP 402 `api-deployments-free-per-day`; do not claim new CSP/security.txt behavior is live until a new deployment is verified.
- The live `.site` Supabase project `fwmovyitmtpnwhqmvrgh` has 36 recorded migrations through `20261102102457_coursepulse_private_fk_indexes`. The new migration adds indexes to `private.data_deletion_requests(reviewed_by)` and `private.feedback_versions(changed_by)`; the live migration ledger and repository file are aligned. The post-change performance advisor no longer reports unindexed foreign keys. It reports 15 informational unused-index findings, which are not removed on a low-traffic demo database without workload evidence. All 10 public tables have RLS enabled.
- Retention cleanup is active at `17 20 * * *` UTC. Two successful runs are recorded; latest began 1 November 2026 at 20:17 UTC.
- The active administrator has one verified TOTP factor. A fresh browser sign-in proving AAL2 and the recovery path still needs live verification.
- Supabase Security Advisor still reports leaked-password protection disabled. The Supabase organization is on the Free plan and the available integration cannot change the Auth dashboard setting; an owner must enable it if available or record an explicit institutional risk decision.
- The current `.site` Vercel environment sets `NEXT_PUBLIC_APP_URL=https://coursepulse-site.vercel.app`. The README's Supabase Auth URL guidance has been corrected to this `.site` domain; the actual Auth Site URL/redirect allow-list and email confirmation/password-reset journeys still need dashboard/browser verification.
- Institution-approved privacy/terms text, controller identity, verified support contacts, consent/minor policy and retention/legal decisions remain owner/institution actions.
- Exact-HEAD local browser E2E and CSP/security.txt HTTP checks are awaiting the latest CI run; full role/RLS and IDOR/XSS/CSRF adversarial checks, WCAG 2.2 AA manual review, Lighthouse/Core Web Vitals, backup/restore evidence, exact-HEAD deployment/live headers, and production smoke/rollback sign-off remain open.

## Owner decisions required
Institution name/branding; verified support contact; department and semester catalogue; student age/minor policy; legal basis and retention schedule; cookie/analytics policy; paid/free status; official accessibility/support contact. Do not publish guessed legal statements or contacts.


## College workflow additions — preview-only implementation
- [x] DONE: Student Voice suggestions are stored in a separate identified table, with student-owned reads, course-enrollment checks, immutable submission content, Head-only status changes, and audited workflow updates.
- [x] DONE: private instructor inbox notifications use recipient-scoped RLS, immutable notification content, and read-only acknowledgement by the addressed instructor.
- [x] DONE: full-college monthly report generation saves the Head's review threshold and response minimum, then creates idempotent private in-app meeting requests. The scheduled monthly close also evaluates the saved settings and sends notices for low-rated assigned teachers; no email provider is configured.
- [x] DONE: an isolated QA cron job generates previous-month course, department and college aggregate snapshots on the first day of each month, stores the prior-month comparison, and evaluates the Head's saved rating/response thresholds for private teacher meeting notifications. The Head archive and threshold settings are MFA-protected.
- [ ] NOT STARTED: bulk roster import with secure Auth provisioning, college/tenant isolation, Super Admin, institution QR verification, and external AI model integration remain release blockers.
- [ ] REQUIRED: authenticated role-matrix tests against QA fixtures, browser tests for Student Voice/instructor inbox/Head review, and security-advisor review after applying this migration.


## Multi-college SaaS completion slice — no-cost QA preview
- [x] DONE: organization registry, tenant_id ownership columns, restrictive tenant-boundary RLS, composite tenant foreign keys, and organization-scoped privileged analytics/report RPCs are applied to the isolated QA project.
- [x] DONE: Head-owned organization profile; Super Admin-only platform tenant list/status operations and a separate platform-admin membership table.
- [x] DONE: Super Admin college creation flow provisions a setup-only tenant and invites its first Head. The tenant activates only after the Head verifies the invitation email.
- [x] DONE: Head roster CSV import and individual account invitations for students and teachers use a server-side Supabase Auth Edge Function. Role and organization are read from the trusted invitation record, never client-editable metadata.
- [x] DONE: student directory fields include college roll number, course, section and private mobile storage; teachers can view only their assigned class rosters without mobile numbers or feedback linkage.
- [x] DONE: student QR uses a random 256-bit token, stores only its SHA-256 hash, rotates/revokes previous tokens, and verifies through a one-time URL fragment/POST flow.
- [x] DONE: Head-only AI report worker is deployed and reads only minimum-five-suppressed monthly aggregate report rows. AI credentials are not present in the preview environment; the feature returns a configuration message until OPENAI_API_KEY and OPENAI_MODEL are added as Supabase Edge Function secrets.
- [ ] REQUIRED: provision at least one internal CoursePulse platform-admin membership through a trusted operator process; the platform role cannot be self-assigned by a College Head.
- [ ] REQUIRED: verify Supabase Auth email templates, Site URL and redirect allow-list, and successful real email delivery for a first Head, teacher and student.
- [ ] REQUIRED: add OPENAI_API_KEY and OPENAI_MODEL through Supabase Edge secrets, then test the actual provider response and AI output review with a Head account.
- [ ] REQUIRED: seed synthetic QA-only tenant A/B users and run authenticated RLS/IDOR, invitation acceptance, role matrix, QR expiry/revocation and full browser E2E tests. The QA database currently contains no real or synthetic Auth users.
- [ ] NOT STARTED: payment processor/billing webhooks; subscription fields remain administrative labels only.
- [ ] REQUIRED BEFORE PRODUCTION: institution-approved privacy/terms and retention rules, WCAG 2.2 AA and screen-reader review, backup/restore evidence, security sign-off and production rollback plan.

- [x] DONE: guarded legacy profile backfill attaches unassigned users to the original tenant only while exactly one organization exists; if multiple tenants exist, migration refuses to guess ownership.
- [ ] REQUIRED: Deno Edge Function sources are validated/deployed by Supabase separately from the Next.js Node TypeScript project; app typecheck intentionally excludes `supabase/functions`.
