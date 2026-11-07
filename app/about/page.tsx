import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
export const metadata: Metadata = { alternates: { canonical: '/about' }, title: 'About | CoursePulse', description: 'Learn about the purpose and approach behind CoursePulse.' };
export default function AboutPage() { return <PublicPage eyebrow="About CoursePulse" title="Better courses start with listening." description="A focused workspace for turning structured student feedback into practical academic insight.">
  <section><h2>Why CoursePulse exists</h2><p>Educational teams need a consistent way to collect feedback across courses and review it without exposing individual student answers. CoursePulse is designed to bring those activities together in a single role-aware workspace.</p></section>
  <section><h2>How it works</h2><p>Course forms define the questions. Eligible students submit feedback while signed in. Eligibility and anonymous answer storage are handled separately by the database. Instructors see aggregate reporting, and small groups are suppressed to reduce the risk of identifying contributors.</p></section>
  <section><h2>What we do not claim</h2><p>CoursePulse does not claim that anonymity is cryptographically guaranteed, that every institution is legally compliant by default, or that analytics contain real-time institutional statistics on this public page. Institutions remain responsible for configuration, governance, notices, and applicable legal review.</p></section>
</PublicPage>; }
