import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
export const metadata:Metadata={alternates:{canonical:'/terms'},title:'Terms of Use',description:'Terms for using CoursePulse.'};
export default function TermsPage(){return <PublicPage eyebrow="Terms" title="Terms of use" description="A simple guide to using CoursePulse.">
 <section><h2>1. Purpose and limits</h2><p>CoursePulse provides student registration, course feedback collection and basic result summaries. It is not an official college record system or a production student-management service.</p></section>
 <section><h2>2. Student accounts</h2><p>Students may create an account with their name, username, password and programme. No email address or verification message is needed. New public registrations are assigned Student access. There are no public Admin or HOD account options. Keep your username and password private.</p></section>
 <section><h2>3. Feedback submissions</h2><p>Submit honest and respectful feedback about the course. The current demo stores feedback in the browser being used and does not attach your account name or email to the local response. Do not include passwords, names, roll numbers, contact details, confidential information, or content that you are not authorised to share.</p></section>
 <section><h2>4. Demo data and results</h2><p>Student account data is stored separately by the connected authentication service. Feedback and results are saved only in the browser being used. Results reflect local demo responses and are not official college statistics. Responses are not shared or synchronised between visitors or devices.</p></section>
 <section><h2>5. Availability and changes</h2><p>CoursePulse may be updated, reset, or temporarily unavailable. No guarantee is made that locally stored feedback will remain available if browser data is cleared or the app changes.</p></section>
 <p className="public-note">The hosted workspace uses sample course information and browser-local feedback. Do not submit real confidential student records.</p>
</PublicPage>; }
