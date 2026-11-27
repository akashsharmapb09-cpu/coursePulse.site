import Link from 'next/link';
import { PublicPage } from '@/components/public-site';
import { Github, Mail, MessageSquare, HelpCircle } from 'lucide-react';

export const metadata = {
  title: 'Contact and support',
  description: 'How to contact CoursePulse for account help, report issues, and find assistance.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/contact' }
};

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="Contact & Support"
      title="Get in touch with CoursePulse."
      description="Need assistance with your account, have feedback, or want to report a technical issue? Here is how to reach out."
    >
      <section>
        <h2>Source Repository & Issue Tracker</h2>
        <p>CoursePulse is an open academic course feedback portal. You can follow CoursePulse updates, report technical issues, or suggest improvements directly on GitHub:</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="https://github.com/akashsharmapb09-cpu/coursePulse.site/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="button primary inline-flex items-center gap-2"
          >
            <Github size={16} /> Open GitHub Issue
          </a>
          <a
            href="https://github.com/akashsharmapb09-cpu/coursePulse.site"
            target="_blank"
            rel="noopener noreferrer"
            className="button subtle inline-flex items-center gap-2"
          >
            <Github size={16} /> View Source Repository
          </a>
        </div>
      </section>

      <section>
        <h2>Student & Teacher Account Support</h2>
        <p>Students sign in with their academic username, and Teachers sign in using their registered college email credentials. If you experience difficulty signing in, need a password reset, or request account updates:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#506257]">
          <li>Reach out to your assigned Teacher or department office.</li>
          <li>For technical support, submit an inquiry via the <a className="inline-link" href="https://github.com/akashsharmapb09-cpu/coursePulse.site/issues" target="_blank" rel="noopener noreferrer">Issue Tracker</a> with non-sensitive reproduction steps.</li>
          <li>Never share your password, secret codes, or sensitive feedback submissions when submitting an inquiry.</li>
        </ul>
      </section>

      <section>
        <h2>Quick Help & Common Questions</h2>
        <p>Looking for answers to common questions regarding anonymous feedback, question management, or CSV data exports?</p>
        <p className="mt-3">
          <Link className="inline-link inline-flex items-center gap-1 font-semibold" href="/support">
            <HelpCircle size={15} /> Visit the Support & FAQ Center
          </Link>
          {' '}or return to the{' '}
          <Link className="inline-link" href="/">
            CoursePulse Homepage
          </Link>.
        </p>
      </section>
    </PublicPage>
  );
}
