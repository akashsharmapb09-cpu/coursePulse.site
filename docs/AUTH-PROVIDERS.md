# CoursePulse email and password sign-in

The login page exposes email and password authentication only.

- Existing users sign in with their email address and password.
- New users can create Student accounts with email confirmation.
- Protected Admin registration requires the server-verified administrator signup code.
- Google OAuth and mobile/SMS sign-in are not offered in the CoursePulse login interface.

## Email confirmation

New account confirmation returns through the application callback at `/auth/confirm`. Student sign-up continues to `/dashboard`; protected Admin sign-up continues through `/auth/complete` before opening the dashboard.

Set `NEXT_PUBLIC_APP_URL` to the canonical application URL for the relevant Vercel environment. Add the matching `/auth/confirm` callback URL to Supabase Authentication → URL Configuration.

## Protected administrator registration

- The signup screen offers **Student** and **Admin** account types. Student is the default.
- Admin registration requires the shared code. The server validates it; the browser never assigns the role directly.
- The Vercel project must have the encrypted server-only environment variable `ADMIN_SIGNUP_CODE` set for Production, Preview, and Development. Never use a `NEXT_PUBLIC_` prefix for this secret.
- The admin verification cookie is HTTP-only, signed, short-lived, and bound to the email address when applicable.
- After email confirmation, the authenticated server flow calls the database function `claim_admin_signup`, which verifies the code hash in a private table and upgrades only that account to Admin.
- Existing Admin sign-in does not ask for the signup code.
- Keep the database migration `20261104190000_admin_signup_code_guard.sql` in sync with the live Supabase project.

## Verification checklist

- [ ] Email/password sign-in works for an existing account.
- [ ] Student registration sends an email confirmation.
- [ ] Admin registration rejects an incorrect code.
- [ ] Admin registration succeeds only after server-side code validation and identity confirmation.
- [ ] Existing email/password login remains available after signup.
