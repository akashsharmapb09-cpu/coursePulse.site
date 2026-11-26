# CoursePulse

CoursePulse is a college-project demonstration for student registration, course feedback and simple course-level results. New public registrations create Student accounts only; there are no Admin or HOD sign-up options.

## Current project experience

- Students register with full name, email address, password and academic programme.
- Programme choices include B.Tech, M.Tech, B.E., M.E., BBA, MBA, B.Com, M.Com, BCA, MCA, B.Sc, M.Sc, BA, MA, Pharmacy, Architecture, Diploma and Other/custom.
- Supabase Auth securely handles sign-up, sign-in and student sessions.
- The database creates a Student profile and stores the selected programme with the profile. Public signup cannot choose a role or organization.
- Students can view their name/programme in the site header and sign out.
- Course feedback is anonymous and separate from the account profile. The current demo workspace stores feedback in browser localStorage, not a central college database.
- Course-level summaries and CSV export are available for responses saved in the current browser.

## Important data limitation

Student account credentials and profile records are stored by the connected Supabase project. Feedback is still stored separately in browser localStorage under the `coursepulse-college-demo-responses-v1` key. It is not linked to the student's account, is not synchronised between browsers/devices, and is not shared with another visitor. Clearing site data removes local feedback but does not delete the Supabase student account.

Use this version for an academic project demonstration. Do not submit real confidential student records or private information in feedback comments.

## Stack

- Next.js App Router, React and TypeScript
- Tailwind CSS
- Supabase Auth and Postgres for student identities/profile
- Lucide icons

The project uses the existing pinned dependencies and Node.js 22.x.

## Run locally

~~~bash
npm ci
npm run dev
~~~

Create a local `.env.local` with the Supabase project URL and publishable key to enable registration and sign-in:

~~~bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
~~~

Open http://localhost:3000.

## Validate locally

~~~bash
npm run typecheck
npm test
npm run build
~~~

## Academic project note

This app demonstrates student self-registration and an anonymous browser-local feedback workflow. Browser-local responses are not a substitute for a centrally managed college feedback database or an official institutional reporting process.
