# CoursePulse security model

## Identity and roles

Supabase Auth owns credentials. `public.users` is a profile table created by an `auth.users` trigger. New users always receive `STUDENT`; role assignment is an administrative SQL operation and is not exposed by the application. Profile self-updates are limited by column grants to `full_name`.

## RLS boundaries

- Students can read only their own profile and legacy response rows. They can view published courses and open feedback forms. New submissions consume a private one-time eligibility record and write answers to `public.anonymous_submissions` without a student ID or eligibility reference.
- Instructors can select and mutate only courses they own. Feedback forms are scoped through the owned course. They cannot select raw rows from either response store.
- Admins can manage workspace courses and academic configuration only after verified TOTP MFA (AAL2); they cannot select raw response rows. Student eligibility is held in `private.feedback_eligibility`; the private ledger and answer store are not readable through the Data API.
- Suspended profiles are treated as inactive by the role helper and application API guard. Existing Supabase sessions no longer authorize app data access.
- Students can access only courses/forms for which an explicit course enrollment exists. Instructors can access courses they own or are assigned to.
- The submission RPC validates the form and all answer values at the database boundary, atomically consumes eligibility, and raises a duplicate-submission error when the same student attempts a second submission.
- `private` contains `SECURITY DEFINER` authorization and aggregation helpers. It is not intended to be exposed through the Supabase Data API. Exposed `public.get_instructor_aggregates()` is a `SECURITY INVOKER` wrapper.

## Export privacy

All instructor/admin exports call the aggregate RPC, which unions legacy and anonymous answer stores. Groups with fewer than five unique responses are omitted. Text/textarea question values are never returned by the RPC. CSV output quotes all cells and prefixes formula-leading values. XLSX and PDF are generated from the same aggregate projection. Never add a raw response query to export code.

## Retention

Every feedback form has `retention_days` constrained to 30-730 days. Supabase `pg_cron` runs `public.cleanup_expired_responses()` daily at 20:17 UTC. It removes expired legacy answers, anonymous answers and old rate-limit buckets. Deleting a feedback form or course cascades to its answer rows and eligibility ledger. Review the Supabase Cron job history periodically.

## Mutation protections

- Authenticated course creation, feedback form creation and response submission enforce same-origin Origin/Referer checks.
- A private Postgres rate-limit ledger enforces per-user action windows for course/form creation, response submission and administrator updates; the API fails closed if the rate-limit RPC is unavailable.
- Role changes and suspensions use a security-definer RPC that prevents an administrator from removing their own access or demoting/suspending the last active administrator. Privileged user and academic changes are audit logged.
- The Next.js middleware issues a per-request nonce-based CSP with strict-dynamic, object-src none and frame-ancestors none. script-src does not allow unsafe-inline, unsafe-eval or data:. X-XSS-Protection is explicitly set to 0 because the legacy browser filter is deprecated.
- Supabase Auth leaked-password protection is currently reported disabled by the security advisor and must be enabled in the Auth dashboard.

## Operational requirements

- Keep `DATABASE_URL` and `DIRECT_URL` server-only. Never add `NEXT_PUBLIC_` prefixes to them.
- The Supabase publishable/anon key is designed for public clients only when paired with RLS. Never expose service-role or secret keys.
- Configure Supabase Auth redirect URLs for the production domain.
- Enforce MFA for admins in the Supabase Auth project settings and verify the assurance level on privileged actions.
- Use a strong database password and SSL (`sslmode=require`).
- Keep retention days no longer than the actual educational purpose requires.


## Browser security headers

The application now applies a per-request Content Security Policy in middleware. A cryptographically random nonce is forwarded to Next.js and included in script-src with strict-dynamic; unsafe-inline, unsafe-eval and data: are not allowed as script sources. Plugin execution and embedded frames are blocked with object-src none and frame-src none; framing of the CoursePulse app is blocked with frame-ancestors none.

The policy keeps style-src-attr unsafe-inline only for React-rendered numeric/visual style attributes used by progress indicators and charts; it is not included in script-src. Scripts still require the per-response nonce or same-origin policy.

X-XSS-Protection: 0 is intentional. The old browser XSS auditor is deprecated and can create vulnerabilities; modern XSS mitigation is provided by the nonce-based CSP and framework output escaping. Do not change this to 1; mode=block merely to satisfy a legacy header scanner.

A machine-readable contact file is published at /.well-known/security.txt. Its contact points to GitHub Security Advisories. Before public launch, a repository owner must enable and verify GitHub private vulnerability reporting under repository Settings > Security, and test that the contact destination accepts a private report. Do not ask researchers to post vulnerability details in a public issue.

The CSP and security.txt format have automated regression tests. After deployment, verify the response headers on the public .site domain and test the nonce/hydration flow in Chromium, Firefox and WebKit. A code-level test alone is not a browser security sign-off.
