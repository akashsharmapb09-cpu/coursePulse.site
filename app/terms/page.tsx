import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
export const metadata:Metadata={alternates:{canonical:'/terms'},title:'Terms of Use',description:'Terms for using the CoursePulse college-project demonstration.'};
export default function TermsPage(){return <PublicPage eyebrow="Terms" title="Terms of use" description="A simple guide to using the CoursePulse college-project demonstration.">
 <section><h2>1. Project purpose</h2><p>CoursePulse is a student project that demonstrates course feedback collection and basic result summaries. It is not an official college record system or a production student-management service.</p></section>
 <section><h2>2. No account or role system</h2><p>The current version does not provide login, user accounts, Admin access, or HOD roles. All visitors use the same public demonstration workspace.</p></section>
 <section><h2>3. Feedback submissions</h2><p>Submit honest and respectful feedback about the course. Do not include passwords, names, roll numbers, contact details, confidential information, or content that you are not authorised to share.</p></section>
 <section><h2>4. Demo data and results</h2><p>Feedback is saved only in the browser being used. Results reflect the locally saved demo responses and are not official college statistics. Responses are not shared or synchronised between visitors or devices.</p></section>
 <section><h2>5. Availability and changes</h2><p>The project may be updated, reset, or temporarily unavailable during development. No guarantee is made that locally stored data will remain available if browser data is cleared or the app changes.</p></section>
 <p className="public-note">Use the hosted application for demonstration and academic project evaluation only. Do not submit real confidential student records.</p>
</PublicPage>;}
