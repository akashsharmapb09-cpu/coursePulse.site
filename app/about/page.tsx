import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  title: 'About CoursePulse',
  description: 'Learn about CoursePulse, a simple college project for student accounts and course feedback.',
  alternates: { canonical: '/about' }
};

export default function AboutPage() {
  return <PublicPage eyebrow="About the project" title="Course feedback, without the extra complexity." description="CoursePulse is a straightforward college project that lets students create an account, choose their programme, and share course feedback.">
    <section>
      <h2>Why CoursePulse exists</h2>
      <p>The project gives students one simple place to create a student profile and share their experience of a course. It demonstrates how structured feedback can be collected and summarised without building a full college-management or SaaS platform.</p>
    </section>
    <section>
      <h2>Create a student account</h2>
      <p>Students enter their name, choose a unique username, select their programme—such as B.Tech, M.Tech, BBA, B.Com, BCA, MBA, or another course—and create a password. No email address or verification message is used. New self-registrations receive Student access only. There are no Admin or HOD sign-up options.</p>
    </section>
    <section>
      <h2>What you can do</h2>
      <p>Open the workspace, rate the overall experience, teaching clarity, class pace, and learning resources, then review the course-level summary. The Results page can also export the responses saved in your browser as a CSV file.</p>
    </section>
    <section>
      <h2>About the demo feedback data</h2>
      <p>Student account details are stored in the connected Supabase project. Feedback in the current demo is stored separately in the current browser only; it is not linked to the student's account or synchronised with visitors on other devices. Course and faculty details are example project data and can be replaced with your college information.</p>
    </section>
    <p className="public-note">CoursePulse is an academic demonstration, not an official college feedback or student-record system. Please do not enter private or confidential information.</p>
    <p><Link className="inline-link" href="/signup">Create a student account</Link>, read the <Link className="inline-link" href="/privacy">Privacy Policy</Link>, or <Link className="inline-link" href="/cookies">review cookie and browser-storage information</Link>.</p>
  </PublicPage>;
}
