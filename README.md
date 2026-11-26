# CoursePulse

CoursePulse is a college-project demonstration for collecting course feedback and viewing simple results. It is intentionally a single public workspace, not a multi-tenant SaaS product.

## Current project experience

- No login or signup flow.
- No Admin, HOD, Super Admin, or other user roles.
- One public workspace for all visitors.
- Example courses with ratings for overall experience, teaching clarity, class pace, and learning resources.
- Optional comments, course-level rating summaries, and CSV export.
- No visitor name, email, password, or roll number is requested.

## Important data limitation

This simplified version stores feedback in the browser localStorage. Data stays in the current browser and device. It is not sent to a shared college database, is not synchronised between visitors, and is not visible on another device. Clearing the browser's site data removes the locally saved responses.

Use this version for a project demonstration with sample data. Do not submit real confidential student records or personal information. For shared multi-device collection, a separate backend and reviewed anonymous-write/read policy would be required.

The former Supabase/Auth and Admin/HOD modules, API route handlers, and SQL migrations remain in the repository as historical project material. They are not used by the current public workspace: legacy login/admin pages redirect to /dashboard, and legacy /api/* endpoints return HTTP 410. Do not apply the old database migrations as part of running this simplified demo.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Lucide icons

The project uses the existing pinned dependencies and Node.js 22.x.

## Run locally

~~~bash
npm ci
npm run dev
~~~

Open http://localhost:3000. No Supabase credentials or environment variables are required for the public demo workflow.

To validate locally:

~~~bash
npm run typecheck
npm test
npm run build
~~~

## Edit the example course list

Edit the COURSES constant near the top of components/public-workspace.tsx. The browser stores response data under the coursepulse-college-demo-responses-v1 localStorage key.

## Deploy

The production site is connected to the GitHub repository and Vercel. Merge a reviewed change into main to trigger the Vercel production deployment. The site is configured to use the public origin https://coursepulse-site.vercel.app.

## Academic project note

This demo illustrates the frontend feedback workflow only. Browser-local storage is not a substitute for a centrally managed database, identity system, or official institutional reporting process.
