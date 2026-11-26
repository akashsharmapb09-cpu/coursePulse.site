import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Activity } from 'lucide-react';
import { StudentAuthForm } from '@/components/student-auth-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Student sign in',
  description: 'Sign in to your CoursePulse student account using a username and password.',
  robots: { index: false, follow: false }
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return <main className="auth-shell">
    <section className="auth-art">
      <a className="brand brand-light" href="/"><span className="brand-mark"><Activity size={19}/></span> CoursePulse</a>
      <div className="art-copy"><span className="eyebrow">WELCOME BACK</span><h1>Keep your learning conversation going.</h1><p>Sign in with the username and password you used to create your student account. No email address is needed.</p></div>
      <div className="art-footer"><span>Private student access.</span><span>Student accounts only.</span></div>
    </section>
    <section className="auth-panel"><StudentAuthForm mode="signin"/></section>
  </main>;
}
