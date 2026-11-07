# Testing Guide

## Automated local checks
```bash
npm ci
npm run typecheck
npm test
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=PLACEHOLDER NEXT_PUBLIC_APP_URL=https://APP.example npm run build
```

Build placeholders are only for compile/build checks; authenticated integration tests require a dedicated test Supabase project and non-production fixtures.

## Required integration matrix
- No session / invalid session for each protected API.
- STUDENT, INSTRUCTOR, ADMIN, suspended user; each role against course/form/response/analytics/export/admin endpoints.
- Student not enrolled, instructor not assigned, manipulated resource IDs, closed/expired forms, malformed question IDs/options, oversized answer payload, duplicate submission.
- Confirm new submission exists in `anonymous_submissions` with no student foreign key and eligibility is tracked separately; confirm instructor endpoint/export never returns raw answers.
- Confirm count 1–4 is suppressed, count 5 is reportable, filters narrow as expected.
- Admin AAL1 denied; AAL2 allowed; self-role change denied; last-active-admin protection; deletion-request valid/invalid state transitions.
- Cross-site mutation origins rejected; same-origin requests accepted; safe public GETs unaffected.
- Keyboard/mobile tests, overflow, form validation, contrast/focus, 404/error recovery.

Do not test destructive account deletion against production data. Do not run migrations on production before drift reconciliation and backup verification.
