import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
import { CookieSettingsLink } from '@/components/cookie-consent';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/cookies' },
  title: 'Cookie Policy',
  description: 'How CoursePulse uses essential student sign-in cookies, browser storage, and optional analytics.'
};

export default function CookiesPage() {
  return <PublicPage eyebrow="Cookies and browser storage" title="Cookie Policy" description="A clear explanation of the essential session cookies, local browser storage, and optional analytics used by CoursePulse.">
    <p className="policy-updated">Last reviewed: 26 November 2026</p>
    <section>
      <h2>1. Essential sign-in cookies</h2>
      <p>When a student signs in, Supabase SSR stores authentication session information in first-party cookies so the session can be maintained and refreshed between page requests. These cookies are essential to the sign-in service and are not used for advertising.</p>
    </section>
    <section>
      <h2>2. Essential browser storage</h2>
      <p>CoursePulse uses <code>coursepulse-college-demo-responses-v1</code> to remember demo feedback in the current browser. It uses <code>coursepulse:cookie-consent:v1</code> to remember whether optional analytics have been allowed or rejected. These values stay in the browser being used and are not synchronised across devices.</p>
    </section>
    <section>
      <h2>3. Optional analytics</h2>
      <p>CoursePulse is hosted on Netlify. Separately, this build integrates Vercel Analytics and Vercel Speed Insights for optional page-view and performance measurements. Those tools are not loaded until you opt in, and only configured public pages are included; the student workspace and authentication routes are excluded.</p>
    </section>
    <section>
      <h2>4. Your choices</h2>
      <p>You can reject optional analytics, allow them, or choose your preference in the Cookie preferences dialog. After the first choice, use the Cookie settings control in the website footer to reopen your preferences and change the setting. Rejecting analytics does not disable the essential cookies needed for a student sign-in session.</p>
      <p><CookieSettingsLink /></p>
    </section>
    <section>
      <h2>5. Managing browser data</h2>
      <p>You can clear CoursePulse site data through your browser's privacy or site settings. Doing so removes locally saved feedback and resets your consent choice. It may also sign you out by clearing the authentication session cookies. Clearing browser data does not delete the student account stored by Supabase.</p>
      <p>The Clear demo data option in the Results page removes feedback without changing your cookie preference.</p>
    </section>
    <section>
      <h2>6. Third-party services and updates</h2>
      <p>CoursePulse is hosted on Netlify and uses Supabase for student authentication. Optional analytics and performance measurements are provided by Vercel services and are enabled only after consent. Hosting and analytics are separate services. This policy may be updated if CoursePulse adds other tools or storage technologies.</p>
    </section>
    <p className="public-note">This page describes the current CoursePulse setup. Browser behaviour can vary, and this notice is not a legal compliance certification.</p>
  </PublicPage>;
}
