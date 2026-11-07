# Product Requirements — CoursePulse

## Vision
Provide an institution-managed workspace for structured course feedback and privacy-aware academic reporting.

## Problem and objectives
Feedback collection is often fragmented and difficult to compare across courses and semesters. CoursePulse centralizes eligible student forms, course administration, role-specific dashboards, aggregate reporting, exports, and request governance.

## Personas and permissions
- **Student:** sign in, see enrolled-course forms, submit one response per eligible form, view submission status/history, manage profile/password, request account deletion.
- **Instructor:** manage own course/form workflows where permitted, view assigned-course aggregate analytics, export approved summaries. No access to student identity or raw anonymous submissions.
- **Administrator:** manage users/roles, departments, semesters, enrollments, instructor assignments, review deletion requests, inspect audit activity, and view institution-level aggregates. Privileged APIs require AAL2.

## Functional requirements
- Authenticated role-specific workspace using Supabase Auth and database RLS.
- Dynamic feedback forms with rating, numeric, single-choice, multi-select, yes/no, short text, and long text questions.
- Server-side validation and atomic anonymous submission via the database RPC.
- Duplicate prevention, course enrollment checks, active-form checks, due-date checks, and configured retention.
- Aggregate reporting APIs, course/semester/department/date filters, rating distributions, weekly response activity, compatible-question course comparison, minimum cohort-size suppression, export endpoints, debounced permission-aware search.
- Public landing, features, about, privacy, terms, contact, support, and refund-policy pages.
- Administrator role, course-enrollment, instructor-assignment, deletion-review, and audit-log workflows.

## Non-functional requirements
Security first; data minimization; role-level and row-level authorization; responsive and keyboard-usable UI; stable builds; accurate metadata; observable, testable behavior. Performance targets (LCP <=2 s, INP <=200 ms, CLS <=0.1) require field/lab measurement and are not yet certified.

## User journeys / acceptance criteria
1. A student sees only forms allowed by enrollment and RLS; invalid or duplicate submissions are rejected by the database.
2. A new response is stored in `anonymous_submissions`; the corresponding eligibility ledger is separate; aggregate reporting suppresses cohorts below five.
3. An instructor sees aggregates only for authorized courses.
4. An administrator completes authenticator MFA before protected management reads/writes; user/role changes use the database procedure and its audit trail.
5. A user can request account deletion; an AAL2 administrator can move the request through valid review states with a recorded explanation.
6. Public pages are crawlable with distinct canonical metadata; authenticated routes are noindex.

## Priorities
P0: anonymous submission boundary, RBAC/RLS, MFA admin, CSRF/origin protection, secrets and headers. P1: student feedback builder/response workflow, admin records and deletion governance, search and reporting. P2: complete chart suite, course comparison, form edit/reorder/delete, analytics provider, E2E/security/performance test coverage, institution-specific policies and operational readiness.

## Success measures
Eligible form completion rate, duplicate/invalid submission rejection, report availability by permitted cohort, median dashboard/API latency, accessibility results, security lint results, incident rate, and data-deletion request turnaround. Do not populate these measures with synthetic production data.
