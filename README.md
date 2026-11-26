# CoursePulse

CoursePulse is a college-project demonstration for student registration, course feedback and simple course-level results. New public registrations create Student accounts only; there are no Admin or HOD sign-up options.

## Student account experience

- Students register with their full name, a unique username, password and academic programme.
- Programme choices include B.Tech, M.Tech, B.E., M.E., BBA, MBA, B.Com, M.Com, BCA, MCA, B.Sc, M.Sc, BA, MA, Pharmacy, Architecture, Diploma and Other/custom.
- Students sign in using username and password. No email address, phone number, verification message or email recovery is used.
- A server-side Supabase Edge Function creates immediately confirmed Auth accounts and returns a session; passwords remain managed by Supabase Auth.
- The Auth provider uses a reserved, non-deliverable internal identifier ending in `.invalid` only to support username/password authentication. It is not shown to students and no messages are sent to it.
- Student profiles store the name, username and programme. New profiles do not store an email address.
- Registration and login attempts are rate-limited server-side. Password reset or account recovery must be handled by the project team.
- Students can view their name, username and programme in the site header and sign out.

## Feedback and data

Course feedback is anonymous and separate from the student account profile. The current demo workspace stores feedback in browser localStorage under `coursepulse-college-demo-responses-v1`, not a central college database. Feedback is not linked to the student's account, is not synchronised between browsers/devices, and is not shared with another visitor. Clearing site data removes local feedback but does not delete the Supabase student account.

Use this version for an academic project demonstration. Do not submit real confidential student records or private information in feedback comments.

## Stack

- Next.js App Router, React and TypeScript
- Tailwind CSS
- Supabase Auth and Postgres for student identities/profile
- Supabase Edge Function for username-based registration and sign-in
- Lucide icons

The project uses the existing pinned dependencies and Node.js 22.x.

## Run locally

~~~bash
npm ci
npm run dev
~~~

Create a local `.env.local` with the Supabase project URL and publishable key:

~~~bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
~~~

The Edge Function `student-username-auth` must also be deployed in the connected Supabase project. Supabase supplies its server-side Auth keys to the Edge Function environment; never place service/secret keys in browser code or commit them to this repository.

Open http://localhost:3000.

## Validate locally

~~~bash
npm run typecheck
npm test
npm run build
~~~

## Academic project note

This app demonstrates student self-registration and an anonymous browser-local feedback workflow. Browser-local responses are not a substitute for a centrally managed college feedback database or an official institutional reporting process.
