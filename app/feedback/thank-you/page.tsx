import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Feedback submitted | CoursePulse',
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

type PageProps = { searchParams: Promise<{ feedback?: string }> };

export default async function FeedbackThankYouPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const feedbackId = params.feedback ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(feedbackId)) {
    redirect('/dashboard');
  }

  // RLS allows a student to see a closed form only after their eligibility was consumed.
  const { data: form, error: formError } = await supabase
    .from('feedback')
    .select('id,title,course_id,courses(title)')
    .eq('id', feedbackId)
    .single();
  if (formError || !form) redirect('/dashboard');

  const { data: statuses, error: statusError } = await supabase.rpc('get_student_feedback_status');
  const submitted = !statusError && (statuses ?? []).some(
    (item: { feedback_id: string; submitted: boolean }) => item.feedback_id === feedbackId && item.submitted
  );
  if (!submitted) redirect('/dashboard');

  const courseRelation = form.courses as { title?: string } | Array<{ title?: string }> | null;
  const courseTitle = Array.isArray(courseRelation) ? courseRelation[0]?.title : courseRelation?.title;

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={30} aria-hidden="true" />
        </div>
        <p className="eyebrow">COURSEPULSE · STUDENT FEEDBACK</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0f172a]">Thank you. Your feedback is submitted.</h1>
        <p className="mt-3 text-[#64748b]">Your response has been saved. You can return to your dashboard and continue with any remaining course feedback.</p>
        <dl className="my-8 grid gap-4 rounded-2xl bg-[#f8fafc] p-5 sm:grid-cols-2">
          <div><dt className="text-sm text-[#64748b]">Course</dt><dd className="mt-1 font-semibold text-[#0f172a]">{courseTitle ?? 'Course'}</dd></div>
          <div><dt className="text-sm text-[#64748b]">Feedback form</dt><dd className="mt-1 font-semibold text-[#0f172a]">{form.title}</dd></div>
          <div><dt className="text-sm text-[#64748b]">Submission status</dt><dd className="mt-1 font-semibold text-emerald-700">Submitted</dd></div>
          <div className="flex items-center gap-2 text-sm text-[#475569]"><ShieldCheck size={17} aria-hidden="true"/> Your answers remain separate from eligibility.</div>
        </dl>
        <Link href="/dashboard" className="button primary inline-flex items-center gap-2">Return to Dashboard <ArrowRight size={16}/></Link>
      </section>
    </main>
  );
}
