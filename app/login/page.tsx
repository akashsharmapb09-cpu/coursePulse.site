import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Activity } from 'lucide-react';
import { StudentAuthForm } from '@/components/student-auth-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Student & Teacher sign in',
  description: 'Students sign in with a username. Teachers can use a demo username or college email and password.',
  robots: { index: false, follow: false }
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return <main className="auth-shell">
    <section className="auth-art">
      <a className="brand brand-light" href="/"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</a>
      <div className="art-copy"><span className="eyebrow">WELCOME BACK</span><h1>Keep your learning conversation going.</h1><p>Students sign in with their username and password. Teachers can use a demo username or college email and password.</p></div>
      <div className="art-footer"><span>Private student access.</span><span>Student & Teacher access.</span></div>
    </section>
    <section className="auth-panel"><StudentAuthForm mode="signin"/></section>
  </main>;
}
