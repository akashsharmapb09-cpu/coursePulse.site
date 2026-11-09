# QA authenticated database authorization check

**Date:** 2026-11-09  
**Environment:** isolated QA Supabase project `opwiqrgnhshywangefvk`  
**Code under test:** PR #13, prior verified app commit `ca8740aa02b5346cc7eed97c28480c8b701a71ae`  
**Production impact:** none

## Method and important limitation

This was an authenticated-database authorization/RLS test, not a real GoTrue sign-in or browser role-matrix test. Eight synthetic identities were created only in the QA database. Each check ran inside a transaction with the actual PostgreSQL `authenticated` role and request JWT claims set for the relevant synthetic subject and assurance level:

- `SET LOCAL ROLE authenticated`
- `request.jwt.claims = { sub, role: "authenticated", aal }`

This exercises PostgreSQL grants, RLS policies and security-definer RPC authorization in the same database role/context used by PostgREST. It does **not** verify password login, signed-token issuance/signature validation, refresh/logout, email invitation acceptance, actual TOTP enrollment/verification, or full HTTP flows.

## Synthetic role matrix

Two tenant workspaces were used: QA College A and QA College B. The test included one Head, one assigned teacher, one additional teacher, one enrolled student and one additional student in College A, and one Head, one teacher and one student in College B.

| Synthetic identity | JWT assurance | Observed access |
|---|---|---|
| Student A | AAL1 | One organization, own profile, enrolled course, own directory entry, own suggestion and own legacy response only. No teacher notifications. |
| Teacher A | AAL1 | One organization, own profile, assigned course and one assigned student in the roster RPC. One addressed notification. No legacy responses, student suggestions or private mobile directory access. |
| Head A | AAL1 | `private.is_admin() = false`; own profile only; no Head roster, feedback analytics or student directory access. Head roster RPC rejects with SQLSTATE 42501. |
| Head A | AAL2 | College A only: five profiles, two courses, two enrollments, two directory rows, two Head-roster rows, one feedback form and one suggestion. Not a platform admin. |
| Student B | AAL1 | College B only: own profile, course, enrollment, directory row and suggestion. No College A records. |
| Teacher B | AAL1 | College B only: assigned course, own profile, assigned roster and addressed notification. No College A records or student contact table. |
| Head B | AAL2 | College B only: three profiles, one course, one enrollment, one directory row, one Head-roster row, one feedback form and one suggestion. Not a platform admin. |

## Negative authorization tests

The following attempts were made using the synthetic authenticated database role and were rejected:

| Attempt | Result |
|---|---|
| Head A at AAL1 calling the Head student roster RPC | Rejected, SQLSTATE 42501 (Head MFA required) |
| Teacher A requesting a course assigned to another teacher | Rejected, SQLSTATE 42501 |
| Teacher A requesting a College B course roster | Rejected, SQLSTATE 42501 |
| Teacher A querying private student contact/mobile storage | Rejected, SQLSTATE 42501 |
| Student querying `public.anonymous_submissions` directly | Rejected at SQL privilege layer, SQLSTATE 42501 |
| Student attempting to update their own application role in `public.users` | Rejected at SQL privilege layer, SQLSTATE 42501 |
| College Head calling platform tenant listing without platform-admin membership | Rejected, SQLSTATE 42501 |
| Student A attempting a direct course-enrollment insert into College B | Rejected by RLS, SQLSTATE 42501 |
| Teacher A calling the Head roster RPC | Rejected, SQLSTATE 42501 |

## Positive mutation checks

- AAL2 College Head successfully transitioned a synthetic suggestion from `RECEIVED` to `UNDER_REVIEW` inside a transaction; the transaction was rolled back after verification.
- A student successfully inserted their own suggestion for a course in which they were enrolled; the transaction was rolled back after verification.
- Database trigger `private.guard_student_suggestion_update()` enforces immutable student content/ownership and validates the permitted status transition graph. Content update privileges are not granted to authenticated clients.

## Anonymous feedback and identity boundary

- Direct client SELECT on `public.anonymous_submissions` is not granted to `authenticated`; the attempted query returned 42501.
- Teacher and Head checks returned no access to the legacy `responses` rows belonging to another student. Student A could see only their own legacy response, which remains a legacy identity-linked record and is **not** treated as anonymous.
- Teacher roster RPC returned the assigned student identity fields without mobile or any feedback-answer mapping.
- Head roster RPC requires AAL2 and is tenant-scoped; it is the only tested role path that returns private directory mobile information.

## Cleanup verification

All eight synthetic Auth identities and their related profiles, courses, enrollments, assignments, directory/contact records, feedback forms, synthetic submissions, suggestions and notifications were deleted after the checks. QA returned to:

- 0 Auth users and 0 application profiles
- 0 departments, courses, enrollments, assignments, directory/contact rows
- 0 feedback forms, legacy responses, anonymous submissions, suggestions and teacher notifications
- 1 original QA organization with `SETUP_REQUIRED` status

No synthetic fixture was copied to production.

## Automated pipeline and database checks

For commit `ca8740aa02b5346cc7eed97c28480c8b701a71ae`, GitHub Actions run [42565436665](https://github.com/akashsharmapb09-cpu/coursePulse.site/actions/runs/42565436665) completed successfully:

- repository secret-history scan
- dependency audit
- Prisma schema validation
- TypeScript typecheck
- 197 unit tests
- production build
- public Playwright browser smoke tests
- mobile Lighthouse audit

Supabase Security Advisor on the isolated QA project returned zero security lints.

## Remaining pre-production gates

This evidence does **not** justify a production-ready declaration yet. These checks remain necessary:

1. Real Supabase Auth login and session lifecycle testing with signed tokens; actual TOTP enrollment and verification for College Head and platform owner.
2. Real invitation delivery and acceptance for Head, teacher and student accounts, including SMTP/provider, Site URL and redirect allow-list validation.
3. HTTP-level role/tenant E2E and IDOR tests against signed-in sessions; QR expiry/revocation and invitation replay tests.
4. Provision the first internal platform-admin identity through a trusted operator workflow.
5. Configure and test the AI provider secrets; review AI output with synthetic aggregate data.
6. Institution-approved privacy/terms/retention, WCAG 2.2 AA and screen-reader assessment, backup/restore evidence and release/rollback approval.
7. Billing/payment integration remains unimplemented; subscription labels are metadata only.

**Release status:** QA preview checked; not production-ready; PR remains unmerged and production database/deployment unchanged.
