# CoursePulse RLS and privacy matrix

This matrix reflects the live Supabase `pg_policies` inventory checked on 1 November 2026. Database grants and RLS both apply; a permissive policy does not grant a privilege that has been revoked. Re-run the policy inventory after every migration.

| Resource | Student | Instructor | Administrator | Direct anonymous/authenticated access |
|---|---|---|---|---|
| `users` | Read own profile; update permitted own profile fields | Same | Read directory and update privileged fields only through MFA-gated RPC/API | No anon access; column grants prevent self role escalation |
| `courses` | Read published courses only when enrolled | Read owned or explicitly assigned courses | Read/manage all | RLS scoped; writes require owner/admin |
| `feedback` | Read open forms for enrolled published courses; closed forms only when own eligibility record is consumed | Read/manage forms on owned/assigned courses | Read/manage all | RLS scoped; write grants restricted |
| `course_enrollments` | Read own enrollment rows | Read enrollments for owned/assigned courses | Read/manage all | No direct student/instructor writes |
| `instructor_course_assignments` | No access | Read own assignments | Read/manage all | No direct non-admin writes |
| `departments`, `semesters` | Read catalogue | Read catalogue | Read/manage | RLS admin writes |
| `anonymous_submissions` | No direct read/write | No direct read/write | No direct read/write | Explicit deny policy; submission via security-definer RPC only |
| `private.feedback_eligibility` | No direct read/write | No direct read/write | No direct read/write | Explicit deny policy; private schema and RPC only |
| `private.api_rate_limits` | No direct read/write | No direct read/write | No direct read/write | Explicit deny policy; rate-limit RPC only |
| `responses` (legacy) | Legacy own-row policy exists, but table grants are restricted; new writes do not use this table | No raw read | No raw read | Kept for compatibility/retention; zero rows at anonymous migration cutover |
| `audit_logs` | No access | No access | Read only; writes through audit RPC | No direct insert/update/delete |

## Privacy invariants

1. New response answers are stored in `public.anonymous_submissions` with no student identifier or eligibility key.
2. One-time eligibility is stored separately in `private.feedback_eligibility`; the student-facing completion RPC returns only `feedback_id` and a boolean for the current student.
3. Instructors and administrators receive only aggregate RPC results. The aggregate function suppresses cohorts below five and excludes free-text answers.
4. Student form visibility requires an explicit enrollment and a published course. Closed forms are visible only if that student's eligibility record is consumed.
5. Submission validation and eligibility consumption occur in one database transaction. A database trigger also rejects closed, unpublished or past-deadline submissions.
6. Admin role/suspension and academic changes require AAL2 and are audit logged. The last active administrator cannot demote or suspend themself through the admin RPC.

## Verification still required

- Automated authenticated-role tests against a disposable Supabase project for every SELECT/INSERT/UPDATE/DELETE operation.
- IDOR tests across course, form, enrollment, audit and export endpoints.
- Re-identification and differencing tests beyond the minimum-five suppression threshold.
- Independent review of SQL security-definer ownership, grants and search paths.
- Verify that the legacy `responses` table remains empty and is not reintroduced by any API path.
- Production Auth leaked-password protection is disabled in the current project advisor and must be enabled by an authorized project owner.
