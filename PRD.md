# CoursePulse Product Requirements Document

## Vision
CoursePulse is a privacy-first course feedback and learning analytics portal for higher education. Students submit anonymous course feedback, and Teachers improve their courses through protected aggregates.

## Deployment model
Each CoursePulse deployment serves one college/workspace only. Multi-college tenant provisioning, cross-college switching, platform-level college administration and subscription management are not part of this product. A single internal workspace ID remains in the database only to support row-level security and course/roster boundaries.

## Roles
CoursePulse has exactly two application roles:
- **Student:** register with username and programme, view eligible courses/forms, submit once per eligible course/form, and view only personal participation status.
- **Teacher:** register with a college email, manage their own or explicitly assigned courses/forms/questions, invite students to assigned courses, and view privacy-protected analytics and aggregate exports.

There is no HOD, Admin or Super Admin account, role, signup path, dashboard or application-level privilege tier.

## Product principles
1. Anonymous answers must not be stored with a student identifier or reversible identity mapping.
2. Eligibility and duplicate prevention are separate from answer storage.
3. Reports suppress cohorts below the configured minimum (default 5), including complementary groups that enable subtraction.
4. Every endpoint enforces authentication, role, object ownership and input validation server-side.
5. Never invent institutional policies, contacts, retention periods or legal claims.
6. Accessibility, responsive behavior, observability and automated testing are release requirements.

## Functional scope
### Identity
Student username/password registration and sign-in; Teacher college-email/password registration with email confirmation; sign-in/out; password/session lifecycle supported by Supabase Auth; account suspension by the project owner outside the application. Student and Teacher are the only roles; no self-service privilege escalation exists.

### Academic structure
Courses/course codes, Teacher course ownership and assignments, student enrollments, and optional department/semester metadata for course reporting. The single internal workspace identifier exists only for data isolation.

### Feedback lifecycle
Teachers create/edit/preview/publish/close/archive feedback forms for their own or assigned courses; multiple ordered questions; rating, text, number, single-choice, multiple-choice and Yes/No types; required flags; deadlines; eligibility; version/change controls.

### Anonymous submissions
Eligibility records prove permission and enforce one-time use. Anonymous answer records contain no student/user identifier, IP, email, stable shared ID or direct join key. The submission flow must consume eligibility atomically without exposing a mapping from student to answer.

### Student experience
Eligible, pending and completed forms; due dates; participation progress; accessible form validation; confirmation; personal submission history.

### Teacher experience
Own/assigned-course overview, participation metrics, course/department/semester/date filters, rating distributions, averages, trends, comparisons and privacy-reviewed comment reporting. Exports use the same protected aggregate service. Teachers can invite Students only to courses assigned to them; they cannot create another Teacher or privileged account.

### Public website
Landing, features/about/contact, privacy and terms pages, clear Student/Teacher access copy, SEO metadata, canonical, Open Graph, robots and sitemap. No fabricated testimonials, logos, certifications or performance claims.

### Security and privacy
RLS and least-privilege grants on exposed tables; CSRF/Origin controls; distributed rate limits; CSP/security headers; secret scanning; dependency audits; Student/Teacher role-matrix tests; retention/deletion workflows. Legacy administrative records and database structures must not confer an active application role or accessible dashboard.

## Non-functional requirements
WCAG 2.2 AA target; keyboard/screen-reader support; responsive mobile/tablet/desktop; measured Core Web Vitals; pagination and bounded queries; production monitoring; backup/restore evidence.

## Acceptance gates
A feature is complete only when implementation, database policy, automated tests and user-facing behavior are verified. Production sign-off requires reviewed/applied migrations, passing typecheck/unit/integration/E2E/security tests, Student/Teacher RLS matrix, anonymity threat-model review, accessibility/viewport evidence, production smoke tests and approved institution policy configuration.
