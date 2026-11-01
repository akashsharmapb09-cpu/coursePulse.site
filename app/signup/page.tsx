import type { Metadata } from 'next';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Create your student account',
  description: 'Create a CoursePulse student account.',
  robots: { index: false, follow: false }
};

export default function SignupPage() {
  return <main className="auth-shell">
    <section className="auth-art">
      <div className="brand brand-light"><span className="brand-mark">◉</span> CoursePulse</div>
      <div className="art-copy"><span className="eyebrow">START WITH YOUR STUDENT ACCOUNT</span><h1>Make your course feedback count.</h1><p>Create your account to view courses you are enrolled in and share eligible feedback.</p></div>
      <div className="art-footer"><span>Student access by default.</span><span>Role changes require an administrator.</span></div>
    </section>
    <section className="auth-panel"><LoginForm initialMode="signup" /></section>
  </main>;
}
