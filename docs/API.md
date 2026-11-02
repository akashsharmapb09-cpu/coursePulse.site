# CoursePulse API reference

All handlers live under app/api in the Next.js App Router. Protected routes require a valid Supabase session. The server derives identity and role from the protected profile; clients must not submit role or ownership claims. JSON request bodies are validated at the server boundary. Mutations use same-origin checks and per-user database rate limits where specified.

Successful private reads return Cache-Control: no-store. Errors use a JSON error field.

## Account

| Method and path | Access | Purpose |
|---|---|---|
| GET /api/account/data-deletion | Signed-in user | Read only the current user's deletion requests. |
| POST /api/account/data-deletion | Signed-in active user | Submit one data-deletion request. Body is an empty JSON object. Limit: 2 attempts per 24-hour window. |
| POST /api/account/password | Signed-in user | Verify current password, update password and attempt global session revocation. Body fields: current_password and new_password. New password length: 10–72. |
| PATCH /api/account/profile | Signed-in user | Update only the current profile display name. Body field: full_name, 2–100 characters. |

## Academic workspace

| Method and path | Access | Purpose |
|---|---|---|
| GET /api/courses | Signed-in user | List courses visible under RLS. Students receive instructor display names only for their enrolled, published courses. |
| POST /api/courses | Instructor or admin | Create a course. Server assigns the creator as instructor. Limit: 10/hour/user. |
| PATCH /api/courses | Instructor or admin | Update an authorized course. Body has UUID id and optional title, description, status or course_code. Limit: 10/hour/user. |
| GET /api/admin/academic | Admin, MFA | Read departments, semesters, courses, users, enrollments and instructor assignments. |
| POST /api/admin/academic | Admin, MFA | Create departments, semesters, enrollments or instructor assignments using a validated action field. |
| PATCH /api/admin/academic | Admin, MFA | Update department/semester metadata, course academic linkage or a user's department. |
| GET /api/admin/users | Admin, MFA | Read user directory. |
| PATCH /api/admin/users | Admin, MFA | Change role or active status through guarded database RPC. Last-active-admin protections apply. |
| GET /api/admin/audit | Admin, MFA | Read most recent 50 audit events. |
| GET /api/admin/overview | Admin, MFA | Read institution totals, participation rate, reportable average rating and privacy-safe low-participation alerts. |
| GET /api/admin/deletion-requests | Admin, MFA | Read data-deletion request queue (maximum 100). |
| PATCH /api/admin/deletion-requests | Admin, MFA | Review a request. Body fields: request_id, status and resolution_note. Allowed next statuses depend on current status. COMPLETED requires an explanatory verification note; the API does not delete Auth accounts automatically. |

## Feedback

| Method and path | Access | Purpose |
|---|---|---|
| GET /api/feedback | Signed-in user | List visible forms. Optional query parameter id returns one form. Students receive only their own completion state. |
| POST /api/feedback | Instructor or admin | Create form with 1–30 validated questions, retention and optional deadline. Limit: 10/hour/user. |
| PATCH /api/feedback | Instructor or admin | Update form title, description, questions, due date or open state. Preserve existing question IDs when editing. Limit: 10/hour/user. |
| POST /api/responses | Student | Submit answers to an eligible open form. Limit: 5/minute/user. Database RPC consumes eligibility and inserts answer payload atomically; duplicates return HTTP 409. |
| GET /api/feedback/{id}/versions | Form owner/instructor or admin | Read form version history. |
| POST /api/feedback/{id}/versions | Form owner/instructor or admin | Restore a saved version. Body field: version. Limit: 10/hour/user. |

## Analytics and exports

| Method and path | Access | Purpose |
|---|---|---|
| GET /api/analytics | Instructor or admin | Return filtered aggregate rows, rating distributions and weekly trends. |
| GET /api/exports/{format} | Instructor or admin | Download csv, xls, xlsx or pdf using the shared aggregate service. |

Supported query parameters for both analytics and exports:

- course_id, semester_id and department_id: UUID filters.
- from_date and to_date: inclusive YYYY-MM-DD date bounds.
- question_category: one of seven values in lib/question-categories.ts.

Instructor course scope is enforced by database RPCs. Groups and rating bins below five responses are suppressed. Raw answer rows and free-text comments are not returned. The xls format is an Excel-compatible HTML Spreadsheet; xlsx is native Office Open XML.

## Search

| Method and path | Access | Purpose |
|---|---|---|
| GET /api/search?q={term} | Signed-in user | Search authorized course titles/codes, feedback forms and departments. Students see instructor names only for their own enrolled published courses; user directory search is admin-only. |

Search terms are normalized to 2–80 characters and limited to 60 requests/minute/user. Search does not search feedback answer text or comments.

## Error conventions

- 401: no valid signed-in session.
- 403: role, MFA, course scope or database policy rejects the operation.
- 404: resource or route not found.
- 409: duplicate submission or state conflict.
- 429: explicit search rate-limit response.
- 500/503: safe generic internal/dependency error.

These routes are not a versioned public integration API. Review the route schemas and RLS/RPC migrations before building external clients.
