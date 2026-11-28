# CoursePulse authentication and account provisioning

The current public access model exposes **Student** and **Teacher** sign-in. Public self-registration creates Student accounts only. Teacher access is provided through an invitation or an approved provisioning process. Admin/HOD is not a public signup choice and cannot enter the Student/Teacher dashboard.

## Student username authentication

- Students register with full name, a unique username, programme and password.
- No email address or phone number is requested for Student registration.
- The browser invokes the `student-username-auth` Supabase Edge Function for registration/login.
- The Edge Function uses Supabase Auth server-side to create a confirmed internal identity and return a session. Its reserved `.invalid` identifier is an internal authentication detail; it is not displayed to the Student and is not used to send email.
- Student login uses the username and password.
- Username registration and login attempts are rate-limited. Password recovery is not email-based; a signed-in user can change a password through account security controls.

## Teacher authentication

- Teacher accounts are provisioned through the approved invitation process rather than public self-registration.
- The sign-in form accepts the provisioned demo username or registered college email and password, then checks the profile is an active `INSTRUCTOR`.
- The client does not set its own role. Role and active-account checks are resolved from protected profile data by the server/application.
- Do not reset, delete or replace a Teacher account until the replacement identity is confirmed and course ownership/assignments have been transferred safely.

## Session and authorization boundaries

- Supabase Auth owns credentials and issues the session.
- Supabase SSR stores session state in essential first-party cookies.
- The dashboard and protected API routes verify the authenticated user and active Student/Teacher role.
- Student course/form access is scoped by published status, enrolment and eligibility.
- Teacher access is scoped to owned or explicitly assigned courses.
- Privileged administrative actions, where enabled in backend operations, require server-side authorization and MFA assurance. They are not available through public signup.

## Provider policy

Google OAuth and mobile/SMS sign-in are not offered in the current CoursePulse login interface. Never place Supabase service-role keys, admin secrets or internal credentials in client code or repository files.

## Verification checklist

- [ ] Student registration creates a Student identity without sending email.
- [ ] Student username/password sign-in returns a valid Supabase session.
- [ ] Teacher sign-in accepts only an active Teacher/INSTRUCTOR profile.
- [ ] Suspended/inactive accounts cannot access workspace APIs.
- [ ] A Student cannot elevate their role or access another student's course data.
- [ ] A Teacher cannot access a course outside their ownership/assignment scope.
- [ ] Sign-out and password change operate through Supabase Auth.
