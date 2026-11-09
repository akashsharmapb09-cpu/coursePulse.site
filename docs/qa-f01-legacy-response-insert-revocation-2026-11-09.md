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

## Transactional regression test

A transaction-only test used three synthetic Auth identities (one Instructor, one enrolled Student, one unenrolled Student), one published course, one open feedback form, and one enrollment. The SQL set the PostgreSQL role to `authenticated` and set the request JWT subject/role/assurance claims. The test ran all cases in one transaction and rolled it back.

| Case | Result |
|---|---|
| Enrolled Student calls `private.submit_anonymous_feedback` | Passed; one identity-free answer row created inside the transaction |
| Duplicate submission by same Student | Passed; RPC returned SQLSTATE `23505` |
| Unenrolled Student calls submission RPC | Passed; RPC returned SQLSTATE `P0002` |
| Authenticated role attempts direct INSERT to `public.responses` | Passed; rejected for insufficient privilege |
| One-time eligibility for enrolled Student | Passed; consumed exactly once |
| Eligibility row for unenrolled Student | Passed; no row created |
| Legacy response row for test feedback | Passed; no row created |

After rollback, a separate query confirmed the QA workspace was restored to its initial empty state: zero Auth users, profiles, courses, feedback forms, enrollments, legacy responses, and anonymous submissions; organization status returned to `SETUP_REQUIRED`.

**Test boundary:** this validates PostgreSQL privileges, RLS/request-claim behavior, and the database RPC in an authenticated database-role context. It is not a real GoTrue-issued signed JWT, browser sign-in, or end-to-end HTTP test through `/api/responses`.

## CI evidence

GitHub Actions run [42603966256](https://github.com/akashsharmapb09-cpu/coursePulse.site/actions/runs/42603966256) for the PR commit `c956aee8a4e49bcacd02b8b796b1724af0b1b9ff` completed successfully. The workflow passed:

- repository secret-history scan
- dependency audit
- Prisma validation
- TypeScript typecheck
- Vitest tests
- production build
- public Playwright browser smoke tests
- mobile Lighthouse audit

These browser tests are the repository's configured public smoke tests; they do not constitute authenticated role-matrix coverage.

## Remaining verification limits

The following still require real Supabase Auth-issued sessions and signed-in HTTP tests:

1. Enrolled Student submits via `/api/responses` → 201.
2. Duplicate HTTP submission → 409.
3. Unenrolled Student HTTP submission → rejected.
4. Supabase Data API HTTP INSERT into `public.responses` → denied.
5. Student legacy SELECT remains own-row-only.
6. Teacher/HOD raw-answer access remains denied and aggregate RPCs remain functional.
7. `public.anonymous_submissions` remains unreadable to anon/authenticated through the Data API.

## Migration-history note

Repository migration timestamps do not currently match remote QA migration timestamps, although the logical migration names were present on both sides. The Supabase CLI compares timestamps; this PR does not rewrite prior migration history. Reconcile that history separately before using a bulk `db push` workflow.

No production database, deployment, or production data was modified.


## Legacy-read and anonymity compatibility regression

A second transaction-only fixture created two Students in the same QA tenant and inserted one synthetic legacy response for each as the database owner. Under the PostgreSQL `authenticated` role with Student A's request claims:

- Student A could see exactly one row in `public.responses` (their own).
- Student A could not see Student B's legacy response.
- SELECT from `public.anonymous_submissions` failed with insufficient privilege.

Under the PostgreSQL `anon` role, SELECT from `public.anonymous_submissions` also failed with insufficient privilege.

The second transaction was rolled back. A separate query confirmed QA returned to zero Auth users, profiles, courses, feedback forms, legacy responses and anonymous submissions; the workspace status remained `SETUP_REQUIRED`.

These are PostgreSQL role/request-claim simulations, not HTTP tests using signed Supabase Auth access tokens.
