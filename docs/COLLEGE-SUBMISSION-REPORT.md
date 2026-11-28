# CoursePulse — College Project Submission Report

**Project:** CoursePulse (.site single-college course-feedback workspace)  
**Repository:** https://github.com/akashsharmapb09-cpu/coursePulse.site  
**Implementation branch:** `fix/student-course-loading-demo`  
**Public URL:** https://coursepulse-site.vercel.app  
**Report reviewed:** 28 November 2026

> This report describes the implemented application and its documented architecture. A Git branch, passing CI run and production deployment are separate facts. Before a live demonstration, verify that Vercel Production is READY for the exact commit being presented.

## 1. Project overview

CoursePulse is a single-college course-feedback workspace. Students submit feedback for courses in which they are enrolled; Teachers manage their own or assigned courses and review aggregate feedback reports. The public account model is Student and Teacher. Public self-registration creates Student accounts only; Teacher access is provisioned separately. Admin/HOD is not a public signup option or a public Student/Teacher role.

The application uses Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth and PostgreSQL with Row Level Security (RLS), server-side route guards, database RPCs, Zod validation, Prisma schema tooling and report-export libraries.

## 2. Implemented capabilities

### Student workspace
- Register with full name, username, academic programme and password. Student self-registration does not ask for an email address or send an email-confirmation message.
- Sign in with username and password.
- View published courses and open feedback forms only when enrolled and eligible.
- Submit validated feedback once per eligible form; review pending/completed state and submission history.
- Update permitted profile information, change a password while signed in and submit an account/data-deletion request.

### Teacher workspace
- Sign in using the provisioned demo username or registered college email and password; access only owned or explicitly assigned courses.
- Manage course information and feedback-form lifecycle (create, edit, open/close and deadlines).
- Build structured question sets, use question categories, reorder questions and restore saved form versions.
- View filtered aggregate analytics, rating distributions and weekly response trends.
- Compare two selected courses and export aggregate reports as CSV, Excel-compatible XLS, XLSX or PDF.
- Use teacher notifications/inbox and view eligible feedback progress for assigned courses.

### Privileged academic operations
Where an active, authorized administrative account is available, the internal administrative workspace supports academic catalogue and access-management operations, audit review and data-deletion request review. Privileged actions require server-side authorization and MFA assurance (AAL2). Admin/HOD is not exposed as a public role choice.

## 3. Feedback data and privacy design

New Student submissions are validated by the application and written through the `submit_anonymous_feedback` database RPC. New answer records are stored in `public.anonymous_submissions` with a feedback-form reference, answer payload and date-level receipt; they do not contain the Student's user ID, username or email. A separate private `private.feedback_eligibility` record controls form eligibility and duplicate-submission prevention.

This is an identity-separation design, not a guarantee of absolute or cryptographic anonymity. Course/form context, dates, small cohorts and free-text content can still create re-identification risks. Students should not include names, roll numbers, emails, phone numbers or other identifying information in comments.

The legacy `public.responses` table remains for compatibility and contains a student identifier column; it was empty at the anonymous-storage cutover. New submissions use the separate answer store. Do not describe the entire historical database as cryptographically anonymous.

Teacher analytics and ordinary exports use aggregate database functions rather than raw answer rows. Question groups and rating bins with fewer than five responses are suppressed, and free-text answers are excluded from ordinary analytics and exports. The five-response rule reduces small-cohort disclosure but does not, by itself, eliminate repeated-query differencing, complementary suppression or contextual re-identification.

Feedback-form retention is configurable within the supported 30-to-730-day range. A scheduled cleanup process removes expired answer records and old rate-limit buckets. An account/data-deletion request is reviewed through the workspace; submission of a request does not automatically delete a Supabase Authentication identity.

## 4. Security and operational controls

- Supabase Auth manages credentials and signed-in sessions. Student and Teacher identities are checked against protected server-side profile data.
- RLS and course-scoped database functions restrict Student enrollments and Teacher ownership/assignment.
- New answer data and the eligibility ledger are separate; direct Data API access to those protected resources is denied.
- Feedback submission validates the form and answers, consumes eligibility and inserts the anonymous answer in one transaction.
- Sensitive mutations use same-origin checks and per-user rate limits where configured.
- Middleware applies a nonce-based Content Security Policy.
- Privileged administrative actions require AAL2 and are audit logged.

These controls are implementation safeguards, not a claim of completed independent penetration testing or legal certification.

## 5. Demonstration and test-data safety

The current production workspace is an active demonstration environment with existing Student/Teacher demo identities, four sample courses and feedback records. It is not an empty QA database. Do not reset production, bulk-replace its demo records, or fabricate submissions to cross the minimum-five reporting threshold.

Vercel Preview currently shares the production Supabase project. Treat Preview writes as production writes. Use a separate disposable Supabase QA project for synthetic accounts, test submissions, authenticated browser E2E, role-matrix tests and destructive testing. Follow [docs/SEEDING.md](./SEEDING.md) and [docs/COLLEGE-ONBOARDING-RUNBOOK.md](./COLLEGE-ONBOARDING-RUNBOOK.md).

For a demonstration, explain that the Student submits feedback, the server keeps new answer records separate from Student identity, and the Teacher sees only reportable aggregates. A zero/empty graph can be the correct privacy-preserving result when a selected group has fewer than five responses or filters leave no reportable data.

## 6. Outstanding acceptance gates

The following items must be verified or accepted by the institution before real student data is used:

1. Run Student and Teacher end-to-end flows against a disposable QA Supabase project, including eligibility, duplicate prevention, course scoping and report exports.
2. Complete browser acceptance for Chromium, Firefox and WebKit on the exact release commit; verify responsive layout, keyboard navigation, accessible labels, error states and screen-reader behaviour.
3. Complete the full database RLS/IDOR and abuse/security test matrix, including statistical differencing and independent re-identification review.
4. Verify backup/restore, scheduled retention-cleanup history and incident response ownership.
5. Have the institution approve the privacy notice, terms, support contact, retention schedule, lawful purpose, minor/student consent approach and account-deletion process. Current public notices are informational technical drafts, not institutional legal approval.
6. Review the Supabase region `us-east-1` (United States) and explicitly accept the data-residency implications.
7. The prior security review flagged Supabase Auth leaked-password protection as disabled. The project owner must verify its current status in Auth settings and resolve or formally accept the risk.
8. Verify the exact Vercel Production deployment is READY and is built from the commit used for the demonstration. CI success alone does not prove a deployment is live.
9. Confirm an authorized owner/admin is available for Teacher provisioning and privileged operations. Do not bypass provisioning controls or insert Auth users directly in SQL.

Student username-based accounts do not have email-based password recovery. A signed-in user can change a password through account security controls; a user who has lost access must contact the approved support channel. The workspace records deletion requests, but actual Auth-user deletion requires a separate authorized owner operation.

## 7. Submission verdict

**Project status:** A broad and functional Student/Teacher feedback workspace with server-side submissions, course management and privacy-aware aggregate reporting.  
**Privacy status:** Identity separation and minimum-five suppression are implemented; absolute anonymity is not claimed.  
**Institutional readiness:** Requires the acceptance gates above and institution sign-off before real student records are used.  
**Release status:** Check the linked GitHub Actions run and Vercel deployment details for the exact commit before claiming the latest branch changes are live.

CoursePulse can be presented as a working academic project demonstration. It should not be represented as an institution-approved production student-record system until the institution has completed its approval and technical acceptance.
