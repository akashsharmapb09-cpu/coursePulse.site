# CoursePulse College Demonstration and Pilot Onboarding Runbook

**Project:** CoursePulse `.site`  
**Canonical production URL:** https://coursepulse-site.vercel.app  
**Repository:** https://github.com/akashsharmapb09-cpu/coursePulse.site  
**Supabase project ref:** `fwmovyitmtpnwhqmvrgh`  
**Supabase region:** `us-east-1` (United States)  
**Reviewed:** 28 November 2026

This runbook describes the current Student/Teacher workspace and the controls required before an institution uses it with real student data. It is not an institution approval, legal opinion or security certification. Do not enter real student information until the institution has completed and signed [INSTITUTIONAL-PILOT-APPROVAL.md](./INSTITUTIONAL-PILOT-APPROVAL.md), accepted the data-location and privacy risks, and assigned accountable contacts.

## 1. Current product and production baseline

CoursePulse is a single-college workspace. Its public account model is **Student and Teacher**:
- New public self-registrations create Student accounts only.
- Students register with full name, unique username, programme and password. Student self-registration does not request an email address or send an email-confirmation message.
- Teacher access is provisioned separately through an approved invitation/account-provisioning process. Teachers sign in with the credential assigned to their account; the login form accepts a provisioned demo username or registered college email.
- Admin/HOD is not a public sign-up or public Student/Teacher role choice. Privileged administrative operations require an authorized account and MFA assurance; they are not available through public self-registration.

The production environment is an active demonstration environment, not an empty test database. It contains demo Student/Teacher identities, four sample courses and feedback records. Do not reset it, bulk-import over it, delete its accounts/courses or add synthetic responses without a separate, explicit owner-approved change plan. Always inspect the current live state before making academic-record changes; an old database snapshot must not be treated as current.

The current demo course set includes:
- CSE111 — Introduction to Programming
- CSE202 — Data Structures & Algorithms
- CSE203 — Database Management Systems
- CSE204 — Web Technologies & UI Development

The demo includes feedback forms and a small number of genuine demonstration submissions. Analytics suppress question groups and rating bins with fewer than five responses. Do not fabricate or bulk-insert feedback to cross this privacy threshold.

## 2. Identity and account provisioning

### Student accounts
1. Open https://coursepulse-site.vercel.app/signup.
2. Enter the Student's full name, choose a unique username, select the programme and create a password.
3. Sign in at /login with the username and password.
4. The Student sees courses and forms only when the course is published, the Student is enrolled and the form is available/eligible.

Student username-based accounts do not use email-based self-service password recovery. A signed-in user can change their password through account security controls. A user who has lost access must contact the Teacher/department or the support channel that provided access. Do not promise an email reset flow.

### Teacher accounts
Teacher accounts are not created through the public Student signup form. Verify the person's institutional identity and obtain approval from the institution's designated account owner before provisioning access. The approved provisioning path must assign the Teacher role server-side and leave the account active. The login form accepts the provisioned demo username or registered college email and password.

Do not promote a Student, create an Auth identity by direct SQL, insert into `auth.users`, bypass the invitation guard, or delete/replace an existing Teacher as a workaround. Course ownership and instructor assignments must be transferred and verified before any account replacement. If the authorized Teacher-invitation path is unavailable (for example, no active authorized AAL2 administrator is available), stop and ask the project owner to restore the approved provisioning path; do not improvise a service-role bypass.

## 3. Feedback storage, anonymity and reports

Student feedback submission uses the authenticated application and a server-side Supabase RPC. New answer records are stored in `public.anonymous_submissions` with the feedback-form reference, answer payload and date-level receipt; they do not contain the Student's user ID, username or email. A separate private eligibility record controls course/form access and duplicate-submission prevention.

This is an identity-separation design, not a guarantee of absolute or cryptographic anonymity. Course/form context, submission timing and free-text comments may still create re-identification risks. Students must not include names, roll numbers, email addresses, phone numbers or other identifying/private information in comments.

Teacher Analytics and exports use aggregate reporting functions rather than raw answer rows. Question groups/rating bins with fewer than five responses are suppressed, and free-text answers are excluded from ordinary Analytics and exports. Available filters include course, semester, department, date range and question category; the Teacher workspace also provides course comparison and CSV/XLS/XLSX/PDF aggregate exports. Empty graphs may mean the selected group is below the privacy threshold or that the active filters have removed reportable data.

Feedback forms have a configurable retention period within the supported 30–730-day range. A scheduled cleanup process removes expired response records and old rate-limit buckets. Account/data-deletion requests can be submitted in the workspace and reviewed; submitting or marking a request does not itself delete a Supabase Authentication account. The authorized project owner must separately perform and verify Auth-user deletion before reporting that an account has been deleted.

## 4. Configure academic data after approval

Collect authoritative information from the institution before changing the production catalogue:
- Official department names and unique codes.
- Semester name and approved start/end dates.
- Course codes, official titles and short descriptions.
- Each instructor's verified institutional identity.
- Each student's verified identity and exact student-to-course enrollment mapping.
- Written approval from the person authorized to operate the pilot.

Use the authorized workspace controls to configure departments, semesters, courses, course publication, enrollments and instructor assignments. RLS and server-side role checks enforce course visibility and ownership. Students should be enrolled only in the courses listed on the approved roster, not all courses by default.

Before opening a feedback form:
1. Verify the course is linked to the correct department and semester.
2. Verify the correct Teacher owns or is assigned to the course.
3. Verify the intended Student cohort is enrolled.
4. Review every question, category, required setting and due date.
5. Confirm the retention period and student-facing notice with the institution.
6. Open the form only for the approved cohort.

Do not invent course names, student/instructor identities, emails or academic dates. Keep completed rosters outside Git and transfer them only through an institution-approved channel.

## 5. Environments, testing and operations

- Production and Vercel Preview currently use the production Supabase project. Treat Preview writes as production writes.
- Do not run write-based browser E2E, synthetic registration, fake submissions, destructive tests or seed scripts against Production or Preview.
- Use a separate disposable Supabase QA project for synthetic `example.test` identities, browser E2E, role-matrix tests and destructive testing.
- Before a production schema change, inspect the project ref, review the migration, take an approved backup and verify rollback/restore procedures. Never run a database reset against the production project.
- Supabase Admin/MFA features require AAL2 for privileged operations. Verify the authorized owner's TOTP enrollment and recovery process before a pilot.
- The Supabase region is `us-east-1` in the United States. The institution must explicitly review and accept the jurisdiction/data-residency implications before using real student records.
- The earlier security review flagged Supabase Auth leaked-password protection as disabled. The project owner must verify its current status in the Auth security settings and resolve or explicitly document the risk before real student data is used.
- Never commit passwords, invitations, recovery codes, API secrets, service-role keys, student rosters or feedback contents.
- Pause the pilot and notify the institution's designated owner if a user is assigned to the wrong role/course, data appears outside its intended scope or a privacy/security incident is suspected.

## 6. Go-live acceptance checklist

- [ ] Institutional approval record signed and accountable owner/support contacts identified.
- [ ] US `us-east-1` data location reviewed and accepted by the institution.
- [ ] Student username registration and sign-in tested with a synthetic account in isolated QA.
- [ ] Teacher invitation/provisioning and active Teacher sign-in tested with an approved synthetic identity in isolated QA.
- [ ] Student course/form eligibility and one-time submission verified in isolated QA.
- [ ] Teacher course scope, Analytics filters, minimum-five suppression and exports tested in isolated QA.
- [ ] Admin/privileged operations verified with MFA AAL2 where institution operations require them.
- [ ] Privacy notice, Terms, retention period, account-deletion process and support channel approved by the institution.
- [ ] Security, backup/restore, accessibility and browser acceptance gates completed and documented.
- [ ] Production catalogue, courses, instructors and enrollments independently checked against the approved roster.
- [ ] Institution owner explicitly authorizes the first real Student cohort.

Until all applicable gates have been completed, use CoursePulse as a supervised demonstration only, not as an approved student-data service.
