import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Feedback received', robots: { index: false, follow: false } };

export default function FeedbackThankYouPage() {
  return (
    <main className="cp-state-shell">
      <section className="cp-state-card">
        <span className="cp-state-icon"><CheckCircle2 size={28} /></span>
        <p className="eyebrow">COURSEPULSE / FEEDBACK</p>
        <h1>Thank you for your feedback.</h1>
        <p>Your response has been saved in this browser’s CoursePulse project data.</p>
        <Link href="/dashboard">Return to workspace</Link>
      </section>
    </main>
  );
}
