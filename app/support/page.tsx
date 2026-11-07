import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicPage } from '@/components/public-site';
export const metadata: Metadata = { alternates: { canonical: '/support' }, title: 'Support | CoursePulse', description: 'Help with CoursePulse accounts, feedback forms, and aggregate analytics.' };
export default function SupportPage() { return <PublicPage eyebrow="Support" title="Find the right help." description="A few common questions about the CoursePulse workflow.">
  <section><h2>I cannot see a course</h2><p>Students see courses and feedback forms made available to their account through enrollment and publication settings. Ask your institution's administrator to verify your enrollment.</p></section>
  <section><h2>Why is a report empty?</h2><p>Analytics suppress groups with fewer than five submissions. Filters can also narrow a report to no eligible data.</p></section>
  <section><h2>Why can an administrator not open management tools?</h2><p>Privileged administrator operations require a verified administrator role and an MFA-authenticated session. Ask your administrator to complete the configured authenticator challenge.</p></section>
  <section><h2>How do I request account deletion?</h2><p>Sign in, open Account, and use the deletion-request workflow. The request may remain pending while an administrator reviews it.</p></section>
  <p>For help from your institution, visit the <Link className="inline-link" href="/contact">contact page</Link>.</p>
</PublicPage>; }
