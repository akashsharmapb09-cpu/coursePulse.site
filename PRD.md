# CoursePulse Product Requirements Document

## Vision
CoursePulse is a privacy-first course feedback and learning analytics portal for higher education. Students submit course feedback, instructors improve teaching through protected aggregates, and administrators manage the academic workspace.

## Roles
- Student: view eligible courses/forms, submit once per eligible form, and view only personal participation status.
- Instructor: manage assigned courses/forms and view privacy-protected aggregates only.
- Administrator: manage users, academic structure, assignments, forms, retention and audit records. Admins must not see raw anonymous answers.

## Product principles
1. Anonymous answers must not be stored with a student identifier or reversible identity mapping.
2. Eligibility and duplicate prevention are separate from answer storage.
3. Reports suppress cohorts below the configured minimum (default 5), including complementary groups that enable subtraction.
4. Every endpoint enforces authentication, role, object ownership and input validation server-side.
5. Never invent institution policies, contacts, retention periods or legal claims.
6. Accessibility, responsive behavior, observability and automated testing are release requirements.

## Functional scope
### Identity
Signup, email confirmation, sign-in/out, password recovery/reset/change, session lifecycle, account suspension, three roles and admin-managed role assignment. No self-service role escalation.

### Academic structure
Departments, academic semesters, courses/course codes, instructor assignments and student enrollments.

### Feedback lifecycle
Create/edit/preview/publish/close/archive/delete forms; multiple ordered questions; rating, text, number, single-choice and multiple-choice types; required flags; deadlines; course/cohort eligibility; version/change controls.

### Anonymous submissions
Eligibility records prove permission and enforce one-time use. Anonymous answer records contain no student/user identifier, IP, email, stable shared ID or direct join key. The submission flow must consume eligibility atomically without exposing a mapping from student to answer.

### Student experience
Eligible, pending and completed forms; due dates; participation progress; accessible form validation; confirmation; personal submission history.

### Instructor experience
Assigned-course overview, participation metrics, course/department/semester/date filters, rating distributions, averages, trends, comparisons and privacy-reviewed comment themes. Exports must use the same aggregate service.

### Administrator experience
User/role lifecycle, departments, semesters, courses, enrollments, instructor assignments, forms/questions, institution aggregates, retention controls and append-only audit logs.

### Public website
Landing, features/about/contact, privacy and terms pages, SEO metadata, canonical, Open Graph, robots and sitemap. No fabricated testimonials, logos, certifications or performance claims.

### Security and privacy
RLS and least-privilege grants on exposed tables; CSRF/Origin controls; distributed rate limits; CSP/security headers; secret scanning; dependency audits; role-matrix tests; retention/deletion workflows. Institution/legal approval is required for policy wording.

## Non-functional requirements
WCAG 2.2 AA target; keyboard/screen-reader support; responsive mobile/tablet/desktop; measured Core Web Vitals; pagination and bounded queries; production monitoring; backup/restore evidence.

## Acceptance gates
A feature is complete only when implementation, database policy, automated tests and user-facing behavior are verified. Production sign-off requires reviewed/applied migrations, passing typecheck/unit/integration/E2E/security tests, student/instructor/admin RLS matrix, anonymity threat-model review, accessibility/viewport evidence, production smoke tests and approved institution policy configuration.
