import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return <main className="auth-shell">
    <section className="auth-art">
      <div className="brand brand-light"><span className="brand-mark">◉</span> CoursePulse</div>
      <div className="art-copy"><span className="eyebrow">BETTER COURSES START WITH LISTENING</span><h1>Every response moves learning forward.</h1><p>One calm place to collect feedback, spot patterns, and make better teaching decisions.</p></div>
      <div className="art-footer"><span>Private by design.</span><span>Built for learning teams.</span></div>
    </section>
    <section className="auth-panel"><LoginForm /></section>
  </main>;
}
