import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Activity } from 'lucide-react';
import { StudentAuthForm } from '@/components/student-auth-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Create student account',
  description: 'Register for CoursePulse using your name, username and college programme. No email address is needed.',
  robots: { index: false, follow: false }
};

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return <main className="auth-shell">
    <section className="auth-art">
      <a className="brand brand-light" href="/"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</a>
      <div className="art-copy"><span className="eyebrow">YOUR STUDENT ACCOUNT</span><h1>Your course. Your voice.</h1><p>Choose your programme, create a student account, and return to CoursePulse whenever you need it.</p></div>
      <div className="art-footer"><span>Student registration only.</span><span>No Admin or HOD accounts.</span></div>
    </section>
    <section className="auth-panel"><StudentAuthForm mode="signup"/></section>
  </main>;
}
