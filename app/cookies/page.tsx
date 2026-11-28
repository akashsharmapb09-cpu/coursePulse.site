import { createPublicPageMetadata } from '@/lib/public-page-metadata';
import { PublicPage } from '@/components/public-site';
import { CookieSettingsLink } from '@/components/cookie-consent';

export const metadata = createPublicPageMetadata({
  title: 'Cookie Policy',
  description: 'How CoursePulse uses essential sign-in session cookies, local consent preferences and optional public-page analytics.',
  path: '/cookies',
  robots: { index: false, follow: true }
});

export default function CookiesPage() {
  return <PublicPage eyebrow="Cookies and browser storage" title="Cookie Policy" description="A clear explanation of the sign-in session, browser-stored consent preference and optional analytics used by CoursePulse.">
    <p className="policy-updated">Last reviewed: 28 November 2026</p>
    <section>
      <h2>1. Essential sign-in cookies</h2>
      <p>When you sign in, Supabase SSR uses first-party session cookies so CoursePulse can recognise and maintain your Student or Teacher sign-in session across page requests. These cookies are essential to the authenticated workspace and are not used for advertising.</p>
    </section>
    <section>
      <h2>2. Browser storage for your preferences</h2>
      <p>CoursePulse stores your optional-analytics choice in this browser under <code>coursepulse:cookie-consent:v1</code>. This preference records whether optional public-page analytics were allowed or rejected and when the choice was saved. It is not a feedback-answer store. Current authenticated feedback submissions and course records are processed by the application and stored server-side in the connected Supabase database.</p>
    </section>
    <section>
      <h2>3. Optional analytics</h2>
      <p>CoursePulse is hosted on Vercel. Vercel Analytics and Speed Insights are loaded only after you opt in, and only configured public website pages are included. The authenticated workspace and authentication routes are excluded. These tools measure public-page views and performance; they are not used to calculate course feedback results.</p>
    </section>
    <section>
      <h2>4. Your choices</h2>
      <p>You can reject optional analytics, allow them, or choose your preference in the Cookie preferences dialog. After the first choice, use the Cookie settings control in the website footer to reopen your preferences and change the setting. Rejecting analytics does not disable the essential cookies needed for a Student or Teacher sign-in session.</p>
      <p><CookieSettingsLink /></p>
    </section>
    <section>
      <h2>5. Managing browser data</h2>
      <p>You can clear CoursePulse site data through your browser's privacy or site settings. Doing so removes the locally stored consent preference and may sign you out by clearing the authentication session cookies. It does not delete a Student or Teacher account, course records or server-side feedback submissions stored by Supabase.</p>
    </section>
    <section>
      <h2>6. Third-party services and updates</h2>
      <p>CoursePulse uses Vercel for hosting and optional public-page analytics, and Supabase for authentication and database services. This policy may be updated if CoursePulse adds other tools or browser-storage technologies.</p>
    </section>
    <p className="public-note">This page describes the current CoursePulse setup. Browser behaviour can vary, and this notice is not a legal compliance certification.</p>
  </PublicPage>;
}
