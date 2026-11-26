import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy Policy',
  description: 'How CoursePulse handles feedback, browser storage, and optional analytics in this college-project demo.'
};

export default function PrivacyPage() {
  return <PublicPage eyebrow="Privacy" title="Privacy Policy" description="This policy explains what the CoursePulse college-project demonstration stores and what happens when optional analytics are enabled.">
    <p className="policy-updated">Last reviewed: 26 November 2026</p>
    <section>
      <h2>1. About this project</h2>
      <p>CoursePulse is a public college-project demonstration. This version does not provide user accounts, sign-in, Admin roles, or HOD roles. It is not an official college record system and should not be used to submit confidential student information.</p>
    </section>
    <section>
      <h2>2. Feedback information</h2>
      <p>The feedback form records the selected example course, ratings, an optional comment, and the submission date in the browser being used. It does not ask for a student name, email address, password, or roll number. Please do not include identifying or sensitive details in comments.</p>
    </section>
    <section>
      <h2>3. Where feedback is stored</h2>
      <p>Feedback is stored in browser local storage on the current device and browser under the key <code>coursepulse-college-demo-responses-v1</code>. The feedback form does not send these responses to a shared college database. Responses are not synchronised between visitors, browsers, or devices.</p>
      <p>Using another browser or device creates a separate set of demo data. Clearing this site's browser storage removes the locally saved responses.</p>
    </section>
    <section>
      <h2>4. Optional analytics and performance data</h2>
      <p>Optional Vercel Analytics and Speed Insights are loaded only after you choose to allow optional analytics. When enabled, page-view and performance events are sent to Vercel for the public website pages. The signed-in workspace and legacy authentication or administration paths are excluded from the configured analytics routes.</p>
      <p>The project does not intentionally include feedback comments or rating answers in those analytics events. You can reject optional analytics or change your choice later using Cookie settings.</p>
    </section>
    <section>
      <h2>5. Browser storage and cookies</h2>
      <p>The demo uses browser local storage for feedback and for your cookie preference. The consent preference is saved under <code>coursepulse:cookie-consent:v1</code>. See the <a className="inline-link" href="/cookies">Cookie Policy</a> for the storage details and how to manage your choice.</p>
    </section>
    <section>
      <h2>6. Export and deletion</h2>
      <p>The Results page can export the responses saved in this browser as a CSV file. The Clear demo data option removes the locally saved feedback after confirmation. To remove both feedback and consent preferences, clear CoursePulse site data in your browser settings. You can also update or reject optional analytics through Cookie settings.</p>
    </section>
    <section>
      <h2>7. Hosting and third-party services</h2>
      <p>The website is hosted on Vercel. When optional analytics are enabled, Vercel Analytics and Speed Insights process the configured public-page measurement events. Their processing is also subject to the provider's own privacy information and service terms.</p>
    </section>
    <section>
      <h2>8. Changes and contact</h2>
      <p>This notice may be updated as the academic project changes. No institutional privacy contact has been supplied for this demonstration. For project questions, use the college or course contact channel provided by the project team.</p>
    </section>
    <p className="public-note">This is an informational notice for a student project. It is not a legal compliance certification or an institution-approved privacy policy.</p>
  </PublicPage>;
}
