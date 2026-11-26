# CoursePulse production auth email delivery

## What the production logs showed

On 9 November 2026, Supabase Auth logged a signup confirmation request with:

- HTTP status: `429`
- Error code: `over_email_send_rate_limit`
- Message: `email rate limit exceeded`

The same period also contained repeated-signup events. The current application had hidden signup errors behind a generic confirmation notice, so users could not tell that Auth had rejected an email request.

## Immediate application behavior

The signup form now:
- Shows a clear message for the Auth email rate-limit response.
- Shows a temporary delivery-unavailable message for Auth server errors.
- Offers a `Resend confirmation email` action after a signup attempt that did not create a session.
- Handles resend rate limits explicitly.

This improves feedback, but it does not increase email capacity or guarantee delivery.

## Required production email configuration

The Supabase built-in email sender is intended for testing. Supabase documents a limit of two emails per hour per project and restriction to pre-authorized organization team addresses when custom SMTP is not configured.

For production, configure a custom SMTP sender in the production Supabase project:

1. Create a transactional-email provider account (Resend is one option).
2. Verify a sending domain you control with the provider. Publish the SPF/DKIM records it supplies; configure DMARC for the domain.
3. Create an API key scoped to sending mail only.
4. In Supabase Dashboard, open the production project, go to Authentication email/SMTP settings, enable custom SMTP, and enter the provider credentials. Never put the SMTP password/API key in Next.js `NEXT_PUBLIC_*` variables or Git.
5. Set a sender name and a From address on the verified domain.
6. Set the provider-supported email rate limit in Supabase Auth Rate Limits. Do not raise it above the provider's permitted rate.
7. Verify Auth URL Configuration: the Site URL must be the production app URL, and Additional Redirect URLs must include the exact production `/auth/confirm` URL. The deployed app uses `NEXT_PUBLIC_APP_URL` when building that redirect.
8. Confirm the signup email template contains a valid Supabase confirmation link (normally `{{ .ConfirmationURL }}`) and run a controlled signup using an address you own.
9. Check Supabase Auth logs and the email provider's delivery logs for accepted, delivered, bounced, or suppressed messages.

### Resend SMTP values (if using Resend)

- Host: `smtp.resend.com`
- Port: `465` (SSL/TLS)
- Username: `resend`
- Password: a Resend API key (store only in Supabase SMTP settings)
- From address: an address on the verified sending domain

## Important

Do not disable email confirmation as a workaround. This would remove the email-verification gate rather than fixing delivery. Existing pending accounts may require a resend after the SMTP settings are live. A user who already completed signup should not create repeated duplicate accounts; use the resend confirmation action or sign in after verification.

## Scope

This document does not claim that production SMTP has been configured. Production project settings were not changed by this code change.
