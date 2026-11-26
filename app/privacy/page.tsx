import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
export const metadata:Metadata={alternates:{canonical:'/privacy'},title:'Privacy Policy',description:'How the CoursePulse college project stores feedback locally in the browser.'};
export default function PrivacyPage(){return <PublicPage eyebrow="Privacy" title="Privacy notice" description="This notice describes the simplified CoursePulse college-project demonstration.">
 <p className="policy-updated">Last reviewed: 26 November 2026</p>
 <section><h2>1. How the demo works</h2><p>The hosted project is a public feedback demonstration. It does not ask visitors to create an account or sign in. The current version does not send feedback to a college database or associate feedback entries with a student account.</p></section>
 <section><h2>2. Information entered in feedback</h2><p>The form stores course ratings and an optional comment in the local storage of the browser being used. The project does not request a name, email address, password, or college roll number. Please do not include personal or sensitive information in comments.</p></section>
 <section><h2>3. Where responses are stored</h2><p>Responses are stored on the current device and browser only. They are not uploaded to the project owner, shared with other visitors, or synchronised between devices. Clearing browser storage or using another browser/device will result in a separate set of demo data.</p></section>
 <section><h2>4. Export and deletion</h2><p>The Results tab can export locally stored responses as a CSV file. The Clear demo data option removes the responses saved by this app in the current browser after confirmation. Users can also clear the browser's site data through their browser settings.</p></section>
 <section><h2>5. Cookies and analytics</h2><p>The site may store a browser preference related to its cookie notice. Do not treat the demo as a production service for confidential student information. Any hosting or analytics processing is subject to the hosting provider's published terms and settings.</p></section>
 <section><h2>6. Changes and contact</h2><p>This notice may be updated as the college project changes. A verified institutional privacy contact has not been supplied; use the project's established college or course contact channel for questions.</p></section>
 <p className="public-note">This is an informational notice for a student project, not a legal compliance certification or a substitute for an institution-approved privacy policy.</p>
</PublicPage>;}
