# Test-data and seed strategy

CoursePulse intentionally creates no default administrator credentials and does not silently insert fictional students into a connected database.

## Environments

- Production: existing Supabase project. Never seed synthetic users, demo answers or sample departments here.
- Preview: currently shares the production Supabase project URL in Vercel. Treat preview writes as production writes; do not run write-heavy browser E2E against this environment.
- Disposable QA: create a separate Supabase project, configure its own Auth URL/keys and database connection, apply repository migrations in order, and use synthetic identities only. This is the required environment for integration/E2E fixtures.

## First administrator

New signups receive the STUDENT role by default. The first administrator must be assigned by the project owner through the reviewed owner-only SQL helper/script described in scripts/promote-role.sql. Enroll and verify TOTP MFA (AAL2) before using privileged dashboard operations. Never commit passwords, recovery codes, service-role keys or a preconfigured admin account.

## Synthetic test identities

For a disposable QA project only, create users through Supabase Auth (not by inserting rows into public.users alone). Use reserved example.test email addresses, synthetic labels and one-off test credentials. Assign roles through the controlled administrator process. Create a synthetic department, semester, course, instructor assignment and student enrollment.

Do not create a fake identity-to-anonymous-answer mapping. Test anonymous submission by checking that private eligibility is consumed while public.anonymous_submissions stores only feedback_id, answer JSON and date-level receipt—not an Auth user ID, email, IP address or eligibility key.

## Reset and cleanup

Reset or drop only the disposable QA project. Before any reset or cleanup, verify the Supabase project ref in the CLI/dashboard matches the QA project. Do not run supabase db reset, destructive SQL or bulk sample data against production.
