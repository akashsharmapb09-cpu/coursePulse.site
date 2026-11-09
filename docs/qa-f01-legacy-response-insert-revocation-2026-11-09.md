# QA validation — F-01 legacy response insert revocation

**Date:** 9 November 2026  
**Environment:** isolated QA Supabase project only  
**Production impact:** none

## Change applied

The QA migration `20261109104814_revoke_authenticated_legacy_response_inserts`:

- Revokes table-level INSERT on `public.responses` from `authenticated`.
- Removes the permissive `responses_insert_self_only` policy.
- Preserves authenticated SELECT and the restrictive tenant-boundary policy.

## Post-migration database verification

The post-migration catalog/privilege query returned:

| Check | Result |
|---|---:|
| `authenticated` table-level INSERT on `public.responses` | false |
| `authenticated` any-column INSERT on `public.responses` | false |
| `authenticated` SELECT on `public.responses` | true |
| Permissive INSERT/ALL policies for authenticated/PUBLIC | 0 |
| Restrictive tenant-boundary policies retained | 1 |

The deployed `private.submit_anonymous_feedback(uuid,jsonb)` definition still contains all three required paths: course-enrollment check, one-time `feedback_eligibility` consumption, and insert into `public.anonymous_submissions`.

The Supabase Security Advisor returned zero security lints after the change.

## Verification limits

This change has **not** yet been tested with real Supabase Auth-issued browser sessions or a complete signed-in HTTP role matrix. Required follow-up tests:

1. Enrolled Student submits via `/api/responses` → 201.
2. Duplicate submission → 409.
3. Unenrolled Student submission → rejected.
4. Authenticated direct Data API INSERT into `public.responses` → denied.
5. Student legacy SELECT remains own-row-only.
6. Teacher/HOD raw-answer access remains denied and aggregate RPCs remain functional.
7. `public.anonymous_submissions` remains unreadable to anon/authenticated.
8. Re-run CI and Security Advisor.

## Migration-history note

Repository migration timestamps do not currently match remote QA migration timestamps, although the logical migration names were present on both sides. The Supabase CLI compares timestamps; this PR does not rewrite prior migration history. Reconcile that history separately before using a bulk `db push` workflow.

No production database, deployment, or production data was modified.
