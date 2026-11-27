import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/support' },
  title: 'Support',
  description: 'Help with CoursePulse student accounts, the feedback demo, and local results.'
};

export default function SupportPage() {
  return (
    <PublicPage
      eyebrow="Support"
      title="A little help when you need it."
      description="Answers about the student account and the CoursePulse course-feedback demonstration."
    >
      <section>
        <h2>Where are my courses?</h2>
        <p>The workspace currently includes example college courses for demonstration. Course availability depends on the courses published to your workspace and your enrollment. If the example course list does not match the courses you need, use the contact route shared with you when you received CoursePulse.</p>
      </section>
      <section>
        <h2>Why are my results empty?</h2>
        <p>The student workspace demo saves feedback in the browser you are using. Results show only submissions made in that same browser, so a new browser or device starts with an empty summary. These are demonstration results, not live college-wide statistics.</p>
      </section>
      <section>
        <h2>Is my feedback linked to my account?</h2>
        <p>The local demonstration stores feedback separately from student sign-in details. The form does not add your name or username to a response. Keep comments general and do not include personal or confidential information.</p>
      </section>
      <section>
        <h2>I forgot my password. What can I do?</h2>
        <p>Student accounts use a username rather than an email address, so an email-based password reset is not available. Visit the <Link className="inline-link" href="/contact">contact and support page</Link> for the current support contact route. Never send anyone your password or sign-in codes.</p>
      </section>
      <p>Still stuck? See the <Link className="inline-link" href="/contact">contact information</Link> and use the channel where you received CoursePulse.</p>
    </PublicPage>
  );
}
