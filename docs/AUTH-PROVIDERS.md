# CoursePulse authentication providers

## Current transition design

CoursePulse is moving to phone-number and password authentication with SMS OTP verification for new accounts.

- New Student accounts use a phone number and password, then verify a six-digit SMS code.
- Normal sign-in uses the verified phone number and password.
- Password recovery sends an SMS OTP; the password is changed only after the OTP is verified.
- Existing users can temporarily sign in through the explicitly labelled legacy email sign-in option, then link and verify a phone number in Account Security.
- New college roster invitations use mobile numbers. A trusted invitation remains pending until that number is verified and the database trigger can attach the correct organization, role and course assignments.
- Historical email values and existing Auth identities are preserved during the transition. They are not bulk-deleted or rewritten.

## SMS provider configuration required before launch

**No SMS provider is currently selected or configured.** The phone-first code path is staged, but SMS delivery is not operational until a supported provider and its credentials are configured directly in Supabase.

Supabase Phone Auth requires:
1. Enable Phone Auth in the production Supabase project under Authentication → Providers.
2. Configure SMS OTP delivery with a supported provider.
3. Keep phone confirmation enabled.
4. Configure appropriate OTP expiry, resend throttling, and provider rate limits.
5. Test delivery using controlled phone numbers before opening public signup.

Supabase documents support for Twilio, MessageBird, Vonage and community-supported TextLocal. Choose one provider and complete its account verification and regional compliance requirements before enabling production settings.

### India-specific sender registration

For Indian domestic SMS routes, complete the provider's current DLT onboarding requirements before sending production OTPs. This can include Principal Entity registration, approved sender/header, approved OTP content template, and provider-to-operator template mapping. Exact requirements depend on the provider and route. Confirm the current requirements directly with the provider and telecom/DLT portal.

### Suggested initial provider

Twilio is a reasonable first option because Supabase documents a native Twilio SMS provider integration. For India, complete the applicable DLT registration and template approval before relying on local OTP delivery.

Never put an SMS provider auth token or API secret in GitHub source files, NEXT_PUBLIC_* variables, browser code, client-side storage, logs or screenshots. Enter credentials directly in Supabase Auth SMS provider configuration. Rotate any credential that was exposed.

## Existing account migration

Existing users should not be deleted or forced into a new account.

1. An existing user signs in with the temporary legacy email/password option.
2. The user opens Account Security.
3. The user requests a phone-change OTP for a number they control.
4. Supabase verifies the phone change.
5. The app can then accept phone/password sign-in for that account.
6. The historical email field remains available for account records during the transition; it is not used for new signup.

The phone verification trigger stores a student's confirmed mobile number in the existing private contact profile. It also checks for an unexpired, trusted invitation addressed to that phone number. Only after verification can an unassigned account be linked to a college and assigned a student/teacher role.

Do not link accounts based only on an unverified phone number, a caller-supplied role, or a roll number.

## Roster invitations

HOD and teacher roster uploads now use mobile numbers rather than requiring email addresses.

- HOD invitations are still protected by the signed-in HOD identity, MFA assurance and active organization scope.
- Teachers can invite students only to their assigned courses.
- Roll-number uniqueness and pending mobile-invitation conflicts are checked before saving.
- A phone-only invitation is stored as pending; it does not create an Auth user or send an SMS from the privileged service-role API.
- The invited user completes signup and SMS verification themselves.
- The verified-phone database trigger consumes the pending invitation and creates the appropriate roster/course assignments.
- Existing confirmed phone accounts can be linked through a trusted invitation.
- Legacy email invitation rows remain supported during transition.

## MFA is separate from SMS verification

SMS OTP for phone confirmation and password recovery is not a replacement for privileged MFA.

HOD access must continue to satisfy the current TOTP/AAL2 authorization checks. Do not lower the HOD MFA requirement or treat successful phone verification as AAL2.

## Rollout checklist

- [ ] Select and open an SMS provider account.
- [ ] Complete India DLT registration/template approvals for the selected route.
- [ ] Configure provider credentials directly in Supabase.
- [ ] Enable Supabase Phone Auth and require phone confirmation in QA first.
- [ ] Run the new phone migration in isolated QA and verify the schema.
- [ ] Test new Student signup, OTP verification and phone/password login.
- [ ] Test OTP resend throttling and invalid/expired OTP behavior.
- [ ] Test password reset through SMS OTP.
- [ ] Test legacy email user phone linking.
- [ ] Test trusted Student, Teacher and HOD phone invitations.
- [ ] Test that unverified phones cannot consume invitations or acquire roles.
- [ ] Test duplicate phone and roll-number protection.
- [ ] Test wrong-tenant and wrong-role invitation rejection.
- [ ] Re-run RLS, API, MFA and anonymous-feedback regression tests.
- [ ] Review pending legacy email accounts and invitation rows.
- [ ] Only after migration coverage is verified, plan removal of legacy email sign-in.

## Environment and release safety

- Keep Supabase development, QA and production Auth settings separate.
- Do not disable production email auth as a shortcut.
- Do not deploy phone-auth code to production until production SMS credentials and provider settings are configured and verified.
- Do not delete auth.users.email, public.users.email, or historical email invitation values as part of this rollout.
- Do not rewrite remote migration history to make timestamps appear aligned.
- Keep each schema change in a new migration and test it against an isolated QA database first.