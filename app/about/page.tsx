import { createPublicPageMetadata } from '@/lib/public-page-metadata';
import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata = createPublicPageMetadata({
  title: 'About CoursePulse',
  description: 'Learn about CoursePulse, its Student and Teacher workspace, feedback workflow and privacy-protected reports.',
  path: '/about'
});

export default function AboutPage() {
  return <PublicPage eyebrow="About CoursePulse" title="Course feedback, with a clearer path from student voice to teaching insight." description="CoursePulse is a single-college workspace for eligible student feedback, course management and privacy-protected reporting.">
    <section>
      <h2>Why CoursePulse exists</h2>
      <p>CoursePulse gives a college workspace a structured way to collect course feedback and turn it into useful course-level summaries. Students see the courses and forms for which they are eligible. Teachers manage their assigned courses and use aggregate reports to understand feedback patterns.</p>
    </section>
    <section>
      <h2>Student and Teacher access</h2>
      <p>Students create an account with their name, choose a unique username, a programme and a password. For Student registration, no email address or verification message is needed. Teacher access is provided through invitation. Teachers sign in with the credential provided for their account, which may be a demo username or registered college email.</p>
    </section>
    <section>
      <h2>How feedback works</h2>
      <p>Students can open forms attached to published courses in which they are enrolled, complete structured questions and submit eligible feedback once. Submission is handled by the application server and stored in the connected Supabase database. New answer records are kept separate from student sign-in details, while a private eligibility record supports course access and duplicate-submission prevention.</p>
    </section>
    <section>
      <h2>Teacher reports</h2>
      <p>Teachers can manage their assigned courses and feedback forms, use question categories and deadlines, review filtered aggregate analytics, compare courses, and export reportable summaries. The reporting service does not return raw answer rows or free-text comments. Question groups and rating bins with fewer than five responses are suppressed.</p>
    </section>
    <p className="public-note">CoursePulse is a demonstration workspace, not an institution-approved student-record system or legal privacy certification. Do not include identifying or confidential information in free-text feedback.</p>
    <p><Link className="inline-link" href="/signup">Create a student account</Link>, read the <Link className="inline-link" href="/privacy">Privacy Policy</Link>, or <Link className="inline-link" href="/cookies">review cookie information</Link>.</p>
  </PublicPage>;
}
