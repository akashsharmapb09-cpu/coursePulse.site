# CoursePulse username and password authentication

The CoursePulse sign-in screen uses **username + password**. It does not ask for an email address or phone number on the sign-in screen, and no SMS or phone sign-in is offered.

## How identity works

Supabase Auth currently authenticates password credentials with an email address or phone number. CoursePulse therefore keeps the existing verified email as a private Auth identity and resolves a username to that identity only on the server. The Auth email is never returned to the browser by the username-login endpoint.

- Existing accounts receive a unique username derived from the email local-part where possible. Users can change it in Account security.
- New students choose a username during registration.
- Email remains attached to the account for verification, recovery and existing account workflows, but it is not the sign-in identifier.
- Password recovery remains email-based until a separate recovery method is designed and verified.
- The username is a login identifier, not a role or permission claim. Authorization continues to use the protected profile and database policies.
- The username lookup is rate-limited by a hash of the username/IP pair and by IP. The lookup limiter fails closed.
- The login route requires the server-only `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) to read the username mapping and invoke the restricted limiter. Never expose that key with a `NEXT_PUBLIC_` prefix.

## Account verification

New account confirmation returns through the application callback at `/auth/confirm`. Set `NEXT_PUBLIC_APP_URL` to the canonical application URL for the relevant Vercel environment and add the matching `/auth/confirm` callback URL to Supabase Authentication → URL Configuration.

## Roles and account creation

Public registration starts as Student. HOD and Super Admin access remains controlled by the existing protected administrative workflows. Username metadata is used only to initialize the profile username; it is not used for authorization.

## Verification checklist

- [ ] Existing active account can sign in with its username and current password.
- [ ] Unknown usernames and incorrect passwords return the same public error.
- [ ] Inactive accounts cannot sign in.
- [ ] Username lookup rate limits work and fail closed.
- [ ] Duplicate usernames are rejected by the database unique constraint.
- [ ] Student registration stores the selected username before the account is used.
- [ ] Password recovery and email confirmation still work.
- [ ] Student, Teacher, HOD and Super Admin authorization remains unchanged.
- [ ] Real browser tests cover successful and failed sign-in using QA accounts.
