# CoursePulse

CoursePulse is a single-college course feedback and learning analytics portal with exactly two account roles: **Student** and **Teacher**. There is no HOD, Admin or Super Admin account, signup path or dashboard.

## Student accounts

- Students register with their full name, a unique username, password and academic programme.
- Programme choices include B.Tech, M.Tech, B.E., M.E., BBA, MBA, B.Com, M.Com, BCA, MCA, B.Sc, M.Sc, BA, MA, Pharmacy, Architecture, Diploma and Other/custom.
- Students sign in with their username and password. The username maps to a private, non-deliverable Supabase Auth identity; it is not shown as an email address to the student.
- Student registration is rate-limited server-side. Student account recovery must be handled by the project team.

## Teacher accounts

- Teachers register with their full name, college email and password. Supabase email confirmation is required before first sign-in.
- Teachers sign in with their college email and password.
- A Teacher can create and manage their own courses, create and edit feedback forms, manage questions, view privacy-protected analytics, compare courses and download aggregate reports.
- Course ownership is enforced by server-side role checks and Supabase Row Level Security. A Teacher cannot manage another Teacher's course unless it is explicitly assigned.
- There is no administrator role or privileged account-management interface.

## Feedback and privacy

- Students can only access eligible feedback forms for courses in which they are enrolled.
- Feedback answers are stored separately from student identity and eligibility records. The one-time submission/duplicate-prevention record lives in a private table; anonymous answer rows do not include a student ID.
- Teachers see only privacy-protected reports. Groups with fewer than five submissions are suppressed, and raw student answers are not exposed in analytics or exports.
- Do not submit real confidential student records or sensitive personal information in free-text comments during a classroom demonstration.

## Stack

- Next.js App Router, React and TypeScript
- Tailwind CSS
- Supabase Auth and Postgres with Row Level Security
- Supabase Edge Functions for username-based Student auth and secure roster invitations
- Lucide icons

The project uses the existing pinned dependencies and Node.js 22.x.

## Run locally

```bash
npm ci
npm run dev
```

Create a local `.env.local` with the Supabase project URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

The `student-username-auth` Edge Function must be deployed for Student registration and sign-in. Teacher registration uses Supabase Auth email confirmation. Server-side Auth keys must remain in Supabase Edge Function secrets and must never be exposed in browser code.

Open http://localhost:3000.

## Validate locally

```bash
npm run typecheck
npm test
npm run build
```
