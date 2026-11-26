import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/public-site';
import { Activity, ArrowRight, ArrowUpRight, BarChart3, BookOpen, CheckCircle2, Gauge, MessageSquareText, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'CoursePulse | College course feedback',
  description: 'Create a student account with your name, username and programme, then share course feedback. No email address is needed. No Admin or HOD roles.',
  alternates: { canonical: '/' }
};

const dimensions = [
  { number: '01', title: 'Teaching clarity', detail: 'How clearly ideas come through', icon: BookOpen },
  { number: '02', title: 'Class pace', detail: 'How the learning rhythm feels', icon: Gauge },
  { number: '03', title: 'Learning resources', detail: 'What supports your understanding', icon: MessageSquareText },
  { number: '04', title: 'Overall experience', detail: 'Your view of the course as a whole', icon: BarChart3 }
];

export default function Home() {
  return (
    <main id="main-content" className="cp-home">
      <PublicHeader />
      <div className="cp-shell">
        <section className="cp-hero">
          <div className="cp-hero-copy">
            <span className="cp-eyebrow">Student course feedback project</span>
            <h1>Give every course a <em>clearer conversation.</em></h1>
            <p>CoursePulse gives students one simple place to create an account, share their learning experience and review course-level results.</p>
            <div className="cp-actions">
              <Link href="/signup" className="button primary">Create student account <ArrowRight size={16} /></Link>
              <Link href="/login" className="button subtle">Student sign in</Link>
              <Link href="/dashboard" className="cp-text-link">Open workspace <ArrowUpRight size={15} /></Link>
            </div>
            <div className="cp-proof">
              <span><CheckCircle2 size={15} /> Student-only accounts</span>
              <span><ShieldCheck size={15} /> Clear data boundaries</span>
            </div>
          </div>

          <aside className="cp-hero-visual" aria-label="Four dimensions of course feedback">
            <div className="cp-visual-inner">
              <div className="cp-visual-top"><span>COURSEPULSE / FEEDBACK LENS</span><Activity size={17} /></div>
              <div className="cp-visual-heading">
                <p>Make space for the whole learning experience.</p>
                <h2>What makes a course work?</h2>
              </div>
              <div className="cp-signal-list">
                {dimensions.map(({ number, title, detail, icon: Icon }) => (
                  <div className="cp-signal" key={number}>
                    <span className="cp-signal-index">{number}</span>
                    <span className="cp-signal-copy"><b>{title}</b><small>{detail}</small></span>
                    <span className="cp-signal-icon"><Icon size={16} /></span>
                  </div>
                ))}
              </div>
              <div className="cp-visual-foot"><span>Four feedback dimensions</span><span>Student perspective</span></div>
            </div>
          </aside>
        </section>

        <aside className="cp-disclosure">
          <div className="cp-disclosure-copy">
            <span className="cp-disclosure-icon"><ShieldCheck size={18} /></span>
            <span><b>A student project demonstration, with clear data boundaries.</b><small>Student accounts use Supabase. Course feedback and reminders stay in the browser you use.</small></span>
          </div>
          <Link href="/about">About this project <ArrowUpRight size={14} /></Link>
        </aside>

        <section id="how-it-works" className="cp-how">
          <div className="cp-section-intro">
            <span className="cp-section-kicker">How it works</span>
            <h2>A short path from sign-in to useful feedback.</h2>
            <p>Choose your programme, open the workspace and share what the learning experience feels like.</p>
          </div>
          <div className="cp-steps">
            <article className="cp-step"><span className="cp-step-number">01 / ACCOUNT</span><h3>Create your student account</h3><p>Use your name, a unique username, your programme and a password. No email address is needed.</p></article>
            <article className="cp-step"><span className="cp-step-number">02 / FEEDBACK</span><h3>Share your experience</h3><p>Rate teaching clarity, class pace, learning resources and your overall course experience.</p></article>
            <article className="cp-step"><span className="cp-step-number">03 / RESULTS</span><h3>Review course summaries</h3><p>See course-level summaries and export the demo responses saved in your current browser.</p></article>
          </div>
        </section>

        <section className="cp-benefits">
          <div className="cp-benefit-heading">
            <span className="cp-section-kicker">What you can do</span>
            <h2>Keep the focus on the course experience.</h2>
          </div>
          <div className="cp-benefit-list">
            <article className="cp-benefit">
              <span className="cp-benefit-icon"><BookOpen size={19} /></span>
              <div><h3>One student account</h3><p>Register with your name, username, password and programme. Public registration is for students only.</p></div>
            </article>
            <article className="cp-benefit">
              <span className="cp-benefit-icon"><MessageSquareText size={19} /></span>
              <div><h3>Feedback without extra steps</h3><p>Share your view of the course through a focused set of ratings and an optional comment.</p></div>
            </article>
            <article className="cp-benefit">
              <span className="cp-benefit-icon"><BarChart3 size={19} /></span>
              <div><h3>Results you can review</h3><p>See summaries based on responses saved in the browser you are using. They are demonstration results, not live college-wide statistics.</p></div>
            </article>
          </div>
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}
