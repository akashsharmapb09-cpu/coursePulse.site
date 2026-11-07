# API Overview

All `/api/*` routes use server-side Supabase authentication. Authenticated routes return `401` without a session and `403` when the role/resource policy does not allow the operation. State-changing cookie-authenticated requests are origin checked in middleware.

| Route | Method | Purpose |
|---|---|---|
| `/api/courses` | GET/POST | Authorized course list / course create |
| `/api/feedback` | GET/POST | Authorized form list/detail / create a form with validated questions and deadline |
| `/api/feedback/[id]` | PATCH | Authorized instructor/admin open/close a feedback form |
| `/api/responses` | POST | Student-only anonymous submission via `submit_anonymous_feedback` |
| `/api/analytics` | GET | Instructor/admin aggregate rows, rating distribution, weekly response trends; supports `course_id`, `semester_id`, `department_id`, `from_date`, `to_date` |
| `/api/exports/[format]` | GET | Authorized aggregate CSV/XLS/PDF export |
| `/api/search?q=` | GET | Debounced permission-aware course/form/department/instructor search; admin user search requires AAL2 |
| `/api/admin` | GET | AAL2 admin overview, user directory, departments, semesters, courses, deletion requests, audit log |
| `/api/admin` | PATCH | AAL2 role/active-state update via database procedure |
| `/api/admin` | POST | AAL2 department/semester creation, enrollment, instructor assignment, deletion-request review |

The live database RPC definitions are authoritative. See `architecture.md` and `security.md` before changing a route or function contract.
