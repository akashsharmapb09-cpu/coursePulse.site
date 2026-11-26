import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata = {
  title: 'Contact and support',
  description: 'How to request help with the CoursePulse college-project demonstration.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/contact' }
};

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="Contact and support"
      title="Get help with CoursePulse."
      description="CoursePulse is an academic project. Use the original project channel for questions or account assistance."
    >
      <section>
        <h2>Project contact</h2>
        <p>A verified public email address, support inbox, telephone number, or postal address has not been provided for this project, so this page does not invent contact details. To ask for help, contact the project owner through the same channel where you received the CoursePulse link or project instructions.</p>
      </section>
      <section>
        <h2>Account recovery</h2>
        <p>Student accounts use usernames and passwords; an email address is not collected for self-service reset links. The project owner can advise on available account support. Never share your password, sign-in codes, or private feedback when asking for help.</p>
      </section>
      <section>
        <h2>What to include in a support request</h2>
        <p>Describe the page you were using and what happened. A screenshot of the visible error can help, but remove names and other personal details first.</p>
      </section>
      <p><Link className="inline-link" href="/support">Read the support questions</Link> or return to the <Link className="inline-link" href="/">CoursePulse homepage</Link>.</p>
    </PublicPage>
  );
}
