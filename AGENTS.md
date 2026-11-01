# Repository instructions

## Product constraints
Follow PRD.md, docs/architecture.md, docs/codestyle.md, docs/SECURITY.md and docs/plan.md.
Legacy `public.responses` stores `student_id` with answers and is identity-linked. It was empty at the anonymous cutover and remains for compatibility/retention; never call its historic rows anonymous.
New submissions must use `public.anonymous_submissions`, which stores no student ID or eligibility key. One-time eligibility and duplicate prevention are separate in `private.feedback_eligibility`.
Do not claim cryptographic anonymity. Minimum-five suppression does not independently prove resistance to complementary suppression or repeated-query differencing.
Never expose raw answers/comments to instructors or administrators through APIs, logs, exports or dashboards.
Do not invent institutional contact details, legal basis, retention requirements, consent rules or payment status.

## Security
Enforce authentication, role and resource scope server-side and in RLS.
Never use user-editable auth metadata for authorization.
Do not add service-role credentials to browser-visible environment variables.
Review SQL functions, views, grants and RLS policies before applying migrations.
Do not perform destructive production operations or reset live data.
Add automated tests for student/instructor/admin access and cross-course IDOR.

## Workflow
Inspect existing code and migrations before editing.
Work on `feat/master-prompt-completion` and update draft PR #2 unless the owner explicitly requests another branch.
Run typecheck, unit tests, production build, dependency audit and relevant security tests.
Verify migrations and exact-SHA preview behavior before merging or claiming release readiness.
Keep docs/plan.md and docs/MASTER-PROMPT-AUDIT.md current.