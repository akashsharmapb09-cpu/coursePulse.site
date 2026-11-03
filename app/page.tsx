import Link from 'next/link';
import { ArrowDownRight, ArrowRight, Activity, BarChart3, BookOpenCheck, Check, ClipboardList, FileText, History, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CoursePulseShader } from '@/components/coursepulse-shader';
import { LandingNav } from '@/components/landing-nav';

const capabilities = [
  {
    icon: ClipboardList,
    title: 'Structured feedback',
    text: 'Build course feedback forms and collect responses from students who are eligible for each form.',
    tone: 'mint'
  },
  {
    icon: BookOpenCheck,
    title: 'Course workspace',
    text: 'Keep courses and feedback forms organised in one role-aware academic workspace.',
    tone: 'sage'
  },
  {
    icon: BarChart3,
    title: 'Aggregate analytics',
    text: 'Review course-level patterns, rating distributions and response trends without exposing individual answers.',
    tone: 'sand'
  },
  {
    icon: Users,
    title: 'Role-aware controls',
    text: 'Separate student, instructor and administrator experiences with access enforced by the application and database policies.',
    tone: 'mint'
  },
  {
    icon: History,
    title: 'Submission history',
    text: 'Give students a clear view of their feedback progress and completed submissions.',
    tone: 'sage'
  },
  {
    icon: ShieldCheck,
    title: 'Privacy-conscious design',
    text: 'Keep feedback answers separate from eligibility records and apply small-group suppression in reports.',
    tone: 'sand'
  }
];

const workflow = [
  {
    number: '01',
    title: 'Organise courses',
    text: 'Set up the course workspace and make the right feedback forms available to eligible students.',
    icon: BookOpenCheck
  },
  {
    number: '02',
    title: 'Collect student voice',
    text: 'Students respond through structured forms designed around the course experience.',
    icon: ClipboardList
  },
  {
    number: '03',
    title: 'Understand patterns',
    text: 'Review aggregate responses, course-level trends and rating distributions.',
    icon: BarChart3
  },
  {
    number: '04',
    title: 'Improve with context',
    text: 'Use the feedback as an input to thoughtful academic conversations and course improvements.',
    icon: ArrowDownRight
  }
];

const sampleBars = [38, 56, 45, 69, 57, 82, 64, 91, 73, 86, 62, 78];

export const metadata = {
  title: 'Course feedback, made useful',
  description: 'Collect course feedback, understand student experiences and review course-level patterns in one role-aware workspace.',
  alternates: { canonical: '/' }
};

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return (
      <main className="cp-signed-in">
        <div className="cp-signed-in-card">
          <span className="cp-brand-mark"><Activity size={19} /></span>
          <p className="cp-eyebrow">WELCOME BACK</p>
          <h1>Your CoursePulse workspace is ready.</h1>
          <p>Continue to your courses, feedback and role-based workspace.</p>
          <Link className="cp-button cp-button-dark" href="/dashboard">Open your workspace <ArrowRight size={16} /></Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cp-site">
      <LandingNav />

      <section className="cp-hero">
        <div className="cp-hero-grid">
          <div className="cp-hero-copy">
            <span className="cp-eyebrow"><span className="cp-eyebrow-mark" /> COURSE FEEDBACK, MADE USEFUL</span>
            <h1>Turn student feedback into <em>meaningful progress.</em></h1>
            <p className="cp-hero-description">
              Collect course feedback, understand student experiences and use those insights to shape better learning experiences.
            </p>
            <div className="cp-hero-actions">
              <Link href="/signup" className="cp-button cp-button-dark">Get started <ArrowRight size={17} /></Link>
              <a href="#features" className="cp-button cp-button-quiet">Explore features <ArrowDownRight size={17} /></a>
            </div>
            <div className="cp-hero-assurance">
              <span><ShieldCheck size={16} /> Role-aware access</span>
              <span><LockKeyhole size={16} /> Privacy-conscious feedback</span>
            </div>
          </div>

          <div className="cp-hero-stage" aria-label="Illustrative CoursePulse product preview">
            <div className="cp-stage-shader"><CoursePulseShader /></div>
            <div className="cp-stage-grid" aria-hidden="true" />
            <div className="cp-stage-orbit cp-stage-orbit-one" aria-hidden="true" />
            <div className="cp-stage-orbit cp-stage-orbit-two" aria-hidden="true" />
            <div className="cp-product-window">
              <div className="cp-window-topbar">
                <div className="cp-window-brand"><span><Activity size={13} /></span> CoursePulse</div>
                <div className="cp-window-status"><i /> Workspace preview</div>
              </div>
              <div className="cp-window-body">
                <aside className="cp-window-sidebar" aria-hidden="true">
                  <span className="is-active"><Activity size={13} /> Overview</span>
                  <span><BookOpenCheck size={13} /> Courses</span>
                  <span><ClipboardList size={13} /> Feedback</span>
                  <span><BarChart3 size={13} /> Analytics</span>
                </aside>
                <div className="cp-window-main">
                  <div className="cp-window-heading">
                    <div><small>LEARNING WORKSPACE</small><strong>Course overview</strong></div>
                    <span className="cp-window-avatar">CP</span>
                  </div>
                  <div className="cp-window-metrics">
                    <div><small>Course workspace</small><b>Organised</b><span><BookOpenCheck size={14} /></span></div>
                    <div><small>Feedback insights</small><b>Aggregate</b><span><BarChart3 size={14} /></span></div>
                  </div>
                  <div className="cp-window-chart">
                    <div className="cp-window-chart-head"><b>Response activity</b><small>Sample visual</small></div>
                    <div className="cp-window-bars" aria-hidden="true">
                      {sampleBars.map((height, index) => <i key={index} style={{ height: height + '%' }} />)}
                    </div>
                    <div className="cp-window-axis"><span>Earlier</span><span>Recent</span></div>
                  </div>
                  <div className="cp-window-list">
                    <span><i className="cp-list-icon"><FileText size={12} /></i><b>Course feedback</b><small>Structured forms</small><Check size={14} /></span>
                    <span><i className="cp-list-icon"><ShieldCheck size={12} /></i><b>Protected insights</b><small>Role-aware access</small><Check size={14} /></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="cp-stage-caption"><span /> Illustrative interface preview, not live institution data</div>
          </div>
        </div>
        <div className="cp-hero-rule"><span>For students</span><i /><span>For instructors</span><i /><span>For academic teams</span></div>
      </section>

      <section className="cp-intro-section" id="product">
        <div className="cp-section-shell">
          <div className="cp-section-heading cp-heading-narrow">
            <p className="cp-eyebrow">A CLEARER FEEDBACK LOOP</p>
            <h2>Listen carefully.<br /><em>Understand more.</em></h2>
            <p>CoursePulse brings course feedback, academic context and useful reporting into one considered workspace.</p>
          </div>

          <div className="cp-showcase-grid">
            <article className="cp-showcase-card cp-showcase-form">
              <div className="cp-showcase-copy">
                <span className="cp-showcase-index">01 / COLLECT</span>
                <h3>Make it easier to be heard.</h3>
                <p>Structured feedback forms help students share course experiences in a clear, consistent way.</p>
                <Link href="/signup" className="cp-text-link">Explore CoursePulse <ArrowRight size={15} /></Link>
              </div>
              <div className="cp-form-preview" aria-label="Illustrative student feedback form">
                <div className="cp-preview-top"><span>FEEDBACK FORM</span><span className="cp-preview-pill">Student view</span></div>
                <strong>Course experience</strong>
                <p>Share your perspective on the course.</p>
                <div className="cp-question"><span>Course organisation</span><div><i /><i /><i /><i /><i /></div></div>
                <div className="cp-question"><span>Learning resources</span><div><i /><i /><i /><i /><i /></div></div>
                <div className="cp-question cp-question-muted"><span>Additional comments</span><div /></div>
                <div className="cp-preview-submit">Submit feedback <ArrowRight size={13} /></div>
              </div>
            </article>

            <article className="cp-showcase-card cp-showcase-analytics">
              <div className="cp-showcase-copy">
                <span className="cp-showcase-index">02 / UNDERSTAND</span>
                <h3>See patterns, not noise.</h3>
                <p>Review aggregate course insights and response patterns that support more informed academic conversations.</p>
                <Link href="/login" className="cp-text-link">Sign in to explore <ArrowRight size={15} /></Link>
              </div>
              <div className="cp-analytics-preview" aria-label="Illustrative aggregate analytics preview">
                <div className="cp-analytics-top"><div><small>ANALYTICS OVERVIEW</small><strong>Course insights</strong></div><span>Sample view</span></div>
                <div className="cp-analytics-visual">
                  <div className="cp-donut"><span><BarChart3 size={21} /></span></div>
                  <div className="cp-legend">
                    <span><i /> Course content</span>
                    <span><i /> Teaching</span>
                    <span><i /> Resources</span>
                  </div>
                </div>
                <div className="cp-trend-preview">
                  <div><span>Response trend</span><small>Illustrative</small></div>
                  <div className="cp-trend-line"><i /><i /><i /><i /><i /><i /><i /></div>
                </div>
              </div>
            </article>
          </div>
          <p className="cp-sample-disclaimer">Interface previews use illustrative sample visuals. They are not institution data or product performance claims.</p>
        </div>
      </section>

      <section className="cp-features-section" id="features">
        <div className="cp-section-shell">
          <div className="cp-section-heading cp-heading-wide">
            <div><p className="cp-eyebrow">ONE CONNECTED WORKSPACE</p><h2>Everything around the <em>course experience.</em></h2></div>
            <p>Purpose-built tools for collecting feedback, managing courses and understanding the academic experience.</p>
          </div>
          <div className="cp-feature-grid">
            {capabilities.map(({ icon: Icon, title, text, tone }, index) => (
              <article className={'cp-feature-card cp-feature-' + tone} key={title}>
                <span className="cp-feature-number">0{index + 1}</span>
                <span className="cp-feature-icon"><Icon size={20} strokeWidth={1.8} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="cp-feature-arrow"><ArrowDownRight size={17} /></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-workflow-section" id="workflow">
        <div className="cp-section-shell">
          <div className="cp-section-heading cp-heading-narrow">
            <p className="cp-eyebrow">HOW IT WORKS</p>
            <h2>From student voice to <em>better decisions.</em></h2>
            <p>A focused feedback cycle that keeps the process understandable for everyone involved.</p>
          </div>
          <div className="cp-workflow-grid">
            {workflow.map(({ number, title, text, icon: Icon }, index) => (
              <article className="cp-workflow-step" key={number}>
                <div className="cp-workflow-top"><span>{number}</span><i /><Icon size={21} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
                {index < workflow.length - 1 && <span className="cp-workflow-connector" aria-hidden="true" />}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cp-security-section" id="security">
        <div className="cp-section-shell cp-security-layout">
          <div className="cp-security-copy">
            <p className="cp-eyebrow">PRIVACY AND ACCESS</p>
            <h2>Feedback deserves <em>careful handling.</em></h2>
            <p>CoursePulse is designed to keep student access, feedback answers and aggregate reporting in their proper context.</p>
            <Link href="/privacy" className="cp-text-link">Read the privacy information <ArrowRight size={15} /></Link>
          </div>
          <div className="cp-security-points">
            <article><span><Users size={18} /></span><div><h3>Role-aware access</h3><p>Student, instructor and administrator access is separated by role.</p></div><Check size={17} /></article>
            <article><span><LockKeyhole size={18} /></span><div><h3>Separated records</h3><p>Feedback answers are stored apart from student eligibility records.</p></div><Check size={17} /></article>
            <article><span><BarChart3 size={18} /></span><div><h3>Aggregate reporting</h3><p>Reports suppress groups with fewer than five responses. This is a safeguard, not a guarantee against every inference.</p></div><Check size={17} /></article>
          </div>
        </div>
      </section>

      <section className="cp-final-cta">
        <div className="cp-final-cta-inner">
          <div className="cp-cta-orbit" aria-hidden="true" />
          <p className="cp-eyebrow">START WITH A BETTER CONVERSATION</p>
          <h2>Better feedback.<br /><em>Better courses.</em></h2>
          <p>Bring student perspectives and course insights into one clear workspace.</p>
          <div className="cp-hero-actions cp-cta-actions">
            <Link href="/signup" className="cp-button cp-button-light">Get started <ArrowRight size={17} /></Link>
            <Link href="/login" className="cp-cta-signin">Already have an account? Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="cp-footer">
        <div className="cp-footer-main">
          <div className="cp-footer-brand-col">
            <Link href="/" className="cp-brand"><span className="cp-brand-mark"><Activity size={18} /></span><span>CoursePulse</span></Link>
            <p>Course feedback, made useful. A clearer way to listen, understand and improve.</p>
          </div>
          <div className="cp-footer-links">
            <div><strong>Explore</strong><a href="#product">Product</a><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#security">Security</a></div>
            <div><strong>Workspace</strong><Link href="/login">Sign in</Link><Link href="/signup">Get started</Link><Link href="/contact">Contact</Link></div>
            <div><strong>Information</strong><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link><Link href="/refunds">Refunds</Link></div>
          </div>
        </div>
        <div className="cp-footer-bottom"><span>© {new Date().getFullYear()} CoursePulse</span><span>Built for more thoughtful course feedback.</span></div>
      </footer>
    </main>
  );
}
