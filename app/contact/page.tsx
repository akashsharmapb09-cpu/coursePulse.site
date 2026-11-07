import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
export const metadata: Metadata = { alternates: { canonical: '/contact' }, title: 'Contact | CoursePulse', description: 'How to reach the administrator responsible for your CoursePulse workspace.' };
export default function ContactPage() { return <PublicPage eyebrow="Contact" title="Talk to your workspace administrator." description="CoursePulse is configured for institution-managed academic workspaces.">
  <section><h2>Account and enrollment help</h2><p>For sign-in access, course enrollment, feedback deadlines, or profile questions, contact the CoursePulse administrator designated by your institution.</p></section>
  <section><h2>Privacy and data requests</h2><p>Use the account deletion-request workflow in your signed-in workspace where available. For questions about institutional retention or privacy, ask your institution for its designated privacy contact.</p></section>
  <p className="public-note">No verified institutional email address, telephone number, or postal address has been provided for this deployment, so none is displayed here.</p>
</PublicPage>; }
