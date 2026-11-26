import Link from 'next/link';
import { PublicPage } from '@/components/public-site';

export const metadata = {
  title: 'Refund information',
  description: 'Payment and refund availability for CoursePulse.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/refunds' }
};

export default function RefundsPage() {
  return (
    <PublicPage
      eyebrow="Payments"
      title="Refund information"
      description="Payment information for this CoursePulse deployment."
    >
      <section>
        <h2>No paid services are currently offered</h2>
        <p>This college-project version of CoursePulse does not sell subscriptions, accept payments or offer paid services. No refundable transaction can currently be made through this application.</p>
        <p>If paid services are introduced in a future version, an institution-approved refund policy and verified support details must be published before payments are enabled.</p>
      </section>
      <p className="public-note">This page describes the current project configuration. It is not an institutional payment or refund approval.</p>
      <p><Link className="inline-link" href="/terms">Read the terms of use</Link>.</p>
    </PublicPage>
  );
}
