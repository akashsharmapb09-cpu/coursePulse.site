import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Activity } from 'lucide-react';
import { StudentAuthForm } from '@/components/student-auth-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Create Student or Teacher account',
  description: 'Students register with a username and Teachers register with their college email.',
  robots: { index: false, follow: false }
};

export default async function SignupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return <main className="auth-shell">
    <section className="auth-art auth-art-signup">
      <a className="brand brand-light" href="/"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</a>
      <div className="art-copy"><span className="eyebrow">STUDENT & TEACHER ACCOUNTS</span><h1>Your course. Your voice.</h1><p>Students create an account with a username. Teachers create an account with their college email.</p></div>
      <div className="art-footer"><span>Student access.</span><span>Teacher access.</span></div>
    </section>
    <section className="auth-panel auth-panel-signup"><StudentAuthForm mode="signup"/></section>
  </main>;
}
