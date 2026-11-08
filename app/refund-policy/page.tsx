import type { Metadata } from 'next';
import { PublicPage } from '@/components/public-site';
export const metadata: Metadata = { alternates: { canonical: '/refund-policy' }, title: 'Refund Policy', description: 'CoursePulse payment and refund information.' };
export default function RefundPolicyPage() { return <PublicPage eyebrow="Payments" title="Refund policy" description="Payment information for this CoursePulse deployment.">
  <section><h2>No paid services are currently offered</h2><p>The audited application does not currently provide paid subscriptions, payment checkout, or paid add-ons. There are therefore no CoursePulse transactions or refundable purchases offered through this deployment at this time.</p></section>
  <p className="public-note">If the institution introduces paid services later, it must publish an accurate refund and cancellation policy before accepting payment.</p>
</PublicPage>; }
