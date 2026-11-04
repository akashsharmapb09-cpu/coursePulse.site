'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDownToLine, BookOpen, ChevronDown, CircleHelp, FileBarChart, FilePlus2, GraduationCap, KeyRound, LayoutDashboard, LogOut, Plus, Save, Settings as SettingsIcon, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; email: string | null; full_name: string; role: 'ADMIN'|'INSTRUCTOR'|'STUDENT' };
type Course = { id: string; title: string; description: string; status: string; created_at: string; instructor_id: string };
type Feedback = { id: string; course_id: string; title: string; description: string; is_open: boolean; created_at: string; form_schema?: Question[]; course?: { title: string } };
type Question = { id: string; label: string; type: string; required: boolean; options?: string[] };

export function Dashboard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tab, setTab] = useState<'overview'|'courses'|'feedback'|'analytics'|'account'|'settings'|'faq'>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courseModal, setCourseModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [responseModal, setResponseModal] = useState<Feedback|null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questionLabel, setQuestionLabel] = useState('How would you rate this course?');
  const [questionType, setQuestionType] = useState<'rating'|'text'>('rating');
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [accountName, setAccountName] = useState(profile.full_name || '');
  const [savedAccountName, setSavedAccountName] = useState(profile.full_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [c, f] = await Promise.all([fetch('/api/courses', { cache: 'no-store' }), fetch('/api/feedback', { cache: 'no-store' })]);
      if (!c.ok || !f.ok) throw new Error('Could not load your workspace. Please refresh.');
      const cd = await c.json(); const fd = await f.json();
      setCourses(cd.courses ?? []); setFeedback(fd.feedback ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load workspace.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    try {
      if (window.localStorage.getItem('coursepulse:reduce-motion') === 'true') setReducedMotion(true);
    } catch { /* Browser storage may be unavailable; keep the default preference. */ }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reducedMotion ? 'true' : 'false';
    try { window.localStorage.setItem('coursepulse:reduce-motion', String(reducedMotion)); }
    catch { /* The preference still applies for the current page session. */ }
  }, [reducedMotion]);
  const canTeach = profile.role !== 'STUDENT';
  const stats = useMemo(() => ({ courses: courses.length, forms: feedback.length, open: feedback.filter(f=>f.is_open).length }), [courses, feedback]);
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace('/login'); router.refresh(); }
  async function saveAccount(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const name = accountName.trim();
      if (name.length < 2 || name.length > 120) throw new Error('Name must be between 2 and 120 characters.');
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Your session has expired. Please sign in again.');
      const { error: updateError } = await supabase.from('users').update({ full_name: name }).eq('id', user.id);
      if (updateError) throw new Error(updateError.message);
      setAccountName(name); setSavedAccountName(name); setNotice('Your account details have been updated.'); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update your account.'); }
    finally { setBusy(false); }
  }
  async function updatePassword(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (newPassword.length < 10) throw new Error('Use at least 10 characters for your new password.');
      if (newPassword !== confirmPassword) throw new Error('The passwords do not match.');
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);
      setNewPassword(''); setConfirmPassword(''); setNotice('Your password has been changed successfully.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update your password.'); }
    finally { setBusy(false); }
  }
  async function createCourse(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const res = await fetch('/api/courses', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:courseTitle, description:courseDescription }) }); const data=await res.json(); if(!res.ok) throw new Error(data.error); setCourseModal(false); setCourseTitle(''); setCourseDescription(''); setNotice('Course created.'); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Could not create course.');} finally{setBusy(false);}
  }
  async function createForm(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const schema: Question[] = [{ id:'course-pulse-question', label:questionLabel, type:questionType, required:true, ...(questionType==='rating'?{}:{}) }];
      const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_id:selectedCourse,title:formTitle,description:formDescription,form_schema:schema,retention_days:365})}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setFeedbackModal(false); setNotice('Feedback form published.'); setFormTitle(''); await load();
    } catch(e){setError(e instanceof Error?e.message:'Could not create form.');} finally{setBusy(false);}
  }
  async function fetchAnalytics() { setError(''); const res=await fetch('/api/analytics',{cache:'no-store'}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setAnalytics(data.rows ?? []); }
  async function changeTab(next: typeof tab) { setTab(next); setError(''); setNotice(''); if(next==='analytics') { try { await fetchAnalytics(); } catch(e) { setError(e instanceof Error?e.message:'Analytics unavailable.'); } } }
  const pageTitle: Record<typeof tab, string> = {
    overview: 'Your learning pulse',
    courses: 'Courses',
    feedback: 'Feedback forms',
    analytics: 'Learning analytics',
    account: 'Your account',
    settings: 'Settings',
    faq: 'Help centre',
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/dashboard"><span className="brand-mark">◉</span><span>CoursePulse</span></a>
      <div className="side-workspace"><span className="workspace-icon"><GraduationCap size={18}/></span><span><b>Learning workspace</b><small>Private environment</small></span><ChevronDown size={15}/></div>
      <span className="side-label">WORKSPACE</span>
      <nav className="side-nav">
        <button className={tab==='overview'?'active':''} onClick={()=>void changeTab('overview')}><LayoutDashboard size={17}/> Overview</button>
        <button className={tab==='courses'?'active':''} onClick={()=>void changeTab('courses')}><BookOpen size={17}/> Courses <span>{courses.length}</span></button>
        <button className={tab==='feedback'?'active':''} onClick={()=>void changeTab('feedback')}><FilePlus2 size={17}/> Feedback forms <span>{feedback.length}</span></button>
        {canTeach && <button className={tab==='analytics'?'active':''} onClick={()=>void changeTab('analytics')}><FileBarChart size={17}/> Analytics</button>}
      </nav>
      <span className="side-label account-nav-label">ACCOUNT & SUPPORT</span>
      <nav className="side-nav secondary-nav" aria-label="Account and support">
        <button className={tab==='account'?'active':''} onClick={()=>void changeTab('account')}><UserRound size={17}/> Account</button>
        <button className={tab==='settings'?'active':''} onClick={()=>void changeTab('settings')}><SettingsIcon size={17}/> Settings</button>
        <button className={tab==='faq'?'active':''} onClick={()=>void changeTab('faq')}><CircleHelp size={17}/> FAQ & help</button>
      </nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={18}/><b>Privacy protected</b><p>Student responses stay private. Reporting shows aggregates only.</p></div><div className="user-profile"><div className="avatar">{(profile.full_name||profile.email||'U').slice(0,1).toUpperCase()}</div><div className="user-copy"><b>{profile.full_name||'CoursePulse user'}</b><small>{profile.role.toLowerCase()}</small></div><button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="breadcrumbs">Workspace <span>/</span> <b>{tab[0].toUpperCase()+tab.slice(1)}</b></div><h1>{pageTitle[tab]}</h1></div><div className="top-actions"><span className="role-chip"><span className="role-dot"/>{profile.role.toLowerCase()}</span>{canTeach && <button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> New course</button>}</div></header>
      <section className="content-area">
        {error && <div className="alert error page-alert"><CircleHelp size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}{notice && <div className="alert success page-alert">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {tab==='overview' && <>
          <div className="welcome-row"><div><span className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><h2>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, {profile.full_name?.split(' ')[0]||'there'}.</h2><p>Bring course feedback into focus and turn it into action.</p></div><div className="pulse-orb"><Activity size={26}/><span>Live workspace</span></div></div>
          <div className="metric-grid"><Metric icon={<BookOpen size={19}/>} label="Courses" value={stats.courses} hint="In your workspace"/><Metric icon={<FilePlus2 size={19}/>} label="Feedback forms" value={stats.forms} hint={`${stats.open} currently open`}/><Metric icon={<ShieldCheck size={19}/>} label="Data protection" value="On" hint="Role-based access active"/></div>
          <div className="section-heading"><div><h3>Recent courses</h3><p>Your course workspace at a glance.</p></div>{canTeach&&<button className="text-button" onClick={()=>void changeTab('courses')}>View all courses <ArrowDownToLine size={14}/></button>}</div>
          <CourseList courses={courses.slice(0,4)} role={profile.role} loading={loading} onFeedback={(id)=>{setSelectedCourse(id);setFeedbackModal(true)}}/>
          <div className="section-heading"><div><h3>Recent feedback</h3><p>Forms available to collect student insight.</p></div><button className="text-button" onClick={()=>void changeTab('feedback')}>View all forms <ArrowDownToLine size={14}/></button></div>
          <FeedbackList feedback={feedback.slice(0,4)} role={profile.role} onRespond={setResponseModal}/>
        </>}
        {tab==='courses' && <><div className="section-heading"><div><h3>Course library</h3><p>{canTeach?'Create and manage courses you own.':'Browse published courses.'}</p></div>{canTeach&&<button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> Create course</button>}</div><CourseList courses={courses} role={profile.role} loading={loading} onFeedback={id=>{setSelectedCourse(id);setFeedbackModal(true)}}/></>}
        {tab==='feedback' && <><div className="section-heading"><div><h3>Feedback library</h3><p>Respond to an open form or manage forms you own.</p></div>{canTeach&&<button className="button primary" onClick={()=>{if(courses.length){setSelectedCourse(courses[0].id);setFeedbackModal(true)}else setError('Create a course before adding a feedback form.')}}><Plus size={16}/> New form</button>}</div><FeedbackList feedback={feedback} role={profile.role} onRespond={setResponseModal}/></>}
        {tab==='analytics' && <><div className="section-heading"><div><h3>Aggregate insights</h3><p>Only groups with at least five submissions are shown. Written answers are never included.</p></div><div className="export-actions"><a className="button subtle" href="/api/exports/csv"><ArrowDownToLine size={15}/> CSV</a><a className="button subtle" href="/api/exports/xls"><ArrowDownToLine size={15}/> XLS</a><a className="button subtle" href="/api/exports/pdf"><ArrowDownToLine size={15}/> PDF</a></div></div><div className="privacy-banner"><ShieldCheck size={18}/><span><b>Aggregate-only reporting</b><small>Response identities and free-text answers are excluded. Suppressed groups contain fewer than five responses.</small></span></div><div className="analytics-grid">{analytics.length?analytics.map((r,i)=><article className="analytics-card" key={`${r.feedback_id}-${r.question_id}-${r.option_value}-${i}`}><span className="eyebrow">{r.course_title}</span><h4>{r.question_label}</h4><p>{r.feedback_title}</p><div className="analytic-value">{r.avg_numeric_value!=null?Number(r.avg_numeric_value).toFixed(2):r.response_count}<small>{r.avg_numeric_value!=null?' average score':` responses${r.option_value?` · ${r.option_value}`:''}`}</small></div></article>):<Empty icon={<FileBarChart/>} title="No reportable groups yet" text="Reports appear once at least five students have answered a question."/>}</div></>}
        {tab==='account' && <div className="account-grid">
          <section className="settings-panel">
            <div className="settings-panel-head"><span className="settings-icon"><UserRound size={19}/></span><div><h3>Personal information</h3><p>Manage the details shown across your CoursePulse workspace.</p></div></div>
            <form className="stack-form settings-form" onSubmit={saveAccount}>
              <label>Full name<input value={accountName} onChange={e=>setAccountName(e.target.value)} minLength={2} maxLength={120} required placeholder="Your name"/></label>
              <label>Email address<input value={profile.email||''} disabled readOnly/><small className="field-hint">Your sign-in email is managed by your authentication account.</small></label>
              <label>Workspace role<input value={profile.role.toLowerCase()} disabled readOnly/><small className="field-hint">Roles are assigned by a workspace administrator.</small></label>
              <button className="button primary settings-submit" disabled={busy || !accountName.trim() || accountName.trim()===savedAccountName}><Save size={15}/> {busy?'Saving…':'Save changes'}</button>
            </form>
          </section>
          <aside className="settings-panel account-summary">
            <div className="account-avatar-large">{(savedAccountName||profile.email||'U').slice(0,1).toUpperCase()}</div>
            <span className="eyebrow">YOUR WORKSPACE IDENTITY</span>
            <h3>{savedAccountName||'CoursePulse user'}</h3>
            <p>{profile.email||'Email not available'}</p>
            <span className="role-chip account-role-chip"><span className="role-dot"/>{profile.role.toLowerCase()}</span>
            <div className="account-summary-note"><ShieldCheck size={17}/><span><b>Your data stays protected</b><small>Workspace access is controlled by your assigned role.</small></span></div>
          </aside>
        </div>}
        {tab==='settings' && <div className="settings-stack">
          <section className="settings-panel">
            <div className="settings-panel-head"><span className="settings-icon"><KeyRound size={19}/></span><div><h3>Security</h3><p>Keep your CoursePulse sign-in credentials up to date.</p></div></div>
            <form className="stack-form settings-form password-form" onSubmit={updatePassword}>
              <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={10} maxLength={128} required placeholder="At least 10 characters"/></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={10} maxLength={128} required placeholder="Enter the new password again"/></label>
              <p className="field-hint">Use a unique password that you do not use on other websites.</p>
              <button className="button primary settings-submit" disabled={busy}><KeyRound size={15}/> {busy?'Updating…':'Update password'}</button>
            </form>
          </section>
          <section className="settings-panel">
            <div className="settings-panel-head"><span className="settings-icon"><Activity size={19}/></span><div><h3>Interface preferences</h3><p>Choose how motion is presented in this browser.</p></div></div>
            <label className="preference-row"><span><b>Reduce interface motion</b><small>Minimise animations and transitions throughout CoursePulse.</small></span><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/></label>
            <p className="field-hint preference-footnote">This preference is saved on this device and does not change how other members see their workspace.</p>
          </section>
        </div>}
        {tab==='faq' && <div className="faq-page">
          <div className="faq-hero"><div><span className="eyebrow">COURSEPULSE HELP CENTRE</span><h2>How can we help?</h2><p>Helpful answers to make your learning workspace easier to use.</p></div><div className="faq-hero-mark"><CircleHelp size={27}/><span>We're here to help</span></div></div>
          <div className="faq-layout">
            <div className="faq-list">
              <details className="faq-item"><summary><span>What is CoursePulse?</span><ChevronDown size={17}/></summary><p>CoursePulse helps learning teams create courses, publish feedback forms, and understand feedback through privacy-conscious aggregate reporting.</p></details>
              <details className="faq-item"><summary><span>Who can create courses and feedback forms?</span><ChevronDown size={17}/></summary><p>Administrators and instructors can create courses and feedback forms. Students can browse published courses and respond to open feedback forms.</p></details>
              <details className="faq-item"><summary><span>Can instructors see individual student responses?</span><ChevronDown size={17}/></summary><p>No. Instructor reporting is aggregate-only. It does not expose response identities or written answers.</p></details>
              <details className="faq-item"><summary><span>Why are some analytics not displayed?</span><ChevronDown size={17}/></summary><p>CoursePulse suppresses reporting groups with fewer than five submissions. A group appears once it reaches the minimum reporting threshold.</p></details>
              <details className="faq-item"><summary><span>How do students submit feedback?</span><ChevronDown size={17}/></summary><p>Students can open an available feedback form from a published course and submit their response while signed in.</p></details>
              <details className="faq-item"><summary><span>Can I export analytics?</span><ChevronDown size={17}/></summary><p>Members with analytics access can export the available aggregate reports in CSV, XLS, or PDF format.</p></details>
              <details className="faq-item"><summary><span>How do I change my name or password?</span><ChevronDown size={17}/></summary><p>Open Account to update your display name. Open Settings to change your sign-in password and manage your interface motion preference.</p></details>
              <details className="faq-item"><summary><span>How is workspace access protected?</span><ChevronDown size={17}/></summary><p>CoursePulse uses signed-in accounts and role-based permissions. Your available workspace actions depend on the role assigned to your account.</p></details>
            </div>
            <aside className="faq-support-panel"><span className="settings-icon"><Users size={19}/></span><h3>Need a hand?</h3><p>Start with your account details or workspace settings to manage your access and preferences.</p><button className="button subtle full" onClick={()=>void changeTab('account')}><UserRound size={15}/> Open account</button><button className="button primary full" onClick={()=>void changeTab('settings')}><SettingsIcon size={15}/> Open settings</button></aside>
          </div>
        </div>}
      </section>
    </main>
    {courseModal&&<Modal title="Create a course" onClose={()=>setCourseModal(false)}><form className="stack-form" onSubmit={createCourse}><label>Course title<input value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} minLength={2} maxLength={160} required placeholder="e.g. Introduction to Biology"/></label><label>Description<textarea value={courseDescription} onChange={e=>setCourseDescription(e.target.value)} maxLength={5000} rows={3} placeholder="What will students learn?"/></label><button className="button primary full" disabled={busy}>Create course</button></form></Modal>}
    {feedbackModal&&<Modal title="Create feedback form" onClose={()=>setFeedbackModal(false)}><form className="stack-form" onSubmit={createForm}><label>Course<select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} required>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Form title<input value={formTitle} onChange={e=>setFormTitle(e.target.value)} required maxLength={160} placeholder="End-of-module feedback"/></label><label>Description<textarea value={formDescription} onChange={e=>setFormDescription(e.target.value)} maxLength={3000} rows={2}/></label><label>First question<input value={questionLabel} onChange={e=>setQuestionLabel(e.target.value)} required maxLength={180}/></label><label>Question type<select value={questionType} onChange={e=>setQuestionType(e.target.value as 'rating'|'text')}><option value="rating">Rating (1 to 5)</option><option value="text">Written response</option></select></label><p className="fine-print">This quick form creates one question. You can extend the form schema through the API with additional validated question types.</p><button className="button primary full" disabled={busy}>Publish feedback form</button></form></Modal>}
    {responseModal&&<Modal title={responseModal.title} onClose={()=>setResponseModal(null)}><ResponseForm item={responseModal} onDone={()=>{setResponseModal(null);setNotice('Your response was submitted. Thank you.')}}/></Modal>}
  </div>;
}
function Metric({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:React.ReactNode;hint:string}){return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>}
function CourseList({courses,role,loading,onFeedback}:{courses:Course[];role:string;loading:boolean;onFeedback:(id:string)=>void}){if(loading)return <div className="loading-panel">Loading courses…</div>;if(!courses.length)return <Empty icon={<BookOpen/>} title="No courses yet" text={role==='STUDENT'?'Published courses will appear here.':'Create your first course to get started.'}/>;return <div className="course-grid">{courses.map(c=><article className="course-card" key={c.id}><div className="course-art"><span className="course-art-mark"><GraduationCap size={25}/></span><span className={`status-badge ${c.status.toLowerCase()}`}>{c.status.toLowerCase()}</span></div><div className="course-card-body"><h4>{c.title}</h4><p>{c.description||'No course description yet.'}</p><div className="course-footer"><small>Added {new Date(c.created_at).toLocaleDateString()}</small>{role!=='STUDENT'&&<button className="mini-action" onClick={()=>onFeedback(c.id)}><Plus size={14}/> Feedback</button>}</div></div></article>)}</div>}
function FeedbackList({feedback,role,onRespond}:{feedback:Feedback[];role:string;onRespond:(f:Feedback)=>void}){if(!feedback.length)return <Empty icon={<FilePlus2/>} title="Nothing here yet" text="When feedback forms are created, they will appear here."/>;return <div className="feedback-list">{feedback.map(f=><article className="feedback-row" key={f.id}><div className="feedback-icon"><FilePlus2 size={18}/></div><div className="feedback-copy"><b>{f.title}</b><span>{f.description||'Feedback form'} · {new Date(f.created_at).toLocaleDateString()}</span></div><span className={`status-badge ${f.is_open?'published':'archived'}`}>{f.is_open?'open':'closed'}</span>{role==='STUDENT'&&f.is_open&&<button className="button subtle compact" onClick={()=>onRespond(f)}>Respond <ArrowDownToLine size={14}/></button>}</article>)}</div>}
function Empty({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="empty-state"><div>{icon}</div><h4>{title}</h4><p>{text}</p></div>}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>{children}</section></div>}
function ResponseForm({item,onDone}:{item:Feedback;onDone:()=>void}) {
  const question = item.form_schema?.[0];
  const [answer,setAnswer] = useState<string>('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!question) throw new Error('This form has no questions.');
      let value: unknown = answer;
      if (question.type === 'rating' || question.type === 'number') value = Number(answer);
      if (question.type === 'multiple_choice') value = answer ? [answer] : [];
      const res = await fetch('/api/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedback_id:item.id,answers:{[question.id]:value}})});
      const payload = await res.json(); if(!res.ok) throw new Error(payload.error); onDone();
    } catch(e) { setError(e instanceof Error?e.message:'Could not submit response.'); }
    finally { setBusy(false); }
  }
  if (!question) return <p className="alert error">This form has no questions.</p>;
  return <form className="stack-form" onSubmit={submit}>
    <p className="muted">Your response is private. Instructors only see aggregate summaries, never individual submissions.</p>
    <label>{question.label}
      {question.type === 'rating' ? <select value={answer} onChange={e=>setAnswer(e.target.value)} required><option value="">Choose a rating</option><option value="1">1 · Needs work</option><option value="2">2 · Fair</option><option value="3">3 · Good</option><option value="4">4 · Very good</option><option value="5">5 · Excellent</option></select> : null}
      {question.type === 'number' ? <input type="number" value={answer} onChange={e=>setAnswer(e.target.value)} min="-1000000" max="1000000" step="any" required/> : null}
      {question.type === 'text' || question.type === 'textarea' ? <textarea value={answer} onChange={e=>setAnswer(e.target.value)} rows={4} maxLength={2000} required={question.required} placeholder="Share a thought…"/> : null}
      {question.type === 'single_choice' || question.type === 'multiple_choice' ? <select value={answer} onChange={e=>setAnswer(e.target.value)} required><option value="">Choose an option</option>{(question.options ?? []).map(option=><option key={option} value={option}>{option}</option>)}</select> : null}
    </label>
    {error&&<p className="alert error">{error}</p>}
    <button className="button primary full" disabled={busy}>Submit feedback</button>
  </form>;
}
