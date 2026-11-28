import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/support' },
  title: 'Support',
  description: 'Help with CoursePulse accounts, course access, feedback submission and Teacher analytics.'
};

export default function SupportPage() {
  return (
    <PublicPage
      eyebrow="Support"
      title="A little help when you need it."
      description="Answers about Student and Teacher accounts, course access, feedback forms and reporting."
    >
      <section>
        <h2>Where are my courses or feedback forms?</h2>
        <p>Students see published courses and open feedback forms only when they are enrolled and eligible. If a course or form is missing, ask the Teacher or department office that manages your course to check publication and enrolment. Teachers can view courses they own or have been assigned.</p>
      </section>
      <section>
        <h2>Why are my graphs or results empty?</h2>
        <p>Teacher analytics show aggregates, not individual answer rows. Question groups and rating bins with fewer than five responses are suppressed, so a small cohort may show an empty graph or no value. Check the selected course, semester, department, date range and question-category filters. A report becomes visible only when it has enough eligible responses to meet the privacy threshold.</p>
      </section>
      <section>
        <h2>Is my feedback linked to my account?</h2>
        <p>New feedback answer records are stored separately from student sign-in details. A private eligibility record is used separately to decide whether you can submit a form and to prevent duplicate submissions. This reduces direct identity exposure in reports but does not guarantee absolute anonymity; avoid identifying yourself in free-text comments.</p>
      </section>
      <section>
        <h2>How do I submit feedback?</h2>
        <p>Sign in with your Student account, open an available form for an enrolled course, complete its required questions and submit once. The confirmation page appears after the server accepts the submission. If you receive an error, note the non-sensitive message and contact the course or technical support channel.</p>
      </section>
      <section>
        <h2>I forgot my password. What can I do?</h2>
        <p>Student accounts use a username rather than an email address, so email-based self-service password recovery is not available for those accounts. A signed-in user can change their password through account security controls. If you have lost access, contact the Teacher or department office that provided your access. Never share your password or sign-in codes.</p>
      </section>
      <p>Still stuck? See the <Link className="inline-link" href="/contact">contact information</Link> and use the channel where you received CoursePulse.</p>
    </PublicPage>
  );
}
