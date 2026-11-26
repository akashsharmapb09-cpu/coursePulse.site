import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy Policy',
  description: 'How CoursePulse handles username-based student accounts, anonymous feedback, browser storage, and optional analytics.'
};

export default function PrivacyPage() {
  return <PublicPage eyebrow="Privacy" title="Privacy Policy" description="This policy explains what information is used when students create a CoursePulse account and submit course feedback.">
    <p className="policy-updated">Last reviewed: 26 November 2026</p>
    <section>
      <h2>1. About CoursePulse</h2>
      <p>CoursePulse provides a course-feedback workspace with student-only accounts. There are no self-service Admin or HOD roles. It is not an official college record system. Do not use it for confidential institutional records.</p>
    </section>
    <section>
      <h2>2. Student account information</h2>
      <p>When you register, CoursePulse collects your full name, username, selected programme (for example B.Tech, M.Tech, BBA or B.Com), and the password needed to authenticate your account. No email address or phone number is requested, and no verification or password-recovery email is sent. Supabase Authentication handles the password; CoursePulse does not receive or store it in readable form. A reserved, non-deliverable internal identifier is used behind the scenes for authentication and is not shown as your email address or used to send messages.</p>
      <p>New public registrations are assigned the Student role by the database. The sign-up form does not accept a role, organization, or administrative access request.</p>
    </section>
    <section>
      <h2>3. Feedback information</h2>
      <p>The current feedback workspace records the selected example course, ratings, an optional comment, and the submission date in the browser being used. It does not add your account name or username to those responses. Please do not include identifying or sensitive details in free-text comments.</p>
    </section>
    <section>
      <h2>4. Where information is stored</h2>
      <p>Student account credentials and profile records are handled by Supabase. Feedback is stored separately in browser local storage under <code>coursepulse-college-demo-responses-v1</code>. Feedback submitted in this demo is not sent to the shared college database and is not synchronised between visitors, browsers, or devices.</p>
      <p>The cookie preference is stored in this browser under <code>coursepulse:cookie-consent:v1</code>. Clearing browser site data removes local feedback and the consent preference; it does not automatically delete a registered Supabase account.</p>
    </section>
    <section>
      <h2>5. Essential session cookies</h2>
      <p>When you sign in, Supabase SSR uses first-party session cookies so CoursePulse can keep your student session across pages. These cookies are essential for account sign-in and are not used for advertising. See the <a className="inline-link" href="/cookies">Cookie Policy</a> for details.</p>
    </section>
    <section>
      <h2>6. Optional analytics and performance data</h2>
      <p>Optional Vercel Analytics and Speed Insights are loaded only after you choose to allow optional analytics. When enabled, page-view and performance events are sent to Vercel for configured public website pages. The student workspace and authentication pages are excluded from the configured analytics routes.</p>
      <p>CoursePulse does not intentionally include account profile fields, feedback comments, or rating answers in those analytics events. You can reject optional analytics or change your choice later using Cookie settings.</p>
    </section>
    <section>
      <h2>7. Export, deletion and account security</h2>
      <p>The Results page can export the demo responses saved in this browser as a CSV file. The Clear demo data option removes local feedback after confirmation. To request help with a student account or its deletion, use the channel through which you received the CoursePulse link. There is no email-based password recovery in this version; keep your username and password safe and use the same channel if you lose access.</p>
    </section>
    <section>
      <h2>8. Hosting and third-party services</h2>
      <p>The website is hosted on Netlify. Supabase provides authentication and student-profile storage. Optional Vercel Analytics and Speed Insights process public-page measurement events only after opt-in. These providers process data under their own service terms and privacy information.</p>
    </section>
    <section>
      <h2>9. Changes and contact</h2>
      <p>This notice may be updated as CoursePulse changes. No institutional privacy contact has been supplied. For questions about CoursePulse, use the college or course contact channel through which you received the link.</p>
    </section>
    <p className="public-note">This is an informational privacy notice, not a legal compliance certification or an institution-approved privacy policy.</p>
  </PublicPage>;
}
