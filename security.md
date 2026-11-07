# Security Notes

## Scope and principles
CoursePulse web routes, Supabase Auth, Postgres/RLS, anonymous feedback storage, reporting, admin workflows, and Vercel deployment. Controls follow least privilege, defense in depth, secure defaults, privacy by design, and fail-secure behavior.

## Verified/implemented controls in this change set
- Supabase request-scoped authentication and database RLS remain the primary access boundary.
- Response API now submits through `submit_anonymous_feedback`; it no longer inserts new student-linked records into legacy `responses`.
- Database checks eligibility, enrollment, form state/deadline, answer types/options, and duplicate prevention atomically.
- Aggregate RPCs enforce course authorization and suppress reporting groups below five.
- Admin console/API require an ADMIN role and MFA AAL2; protected DB procedures independently verify MFA. User updates block self-demotion and last-admin lockout.
- Rate limiting calls the database-backed `consume_api_rate_limit` for course/form/response/search/analytics/export/admin user updates.
- Zod validation, safe API errors, no-store response headers, and same-origin checks for cookie-authenticated API mutations.
- CSP, nosniff, frame denial, referrer/permissions policy, and production HSTS configured in `next.config.ts`.
- No private service credential is exposed through `NEXT_PUBLIC_` configuration in the inspected repo; `.env.example` uses placeholders.

## Anonymous feedback model
Eligibility records and answer content are held separately. The eligibility ledger necessarily knows the student/form relation to prevent duplicate submissions. The answer row does not contain the student's ID. Small reporting groups are suppressed. This does **not** prove cryptographic anonymity or eliminate all inference from timing, operational logs, network metadata, or institutional context. Legacy response rows include student IDs and require a separately reviewed retention/migration process.

## Known risks / actions required before production sign-off
1. Supabase security advisor reports leaked-password protection disabled. Enable in Supabase Auth settings and test signup/password flows.
2. Advisor warns `public.claim_admin_signup(p_code text)` is an authenticated-callable SECURITY DEFINER RPC. Inspect/review grants, body, rate limits, and bootstrap requirements; do not revoke until the admin bootstrap path is confirmed.
3. Supabase earlier flagged `private.admin_signup_settings` as lacking RLS. Current grants show `anon` has no private-schema usage/table access and `authenticated` lacks table privileges, but the table/control plane still needs an owner-approved RLS/grant design and a fresh advisor run.
4. The live DB contains later migrations/RPCs not represented by the current repository migration set. Reconcile migration history before schema deployment.
5. No historical secret scan, credential rotation proof, independent penetration test, production role-matrix test, or legal assessment is claimed.
6. CSP retains `unsafe-inline` for compatibility with current Next.js runtime scripts/styles. Move to a nonce-based policy before tightening further; test all Supabase/Auth/font paths.
7. Rate-limit RPC coverage does not automatically cover every Supabase Auth endpoint; configure Supabase Auth provider limits and abuse protections.
8. Children/guardian age assurance is not implemented. Institution must decide whether minors can access and supply appropriate policy/consent controls.
9. No third-party analytics provider is configured; do not claim analytics event collection is active.

## Incident and data handling
Do not log passwords, refresh/access tokens, service credentials, feedback answer text, or identity-to-feedback mappings. Keep backups and retention schedule under institution control. Review deletion requests, verify identity, record an explanation, and verify deletion/anonymization before marking a request completed.
