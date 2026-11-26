import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  title: 'About CoursePulse',
  description: 'Learn about CoursePulse, a simple college project for course feedback and results.',
  alternates: { canonical: '/about' }
};

export default function AboutPage() {
  return <PublicPage eyebrow="About the project" title="Course feedback, without the extra complexity." description="CoursePulse is a straightforward college project built to collect course feedback and make the results easy to understand.">
    <section>
      <h2>Why CoursePulse exists</h2>
      <p>The project gives students one simple place to share their experience of a course. It demonstrates how structured feedback can be collected and summarised without building a full college-management or SaaS platform.</p>
    </section>
    <section>
      <h2>What you can do</h2>
      <p>Choose an example course, rate the overall experience, teaching clarity, class pace, and learning resources, then review the course-level summary. The Results page can also export the responses saved in your browser as a CSV file.</p>
    </section>
    <section>
      <h2>One shared public workspace</h2>
      <p>There is no sign-in, account registration, Admin role, or HOD role in this version. Every visitor uses the same public project interface.</p>
    </section>
    <section>
      <h2>About the demo data</h2>
      <p>Feedback is saved in the current browser only. It is not sent to a central college database or shared with visitors on other devices. The course and faculty details shown are example project data and can be replaced with your college information.</p>
    </section>
    <p className="public-note">CoursePulse is an academic demonstration, not an official college feedback or student-record system. Please do not enter private or confidential information.</p>
    <p><Link className="inline-link" href="/privacy">Read the Privacy Policy</Link> or <Link className="inline-link" href="/cookies">review cookie and browser-storage information</Link>.</p>
  </PublicPage>;
}
