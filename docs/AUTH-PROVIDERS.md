# Configure CoursePulse Google and mobile sign-in

The login page now supports:
- Email and password (existing flow)
- Mobile number with a six-digit SMS OTP
- Google OAuth

The UI and Supabase client flows are implemented. Google OAuth and live SMS delivery still require provider credentials and enablement in the Supabase Dashboard. Do not commit OAuth secrets or SMS provider credentials to this repository.

## 1. Google OAuth

1. Open Google Cloud Console → Google Auth Platform → Clients.
2. Create an OAuth Client ID with application type **Web application**.
3. Add this authorized JavaScript origin:
   - `https://coursepulse-production.vercel.app`
4. Add this exact authorized redirect URI:
   - `https://fwmovyitmtpnwhqmvrgh.supabase.co/auth/v1/callback`
5. Copy the OAuth Client ID and Client Secret.
6. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and paste the Client ID and Client Secret.
7. In Supabase Dashboard → Authentication → URL Configuration, set the Site URL to:
   - `https://coursepulse-production.vercel.app`
8. Add the following redirect URL:
   - `https://coursepulse-production.vercel.app/auth/confirm`

Google's OAuth callback is the Supabase Auth callback above. The app callback at `/auth/confirm` exchanges the PKCE code and redirects the user to the dashboard.

## 2. Mobile SMS OTP

1. In Supabase Dashboard → Authentication → Sign In / Providers, enable **Phone**.
2. Configure an SMS provider supported by Supabase Auth (for example Twilio, Twilio Verify, Vonage, or MessageBird).
3. Enter the provider credentials in the Supabase Phone provider settings. Keep all provider secrets in Supabase, not in Vercel client environment variables or source control.
4. Confirm that the SMS provider can deliver to the countries where your users are located.
5. Set sensible OTP expiry and rate limits, and enable CAPTCHA / abuse protection before broad public rollout.
6. Test with a verified test phone number and fixed OTP in Supabase before using paid SMS delivery.

**India:** Production SMS delivery must comply with applicable TRAI/DLT requirements. Confirm sender IDs, approved templates, and provider routing before enabling public SMS delivery.

## 3. How the app behaves

- Sign-in by phone only allows an existing account to log in; it does not silently create a second account.
- Sign-up by phone creates a student account after OTP verification.
- Phone numbers are sent to Supabase in E.164 format (country calling code + number).
- Google sign-in uses Supabase's PKCE OAuth flow and returns through `/auth/confirm?next=/dashboard`.
- New users receive the default STUDENT application role from the existing database trigger. Role assignment remains server/database controlled.

## 4. Verification checklist

- [ ] Google provider is enabled and has valid OAuth credentials.
- [ ] Google callback URI matches the Supabase Auth callback exactly.
- [ ] App redirect URL `/auth/confirm` is in the Supabase allow list.
- [ ] Phone provider is enabled and SMS credentials are saved.
- [ ] SMS delivery tested with a real, consented test number.
- [ ] OTP rate limits, expiry, and CAPTCHA/abuse controls reviewed.
- [ ] Existing email/password login and sign-up still work.


## 5. Protected administrator registration

- The signup screen offers **Student** and **Admin** account types. Student is the default.
- Admin registration requires the shared code. The server validates it; the browser never assigns the role directly.
- The Vercel project must have the encrypted server-only environment variable `ADMIN_SIGNUP_CODE` set for Production, Preview, and Development. Never use a `NEXT_PUBLIC_` prefix for this secret.
- The admin verification cookie is HTTP-only, signed, short-lived, and bound to the email address or phone number when applicable.
- After email confirmation, SMS OTP verification, or Google sign-in, the account is created as Student first. The authenticated server flow then calls the database function `claim_admin_signup`, which verifies the code hash in a private table and upgrades only that account to Admin.
- Existing Admin sign-in does not ask for the signup code.
- Keep the database migration `20261104190000_admin_signup_code_guard.sql` in sync with the live Supabase project.
