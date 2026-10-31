'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDownToLine, BookOpen, ChevronDown, CircleHelp, FileBarChart, FilePlus2, GraduationCap, LayoutDashboard, LogOut, Plus, ShieldCheck, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; email: string | null; full_name: string; role: 'ADMIN'|'INSTRUCTOR'|'STUDENT' };
type Course = { id: string; title: string; description: string; status: string; created_at: string; instructor_id: string };
type Feedback = { id: string; course_id: string; title: string; description: string; is_open: boolean; created_at: string; form_schema?: Question[]; course?: { title: string } };
type Question = { id: string; label: string; type: 'rating'|'single_choice'|'multiple_choice'|'text'|'textarea'|'number'; required: boolean; options?: string[] };

export function Dashboard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tab, setTab] = useState<'overview'|'courses'|'feedback'|'analytics'>('overview');
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
  const [questions, setQuestions] = useState<Question[]>([{ id: 'question-1', label: 'How would you rate this course?', type: 'rating', required: true }]);
  const [analytics, setAnalytics] = useState<any[]>([]);

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
  const canTeach = profile.role !== 'STUDENT';
  const stats = useMemo(() => ({ courses: courses.length, forms: feedback.length, open: feedback.filter(f=>f.is_open).length }), [courses, feedback]);
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace('/login'); router.refresh(); }
  async function createCourse(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const res = await fetch('/api/courses', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:courseTitle, description:courseDescription }) }); const data=await res.json(); if(!res.ok) throw new Error(data.error); setCourseModal(false); setCourseTitle(''); setCourseDescription(''); setNotice('Course created.'); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Could not create course.');} finally{setBusy(false);}
  }
  async function createForm(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const schema = questions.map((question, index) => ({ ...question, id: `question-${index + 1}`, ...(question.options ? { options: question.options.map(option => option.trim()).filter(Boolean) } : {}) }));
      if (schema.some(question => question.label.trim().length < 2)) throw new Error('Every question needs a clear label.');
      if (schema.some(question => ['single_choice', 'multiple_choice'].includes(question.type) && (question.options?.length ?? 0) < 2)) throw new Error('Choice questions need at least two options.');
      const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_id:selectedCourse,title:formTitle,description:formDescription,form_schema:schema,retention_days:365})}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setFeedbackModal(false); setNotice('Feedback form published.'); setFormTitle(''); setQuestions([{ id: 'question-1', label: 'How would you rate this course?', type: 'rating', required: true }]); await load();
    } catch(e){setError(e instanceof Error?e.message:'Could not create form.');} finally{setBusy(false);}
  }
  async function fetchAnalytics() { setError(''); const res=await fetch('/api/analytics',{cache:'no-store'}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setAnalytics(data.rows ?? []); }
  async function changeTab(next: typeof tab) { setTab(next); if(next==='analytics') { try { await fetchAnalytics(); } catch(e) { setError(e instanceof Error?e.message:'Analytics unavailable.'); } } }
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
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={18}/><b>Privacy protected</b><p>Submission eligibility is stored separately from answers. Reports show aggregates only.</p></div><div className="user-profile"><div className="avatar">{(profile.full_name||profile.email||'U').slice(0,1).toUpperCase()}</div><div className="user-copy"><b>{profile.full_name||'CoursePulse user'}</b><small>{profile.role.toLowerCase()}</small></div><button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="breadcrumbs">Workspace <span>/</span> <b>{tab[0].toUpperCase()+tab.slice(1)}</b></div><h1>{tab==='overview'?'Your learning pulse':tab==='courses'?'Courses':tab==='feedback'?'Feedback forms':'Learning analytics'}</h1></div><div className="top-actions"><span className="role-chip"><span className="role-dot"/>{profile.role.toLowerCase()}</span>{canTeach && <button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> New course</button>}</div></header>
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
        {tab==='analytics' && <><div className="section-heading"><div><h3>Aggregate insights</h3><p>Only groups with at least five submissions are shown. Written answers are never included.</p></div><div className="export-actions"><a className="button subtle" href="/api/exports/csv"><ArrowDownToLine size={15}/> CSV</a><a className="button subtle" href="/api/exports/xls"><ArrowDownToLine size={15}/> XLS</a><a className="button subtle" href="/api/exports/xlsx"><ArrowDownToLine size={15}/> XLSX</a><a className="button subtle" href="/api/exports/pdf"><ArrowDownToLine size={15}/> PDF</a></div></div><div className="privacy-banner"><ShieldCheck size={18}/><span><b>Aggregate-only reporting</b><small>Response identities and free-text answers are excluded. Suppressed groups contain fewer than five responses.</small></span></div><div className="analytics-grid">{analytics.length?analytics.map((r,i)=><article className="analytics-card" key={`${r.feedback_id}-${r.question_id}-${r.option_value}-${i}`}><span className="eyebrow">{r.course_title}</span><h4>{r.question_label}</h4><p>{r.feedback_title}</p><div className="analytic-value">{r.avg_numeric_value!=null?Number(r.avg_numeric_value).toFixed(2):r.response_count}<small>{r.avg_numeric_value!=null?' average score':` responses${r.option_value?` · ${r.option_value}`:''}`}</small></div></article>):<Empty icon={<FileBarChart/>} title="No reportable groups yet" text="Reports appear once at least five students have answered a question."/>}</div></>}
      </section>
    </main>
    {courseModal&&<Modal title="Create a course" onClose={()=>setCourseModal(false)}><form className="stack-form" onSubmit={createCourse}><label>Course title<input value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} minLength={2} maxLength={160} required placeholder="e.g. Introduction to Biology"/></label><label>Description<textarea value={courseDescription} onChange={e=>setCourseDescription(e.target.value)} maxLength={5000} rows={3} placeholder="What will students learn?"/></label><button className="button primary full" disabled={busy}>Create course</button></form></Modal>}
    {feedbackModal&&<Modal title="Create feedback form" onClose={()=>setFeedbackModal(false)}><form className="stack-form" onSubmit={createForm}><label>Course<select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} required>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Form title<input value={formTitle} onChange={e=>setFormTitle(e.target.value)} required maxLength={160} placeholder="End-of-module feedback"/></label><label>Description<textarea value={formDescription} onChange={e=>setFormDescription(e.target.value)} maxLength={3000} rows={2}/></label><div className="section-heading"><div><h3>Questions</h3><p>Add up to 30 questions to this form.</p></div><button type="button" className="button subtle compact" disabled={questions.length>=30} onClick={()=>setQuestions(current=>[...current,{id:`question-${current.length+1}`,label:'',type:'rating',required:true}])}><Plus size={14}/> Add question</button></div>{questions.map((question,index)=><fieldset key={question.id} className="stack-form rounded-xl border border-[#e5ece6] p-4"><legend className="px-1 text-xs font-bold text-[#62766b]">Question {index+1}</legend><label>Question text<input value={question.label} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,label:e.target.value}:item))} required minLength={2} maxLength={180} placeholder="What should students answer?"/></label><label>Answer type<select value={question.type} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,type:e.target.value as Question['type'],options:['single_choice','multiple_choice'].includes(e.target.value)?(item.options??['Option 1','Option 2']):undefined}:item))}><option value="rating">Rating (1 to 5)</option><option value="number">Number</option><option value="text">Short text</option><option value="textarea">Long text</option><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option></select></label>{['single_choice','multiple_choice'].includes(question.type)&&<label>Options (comma separated)<input value={(question.options??[]).join(', ')} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,options:e.target.value.split(',').map(option=>option.trim()).filter(Boolean)}:item))} placeholder="Option 1, Option 2"/></label>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={question.required} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,required:e.target.checked}:item))}/> Required question</label>{questions.length>1&&<button type="button" className="text-button self-start" onClick={()=>setQuestions(current=>current.filter((_,i)=>i!==index))}>Remove question</button>}</fieldset>)}<button className="button primary full" disabled={busy}>Publish feedback form</button></form></Modal>}
    {responseModal&&<Modal title={responseModal.title} onClose={()=>setResponseModal(null)}><ResponseForm item={responseModal} onDone={()=>{setResponseModal(null);setNotice('Your response was submitted. Thank you.')}}/></Modal>}
  </div>;
}
function Metric({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:React.ReactNode;hint:string}){return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>}
function CourseList({courses,role,loading,onFeedback}:{courses:Course[];role:string;loading:boolean;onFeedback:(id:string)=>void}){if(loading)return <div className="loading-panel">Loading courses…</div>;if(!courses.length)return <Empty icon={<BookOpen/>} title="No courses yet" text={role==='STUDENT'?'Published courses will appear here.':'Create your first course to get started.'}/>;return <div className="course-grid">{courses.map(c=><article className="course-card" key={c.id}><div className="course-art"><span className="course-art-mark"><GraduationCap size={25}/></span><span className={`status-badge ${c.status.toLowerCase()}`}>{c.status.toLowerCase()}</span></div><div className="course-card-body"><h4>{c.title}</h4><p>{c.description||'No course description yet.'}</p><div className="course-footer"><small>Added {new Date(c.created_at).toLocaleDateString()}</small>{role!=='STUDENT'&&<button className="mini-action" onClick={()=>onFeedback(c.id)}><Plus size={14}/> Feedback</button>}</div></div></article>)}</div>}
function FeedbackList({feedback,role,onRespond}:{feedback:Feedback[];role:string;onRespond:(f:Feedback)=>void}){if(!feedback.length)return <Empty icon={<FilePlus2/>} title="Nothing here yet" text="When feedback forms are created, they will appear here."/>;return <div className="feedback-list">{feedback.map(f=><article className="feedback-row" key={f.id}><div className="feedback-icon"><FilePlus2 size={18}/></div><div className="feedback-copy"><b>{f.title}</b><span>{f.description||'Feedback form'} · {new Date(f.created_at).toLocaleDateString()}</span></div><span className={`status-badge ${f.is_open?'published':'archived'}`}>{f.is_open?'open':'closed'}</span>{role==='STUDENT'&&f.is_open&&<button className="button subtle compact" onClick={()=>onRespond(f)}>Respond <ArrowDownToLine size={14}/></button>}</article>)}</div>}
function Empty({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="empty-state"><div>{icon}</div><h4>{title}</h4><p>{text}</p></div>}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>{children}</section></div>}
function ResponseForm({item,onDone}:{item:Feedback;onDone:()=>void}) {
  const questions = item.form_schema ?? [];
  const [answers,setAnswers] = useState<Record<string,string|string[]>>({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!questions.length) throw new Error('This form has no questions.');
      const payload: Record<string,unknown> = {};
      for (const question of questions) {
        const value = answers[question.id];
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
        if (question.type === 'rating' || question.type === 'number') payload[question.id] = Number(value);
        else payload[question.id] = value;
      }
      const res = await fetch('/api/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedback_id:item.id,answers:payload})});
      const result = await res.json(); if(!res.ok) throw new Error(result.error); onDone();
    } catch(e) { setError(e instanceof Error?e.message:'Could not submit response.'); }
    finally { setBusy(false); }
  }
  if (!questions.length) return <p className="alert error">This form has no questions.</p>;
  return <form className="stack-form" onSubmit={submit}>
    <p className="muted">Your answers are stored separately from your one-time eligibility record. Instructors and administrators only see aggregate summaries, never individual submissions.</p>
    {questions.map(question=><label key={question.id}>{question.label}{question.required?' *':''}
      {question.type === 'rating' && <select value={typeof answers[question.id]==='string'?answers[question.id] as string:''} onChange={e=>setAnswers(current=>({...current,[question.id]:e.target.value}))} required={question.required}><option value="">Choose a rating</option><option value="1">1 · Needs work</option><option value="2">2 · Fair</option><option value="3">3 · Good</option><option value="4">4 · Very good</option><option value="5">5 · Excellent</option></select>}
      {question.type === 'number' && <input type="number" value={typeof answers[question.id]==='string'?answers[question.id] as string:''} onChange={e=>setAnswers(current=>({...current,[question.id]:e.target.value}))} min="-1000000" max="1000000" step="any" required={question.required}/>}
      {(question.type === 'text' || question.type === 'textarea') && <textarea value={typeof answers[question.id]==='string'?answers[question.id] as string:''} onChange={e=>setAnswers(current=>({...current,[question.id]:e.target.value}))} rows={question.type==='textarea'?4:2} maxLength={2000} required={question.required} placeholder="Share a thought…"/>}
      {question.type === 'single_choice' && <select value={typeof answers[question.id]==='string'?answers[question.id] as string:''} onChange={e=>setAnswers(current=>({...current,[question.id]:e.target.value}))} required={question.required}><option value="">Choose an option</option>{(question.options??[]).map(option=><option key={option} value={option}>{option}</option>)}</select>}
      {question.type === 'multiple_choice' && <select multiple value={Array.isArray(answers[question.id])?answers[question.id] as string[]:[]} onChange={e=>{const selected=Array.from(e.currentTarget.selectedOptions,option=>option.value);setAnswers(current=>({...current,[question.id]:selected}));}} required={question.required} className="min-h-28">{(question.options??[]).map(option=><option key={option} value={option}>{option}</option>)}</select>}
    </label>)}
    {error&&<p className="alert error" role="alert">{error}</p>}
    <button className="button primary full" disabled={busy}>{busy?'Submitting…':'Submit feedback'}</button>
  </form>;
}
