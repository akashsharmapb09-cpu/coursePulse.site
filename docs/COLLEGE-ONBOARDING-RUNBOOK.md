# College Pilot Onboarding Runbook

**Project:** CoursePulse `.site`  
**Public URL:** https://coursepulse-site.vercel.app  
**Supabase project ref:** `fwmovyitmtpnwhqmvrgh`  
**Supabase region:** `us-east-1`  
**Snapshot date:** 2 November 2026

This runbook is for the college's authorized administrator. It is not a substitute for institution approval. Do not enter real student information until the approval record in [INSTITUTIONAL-PILOT-APPROVAL.md](./INSTITUTIONAL-PILOT-APPROVAL.md) is signed and the college has accepted the data-residency, privacy and operational risks.

## 1. Current live baseline

The production database currently has:

- 1 active ADMIN profile and 1 STUDENT profile; no INSTRUCTOR profile.
- 1 course (`cse111`), currently ARCHIVED.
- 1 feedback form, currently closed.
- 0 departments, 0 semesters, 0 student-course enrollments and 0 instructor-course assignments.
- 0 legacy responses and 0 anonymous submissions.

No real college roster has been loaded. No synthetic student response data should be added to this production database.

## 2. Supabase Auth URL configuration

The code sends both signup confirmation and password-recovery links to `/auth/confirm`. Password recovery then continues to `/auth/reset`. The confirmation handler exchanges the PKCE code or verifies the token hash before redirecting.

Open the **.site** project only:
https://supabase.com/dashboard/project/fwmovyitmtpnwhqmvrgh/auth/url-configuration

Set:

| Supabase setting | Exact value |
|---|---|
| Site URL | `https://coursepulse-site.vercel.app` |
| Additional Redirect URL | `https://coursepulse-site.vercel.app/auth/confirm` |
| Local development only | `http://localhost:3000/auth/confirm` |

Do not add a broad wildcard for all Vercel deployments. Preview and production currently share the same Supabase project, so preview writes must be treated as production writes.

The Vercel `.site` project already has `NEXT_PUBLIC_APP_URL=https://coursepulse-site.vercel.app` for Production, Preview and Development. Do not change this to the separate SaaS `.com` URL.

Also inspect **Authentication → Sign In / Providers → Email**:
- Keep email confirmation enabled for real users.
- Do not enable auto-confirm for a college pilot.
- Set the Supabase password minimum to at least 10 characters (the application signup form also enforces 10).
- Leaked-password protection is reported disabled. Supabase currently makes this feature available on Pro and above; the connected organization is Free. Record the risk or have the project owner decide whether to upgrade before real student accounts are used.

After saving the settings, verify both flows with a controlled test account:
1. Sign up on the production URL using an approved test mailbox; open the email and confirm that the browser returns to `https://coursepulse-site.vercel.app/auth/confirm`, then reaches the dashboard after login.
2. Sign out, request password recovery, open the email, verify the callback reaches `/auth/confirm?next=/auth/reset`, set a new password, and sign in with it.
3. Confirm an unapproved host/redirect is not accepted.
4. Save the test date, account type (test only), result and screenshot in the college's private acceptance record. Do not put email addresses, tokens or screenshots containing personal data in Git.

**Important:** The connected project tools available for this review could inspect project/database state but could not read or patch the hosted Supabase Auth URL configuration. Until the owner has saved and verified the settings above, Auth redirect configuration is **NOT VERIFIED**.

## 3. College records needed before provisioning

Use [college-roster-template.csv](./college-roster-template.csv) as a working sheet only. It is not an automated import file. Keep the completed roster outside GitHub and send it only through a transfer method approved by the college.

Required authoritative inputs:
- Official department names and unique department codes.
- Semester name, start date and end date.
- Course code, official title and short description for each course.
- Each instructor's verified institutional email address and full name.
- Each student's verified institutional email address and full name.
- The exact student-to-course enrollment mapping.
- Written confirmation of the person authorized to approve the pilot and provision accounts.

Do not invent course names, instructor identities, student identities, institutional emails or semester dates.

## 4. Provision instructors, students and courses

All account holders first create their own Auth account through the public signup screen and confirm their email. New accounts receive the STUDENT role by default. An administrator must verify each instructor's institutional identity and promote the account to INSTRUCTOR through the protected admin workspace. Never change roles by inserting a row into `public.users` or by trusting user-editable metadata.

Recommended order after institutional sign-off:

1. Confirm the existing administrator can sign in and has verified TOTP MFA (AAL2).
2. Create the approved departments and the active academic semester.
3. Ask each named instructor to register with their institutional mailbox and confirm the email.
4. Verify each instructor against the college-approved roster; promote to INSTRUCTOR in the admin workspace.
5. Create each course with the official course code/title, department and semester; set the correct instructor/owner and publish only when approved.
6. Ask each student to register and confirm their institutional email.
7. Enroll each student into exactly the courses listed on the approved roster. Do not enroll every student into every course by default.
8. Create the course feedback form, review every question and the student-facing privacy notice, set the approved deadline and retention period, then open it only for the intended cohort.
9. Before the real cohort begins, run student/instructor/admin browser acceptance with synthetic accounts in a separate QA Supabase project.

Use the app's admin workspace for roles, departments, semesters, courses, enrollments and instructor assignments. The database enforces role/ownership checks and admin actions require AAL2. The app does not provide a verified bulk CSV import; this roster template is a planning worksheet, not an upload control.

## 5. Environment and data safety

- This is the `.site` college demo. Do not touch the separate SaaS `.com` project.
- Vercel Preview and Production currently share this production Supabase project. Do not run write-based E2E or create fake students on Preview.
- Do not use production to test form submissions. Use an isolated QA Supabase project with synthetic `example.test` identities.
- The database region is `us-east-1` (United States). The college must explicitly decide whether this hosting/data-residency arrangement is acceptable before any real student data is entered.
- No administrator passwords, invitation tokens, recovery codes, service-role keys or student data belong in this repository.
- Pause the pilot and contact the institution's designated owner if an account is misassigned, data appears in the wrong course, or a privacy/security incident is suspected.

## 6. Go-live checklist

- [ ] Supabase Site URL and redirect allow-list saved and verified.
- [ ] Signup confirmation and password reset tested on the production URL.
- [ ] Leaked-password protection risk accepted or resolved by the project owner.
- [ ] Institution approval record signed.
- [ ] US `us-east-1` data location reviewed and accepted.
- [ ] College departments, semester and official courses configured.
- [ ] Named instructors verified, registered and promoted.
- [ ] Students registered and enrolled only in approved courses.
- [ ] Course feedback forms and retention schedule approved.
- [ ] Isolated QA role/browser test completed.
- [ ] College owner authorizes the first real student cohort.

Until these gates are complete, treat the site as a supervised demonstration, not an approved student-data service.
