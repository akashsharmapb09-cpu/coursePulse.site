import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy Policy',
  description: 'How CoursePulse handles Student and Teacher accounts, separately stored feedback answers, aggregate reports and browser preferences.'
};

export default function PrivacyPage() {
  return <PublicPage eyebrow="Privacy" title="Privacy Policy" description="This notice explains the information used by CoursePulse when people create accounts, manage courses and submit feedback.">
    <p className="policy-updated">Last reviewed: 28 November 2026</p>
    <section>
      <h2>1. About CoursePulse</h2>
      <p>CoursePulse provides a single-college course-feedback workspace for Students and Teachers. Students can register themselves, while Teacher access is provisioned by invitation. It is a demonstration workspace, not an institution-approved student-record system. Do not use it to submit confidential institutional records.</p>
    </section>
    <section>
      <h2>2. Account and academic information</h2>
      <p>Student registration uses your full name, username, selected programme and password. No email address or phone number is requested for Student self-registration, and no verification or password-recovery email is sent for those username-based Student accounts. Supabase Authentication manages the password; CoursePulse does not receive or store it in readable form. A reserved, non-deliverable internal identifier supports username authentication and is not shown as your email address or used to send messages.</p>
      <p>Teacher accounts are created through an invitation/provisioning process and may use a registered college email or a provided demo username. The profile and academic workspace may also store course enrolments, course assignments, department and semester information, and account status so the application can apply role and course permissions.</p>
    </section>
    <section>
      <h2>3. Feedback information and anonymity design</h2>
      <p>When a Student submits an eligible form, the application validates the answers and sends them to the connected Supabase database. The current submission path stores the feedback form reference, answer payload and date-level receipt in a separate anonymous-answer table. That answer record does not contain the Student's user ID, username or email. A separate private eligibility record is used to determine which form the Student may submit and to prevent duplicate submissions.</p>
      <p>This separation is a privacy design, not a guarantee of absolute or cryptographic anonymity. Course, form, question and submission timing can still create context, and free-text comments may identify you if you include personal details. Do not put names, roll numbers, phone numbers, email addresses or other identifying information in comments.</p>
    </section>
    <section>
      <h2>4. Analytics and exports</h2>
      <p>Teacher reports use database aggregate functions rather than exposing raw answer rows. The current reporting service suppresses question groups and rating bins with fewer than five responses and excludes free-text answers from ordinary analytics and exports. Available filters include course, semester, department, date range and question category. Small-group suppression reduces disclosure risk but does not by itself eliminate re-identification or repeated-query risks.</p>
    </section>
    <section>
      <h2>5. Storage, retention and deletion requests</h2>
      <p>Student identity, account profile, course catalogue, enrolment and feedback-form records are stored in the connected Supabase services. New feedback answers are stored separately as described above. Feedback-form retention is configurable within the supported 30-to-730-day range, and a scheduled cleanup process removes expired answer records and rate-limit data.</p>
      <p>You can submit an account/data-deletion request from the workspace. Requests are reviewed through the application's administrative process; submitting a request does not automatically delete a Supabase Authentication account. Browser site data clearing may remove your local cookie preference or sign-in session, but it does not delete your server-side account or feedback submissions.</p>
    </section>
    <section>
      <h2>6. Essential cookies and optional analytics</h2>
      <p>Supabase SSR uses first-party session cookies to maintain your sign-in session. CoursePulse stores your optional-analytics choice in this browser. Optional Vercel Analytics and Speed Insights are loaded only after you opt in and are limited to configured public pages; the authenticated workspace and authentication routes are excluded. These analytics are for public-page usage and performance measurement, not feedback answer reporting.</p>
      <p>You can reject optional analytics or change your choice later using Cookie settings. See the <a className="inline-link" href="/cookies">Cookie Policy</a> for details.</p>
    </section>
    <section>
      <h2>7. Passwords and account assistance</h2>
      <p>There is no email-based password recovery for username-based Student accounts. A signed-in user can change their password through the account security controls; users who have lost access should use the support channel shared by their college or the CoursePulse contact route. Never share your password or sign-in codes with anyone.</p>
    </section>
    <section>
      <h2>8. Hosting and third-party services</h2>
      <p>The website is hosted on Vercel. Supabase provides authentication, database and storage services used by the workspace. Optional Vercel Analytics and Speed Insights process configured public-page measurement events only after opt-in. These providers process information under their own service terms and privacy notices.</p>
    </section>
    <section>
      <h2>9. Changes and contact</h2>
      <p>This notice may be updated as CoursePulse changes. For account or privacy questions, contact the Teacher or department office that provided your access, or use the <a className="inline-link" href="/contact">CoursePulse contact page</a>. Do not include credentials or private feedback contents in a support request.</p>
    </section>
    <p className="public-note">This is an informational privacy notice, not a legal compliance certification or an institution-approved privacy policy. Ask the institution operating the workspace for its approved data-protection terms.</p>
  </PublicPage>;
}
