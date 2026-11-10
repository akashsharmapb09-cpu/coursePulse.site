# CoursePulse username and password authentication

CoursePulse uses **username + password only** for public sign-in and signup. The forms do not ask for a Gmail address, another email address, or a phone number. No SMS or phone sign-in is offered.

## How identity works

Hosted Supabase password authentication uses an email or phone identity. To support username-only accounts without collecting an email or phone number, CoursePulse creates a private, server-generated Auth identity at the reserved `accounts.coursepulse.invalid` domain. The `.invalid` domain is non-deliverable and is never shown to users.

- New public accounts provide only full name, a unique username and a password.
- Signup runs on the trusted server. It uses the Supabase Admin API to create and auto-confirm a Student account; the Admin create-user operation does not send a confirmation email.
- The Auth user keeps the generated identity internally so Supabase can verify the password. The public `users.email` profile field is set to `NULL` for these accounts.
- Username-to-Auth-identity resolution happens only on the server. The browser never receives the generated identity.
- Existing accounts keep their current Auth identity and password. Their first username is backfilled from the email local-part where possible; they can change it in Account security. Existing email addresses are not deleted or migrated by this feature.
- The username is a login identifier, not a role or permission claim. Public signup always creates a Student; protected administrative workflows assign other roles.
- Username signup and sign-in use keyed-hash rate limits for username, username/IP pair and IP. Limiter failures are closed, and account creation is restricted to same-origin requests.
- Signup and username login require the server-only `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). Never expose that key with a `NEXT_PUBLIC_` prefix.

## Password recovery

New email-free accounts cannot receive an email reset link. Users can change their password while signed in from Account security. If locked out, they must contact their college administrator for a controlled password reset. Do not imply that a self-service email reset is available for these accounts.

## Roles and account creation

Public registration starts as Student. HOD and Super Admin access remains controlled by existing protected administrative workflows. User metadata is used only to initialize the profile; it is not used for authorization. Admin MFA and database RLS continue to protect privileged operations.

## Verification checklist

- [ ] Sign-in and signup show no email or phone fields.
- [ ] New Student signup creates an auto-confirmed Auth user and an application profile whose email is NULL.
- [ ] New users can immediately sign in with username and password after signup.
- [ ] Existing active accounts can sign in with their assigned username and current password.
- [ ] Unknown usernames and incorrect passwords return the same public failure.
- [ ] Inactive accounts cannot sign in.
- [ ] Username signup/login rate limits work and fail closed.
- [ ] Duplicate usernames are rejected by the database unique constraint.
- [ ] Signed-in password change works for email-free accounts.
- [ ] Locked-out email-free account recovery is handled by a college administrator.
- [ ] Student, Teacher, HOD and Super Admin authorization remains unchanged.
- [ ] Real browser tests cover successful and failed sign-in using QA accounts.
