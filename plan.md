# Development Roadmap

## Phase 1 — Baseline and risk review
Inspect repo, deployment, Supabase schema, RLS, RPCs, dependency graph, public pages, routes, and existing tests. Preserve existing database privacy primitives.

## Phase 2 — Identity and privacy
Verify authentication/session lifecycle, MFA enforcement for admins, eligibility/anonymous data separation, duplicate prevention, cohort suppression, retention, deletion request review, and generic error behavior.

## Phase 3 — Student experience
Complete enrollment-aware dashboard, multi-question forms, deadlines, submission confirmation/status, account settings and deletion workflow.

## Phase 4 — Instructor experience
Complete course-level aggregate charts, rating distributions, semester/date filters, trend analysis, course comparisons, anonymized themes/comments with review controls, and authorized exports.

## Phase 5 — Administrator experience
Complete users/roles, departments, semesters, courses, enrollments, instructor assignments, form lifecycle, audit log review, policy/settings, and deletion request operations behind MFA.

## Phase 6 — Public experience and SEO
Landing page, feature and policy content approved by operator, canonical metadata, robots/sitemap, Open Graph, noindex for private pages, responsive navigation, accessibility.

## Phase 7 — Security and privacy hardening
RLS role matrix, IDOR, CSRF/origin, XSS/CSP, rate limiting, secrets/history scan, dependency review, secure storage, webhook verification if present, retention/deletion evidence, children/consent policy.

## Phase 8 — QA and deployment
Unit + integration + Playwright E2E + security tests, mobile/accessibility, Lighthouse/Web Vitals, backup/restore rehearsal, reconciled migrations, staging preview, owner approval, production rollout/rollback plan.
