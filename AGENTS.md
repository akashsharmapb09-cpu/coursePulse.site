# Repository instructions

## Product constraints
Follow PRD.md, docs/architecture.md and docs/codestyle.md.
The existing responses.student_id plus answer payload is NOT anonymous. Never describe it as anonymous. Target design separates eligibility from anonymous answer storage.
Never expose raw answers to instructors or administrators through APIs, logs, exports or dashboard components.
Cohort suppression defaults to at least five responses. Review complementary suppression and small-category disclosure risks.
Do not invent institutional contact details, legal basis, retention requirements, consent rules or payment status.

## Security
Enforce authentication, role and resource scope server-side and in RLS.
Never use user-editable auth metadata for authorization.
Do not add service-role credentials to browser-visible environment variables.
Review SQL functions, views, grants and RLS policies before applying migrations.
Do not perform destructive production operations or reset live data.
Add tests for student/instructor/admin access and cross-tenant object access.

## Workflow
Inspect existing code and migrations before editing.
Make changes on a feature branch and open a pull request.
Run typecheck, unit tests, build, dependency audit and relevant security tests.
Verify migrations and production behavior before merging or claiming completion.
Keep docs/plan.md current.
