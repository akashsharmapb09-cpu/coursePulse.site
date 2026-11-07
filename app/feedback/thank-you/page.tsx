import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, History, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Feedback submitted | CoursePulse', robots: { index: false, follow: false } };

export default async function FeedbackThankYouPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'STUDENT') redirect('/dashboard');

  return <main className="feedback-thank-you-shell"><section className="feedback-thank-you-card">
    <span className="feedback-thank-you-icon"><CheckCircle2 size={34}/></span>
    <span className="eyebrow">SUBMISSION RECEIVED</span>
    <h1>Thank you for sharing your feedback.</h1>
    <p>Your anonymous feedback has been received. Your eligibility record is kept separately from the answer content, and instructors only receive approved aggregate insights.</p>
    <div className="feedback-thank-you-privacy"><ShieldCheck size={17}/><span><b>Your response is not shown in your submission history.</b><small>History displays completion status and form details, not your answers.</small></span></div>
    <div className="feedback-thank-you-actions"><Link className="button primary" href="/dashboard"><LayoutDashboard size={16}/> Return to dashboard</Link><Link className="button subtle" href="/dashboard?tab=history"><History size={16}/> Submission history</Link></div>
  </section></main>;
}
