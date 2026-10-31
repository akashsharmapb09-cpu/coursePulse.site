'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDownToLine, BookOpen, ChevronDown, CircleHelp, FileBarChart, FilePlus2, GraduationCap, LayoutDashboard, LogOut, Plus, ShieldCheck, Users, X, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; email: string | null; full_name: string; role: 'ADMIN'|'INSTRUCTOR'|'STUDENT' };
type Course = { id: string; title: string; description: string; status: string; created_at: string; instructor_id: string };
type Feedback = { id: string; course_id: string; title: string; description: string; is_open: boolean; submitted?: boolean; due_at?: string|null; created_at: string; form_schema?: Question[]; course?: { title: string } };
type Question = { id: string; label: string; type: 'rating'|'single_choice'|'multiple_choice'|'text'|'textarea'|'number'; required: boolean; options?: string[] };
type AdminUser = { id:string; email:string|null; full_name:string; role:'ADMIN'|'INSTRUCTOR'|'STUDENT'; is_active:boolean; created_at:string; department_id:string|null };
type AuditEvent = { id:string; action:string; target_type:string; target_id:string|null; details:Record<string,unknown>; created_at:string };
type AcademicData = { departments:{id:string;name:string;code:string}[]; semesters:{id:string;name:string;start_date:string;end_date:string;is_active:boolean}[]; courses:{id:string;title:string;department_id:string|null;semester_id:string|null;status:string}[]; students:{id:string;email:string|null;full_name:string;role:string;is_active:boolean}[]; instructors:{id:string;email:string|null;full_name:string;role:string;is_active:boolean}[]; enrollments:{id:string;course_id:string;student_id:string;enrolled_at:string}[]; assignments:{id:string;course_id:string;instructor_id:string;created_at:string}[] };
type SearchResults = {courses:Pick<Course,'id'|'title'|'description'|'status'>[];feedback:Pick<Feedback,'id'|'course_id'|'title'|'description'|'is_open'>[];users:Pick<AdminUser,'id'|'full_name'|'email'|'role'>[]};
type AcademicAction = {action:'department';name:string;code:string}|{action:'semester';name:string;start_date:string;end_date:string}|{action:'enroll';course_id:string;student_id:string}|{action:'assign';course_id:string;instructor_id:string}|{action:'course_academic';course_id:string;department_id:string|null;semester_id:string|null};

export function Dashboard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tab, setTab] = useState<'overview'|'courses'|'feedback'|'analytics'|'admin'>('overview');
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
  const [formDueAt,setFormDueAt]=useState('');
  const [questions, setQuestions] = useState<Question[]>([{ id: 'question-1', label: 'How would you rate this course?', type: 'rating', required: true }]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [compareAnalytics,setCompareAnalytics]=useState<any[]>([]);
  const [analyticsCourseId,setAnalyticsCourseId]=useState('');
  const [compareCourseId,setCompareCourseId]=useState('');
  const [adminUsers,setAdminUsers] = useState<AdminUser[]>([]);
  const [adminAudit,setAdminAudit] = useState<AuditEvent[]>([]);
  const [adminAcademic,setAdminAcademic] = useState<AcademicData>({departments:[],semesters:[],courses:[],students:[],instructors:[],enrollments:[],assignments:[]});
  const [searchQuery,setSearchQuery]=useState('');
  const [searchResults,setSearchResults]=useState<SearchResults|null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [c, f] = await Promise.all([fetch('/api/courses', { cache: 'no-store' }), fetch('/api/feedback', { cache: 'no-store' })]);
      if (!c.ok || !f.ok) throw new Error('Could not load your workspace. Please refresh.');
      const cd = await c.json(); const fd = await f.json();
      setCourses(cd.courses ?? []); setFeedback(fd.feedback ?? []);
      setAnalyticsCourseId(current=>current||cd.courses?.[0]?.id||'');
      setCompareCourseId(current=>current||(cd.courses?.[1]?.id??''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load workspace.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const canTeach = profile.role !== 'STUDENT';
  const stats = useMemo(() => ({ courses: courses.length, forms: feedback.length, open: feedback.filter(f=>f.is_open&&!f.submitted).length, completed: feedback.filter(f=>f.submitted).length }), [courses, feedback]);
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace('/login'); router.refresh(); }
  async function createCourse(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const res = await fetch('/api/courses', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:courseTitle, description:courseDescription }) }); const data=await res.json(); if(!res.ok) throw new Error(data.error); setCourseModal(false); setCourseTitle(''); setCourseDescription(''); setNotice('Course created.'); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Could not create course.');} finally{setBusy(false);}
  }
  async function toggleFeedback(form:Feedback) {
    setBusy(true); setError('');
    try { const res=await fetch('/api/feedback',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:form.id,is_open:!form.is_open})}); const data=await res.json(); if(!res.ok) throw new Error(data.error??'Could not update feedback form.'); setNotice(form.is_open?'Feedback form closed.':'Feedback form reopened.'); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Could not update feedback form.');}
    finally{setBusy(false);}
  }
  async function createForm(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const schema = questions.map((question, index) => ({ ...question, id: `question-${index + 1}`, ...(question.options ? { options: question.options.map(option => option.trim()).filter(Boolean) } : {}) }));
      if (schema.some(question => question.label.trim().length < 2)) throw new Error('Every question needs a clear label.');
      if (schema.some(question => ['single_choice', 'multiple_choice'].includes(question.type) && (question.options?.length ?? 0) < 2)) throw new Error('Choice questions need at least two options.');
      const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_id:selectedCourse,title:formTitle,description:formDescription,form_schema:schema,retention_days:365,due_at:formDueAt?new Date(formDueAt).toISOString():null})}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setFeedbackModal(false); setNotice('Feedback form published.'); setFormTitle(''); setFormDueAt(''); setQuestions([{ id: 'question-1', label: 'How would you rate this course?', type: 'rating', required: true }]); await load();
    } catch(e){setError(e instanceof Error?e.message:'Could not create form.');} finally{setBusy(false);}
  }
  async function loadAdmin() {
    const [usersRes,auditRes,academicRes]=await Promise.all([fetch('/api/admin/users',{cache:'no-store'}),fetch('/api/admin/audit',{cache:'no-store'}),fetch('/api/admin/academic',{cache:'no-store'})]);
    const usersData=await usersRes.json(); const auditData=await auditRes.json(); const academicData=await academicRes.json();
    if(!usersRes.ok) throw new Error(usersData.error??'Could not load administrator users.');
    if(!auditRes.ok) throw new Error(auditData.error??'Could not load audit history.');
    if(!academicRes.ok) throw new Error(academicData.error??'Could not load academic administration data.');
    setAdminUsers(usersData.users??[]); setAdminAudit(auditData.events??[]); setAdminAcademic(academicData);
  }
  async function updateAdminUser(userId:string,role:AdminUser['role'],isActive:boolean) {
    setBusy(true); setError('');
    try {
      const res=await fetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,role,is_active:isActive})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error??'Could not update account access.');
      setNotice('Account access updated and audit logged.'); await loadAdmin();
    } catch(e) { setError(e instanceof Error?e.message:'Could not update account.'); }
    finally { setBusy(false); }
  }
  async function createAcademic(payload:AcademicAction) {
    setBusy(true); setError('');
    try {
      const res=await fetch('/api/admin/academic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json(); if(!res.ok) throw new Error(data.error??'Academic update failed.');
      setNotice('Academic workspace updated and audit logged.'); await loadAdmin();
    } catch(e) { setError(e instanceof Error?e.message:'Academic update failed.'); }
    finally { setBusy(false); }
  }
  async function runSearch(event:FormEvent) {
    event.preventDefault(); setError('');
    if(searchQuery.trim().length<2){setError('Enter at least two characters to search.');return;}
    try { const res=await fetch('/api/search?q='+encodeURIComponent(searchQuery.trim()),{cache:'no-store'}); const data=await res.json(); if(!res.ok) throw new Error(data.error??'Search failed.'); setSearchResults(data); }
    catch(e){setError(e instanceof Error?e.message:'Search failed.');}
  }
  async function fetchAnalytics() { setError(''); setCompareAnalytics([]); const url=analyticsCourseId?'/api/analytics?course_id='+encodeURIComponent(analyticsCourseId):'/api/analytics'; const res=await fetch(url,{cache:'no-store'}); const data=await res.json(); if(!res.ok) throw new Error(data.error); setAnalytics(data.rows ?? []); }
  async function compareCourses() {
    setError('');
    if(!analyticsCourseId||!compareCourseId||analyticsCourseId===compareCourseId){setError('Choose two different courses to compare.');return;}
    try {
      const [first,second]=await Promise.all([fetch('/api/analytics?course_id='+encodeURIComponent(analyticsCourseId),{cache:'no-store'}),fetch('/api/analytics?course_id='+encodeURIComponent(compareCourseId),{cache:'no-store'})]);
      const [a,b]=await Promise.all([first.json(),second.json()]);
      if(!first.ok||!second.ok) throw new Error(a.error??b.error??'Course comparison failed.');
      setAnalytics(a.rows??[]);setCompareAnalytics(b.rows??[]);
    } catch(e){setError(e instanceof Error?e.message:'Course comparison failed.');}
  }
  async function changeTab(next: typeof tab) { setTab(next); if(next==='analytics') { try { await fetchAnalytics(); } catch(e) { setError(e instanceof Error?e.message:'Analytics unavailable.'); } } if(next==='admin') { try { await loadAdmin(); } catch(e) { setError(e instanceof Error?e.message:'Admin workspace unavailable.'); } } }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/dashboard"><span className="brand-mark">◉</span><span>CoursePulse</span></a>
      <div className="side-workspace"><span className="workspace-icon"><GraduationCap size={18}/></span><span><b>Learning workspace</b><small>Private environment</small></span><ChevronDown size={15}/></div>
      <span className="side-label">WORKSPACE</span>
      <nav className="side-nav">
        <button className={tab==='overview'?'active':''} onClick={()=>void changeTab('overview')}><LayoutDashboard size={17}/> Overview</button>
        <button className={tab==='courses'?'active':''} onClick={()=>void changeTab('courses')}><BookOpen size={17}/> Courses <span>{courses.length}</span></button>
        <button className={tab==='feedback'?'active':''} onClick={()=>void changeTab('feedback')}><FilePlus2 size={17}/> Feedback forms <span>{feedback.length}</span></button>
        {canTeach && <button className={tab==='analytics'?'active':''} onClick={()=>void changeTab('analytics')}><FileBarChart size={17}/> Analytics</button>}{profile.role==='ADMIN' && <button className={tab==='admin'?'active':''} onClick={()=>void changeTab('admin')}><Users size={17}/> Administration</button>}
      </nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={18}/><b>Privacy protected</b><p>Submission eligibility is stored separately from answers. Reports show aggregates only.</p></div><div className="user-profile"><div className="avatar">{(profile.full_name||profile.email||'U').slice(0,1).toUpperCase()}</div><div className="user-copy"><b>{profile.full_name||'CoursePulse user'}</b><small>{profile.role.toLowerCase()}</small></div><button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="breadcrumbs">Workspace <span>/</span> <b>{tab[0].toUpperCase()+tab.slice(1)}</b></div><h1>{tab==='overview'?'Your learning pulse':tab==='courses'?'Courses':tab==='feedback'?'Feedback forms':tab==='admin'?'Administration':'Learning analytics'}</h1></div><div className="top-actions"><form className="global-search" role="search" onSubmit={runSearch}><Search size={16}/><input aria-label="Search courses, feedback and users" placeholder="Search workspace…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/><button type="submit" aria-label="Search"><Search size={15}/></button></form><span className="role-chip"><span className="role-dot"/>{profile.role.toLowerCase()}</span>{canTeach && <button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> New course</button>}</div></header>
      <section className="content-area">
        {searchResults && <section className="search-results-panel"><div className="section-heading"><div><h3>Search results</h3><p>Matches for “{searchQuery.trim()}”</p></div><button className="text-button" onClick={()=>setSearchResults(null)}>Clear search <X size={14}/></button></div><div className="search-result-grid">{searchResults.courses.map(item=><button key={item.id} className="search-result" onClick={()=>{setTab('courses');setSearchResults(null)}}><BookOpen size={16}/><span><b>{item.title}</b><small>Course · {item.status.toLowerCase()}</small></span></button>)}{searchResults.feedback.map(item=><button key={item.id} className="search-result" onClick={()=>{const found=feedback.find(form=>form.id===item.id);if(found&&profile.role==='STUDENT'&&found.is_open&&!found.submitted)setResponseModal(found);else setTab('feedback');setSearchResults(null)}}><FilePlus2 size={16}/><span><b>{item.title}</b><small>Feedback form · {item.is_open?'open':'closed'}</small></span></button>)}{searchResults.users.map(item=><button key={item.id} className="search-result" onClick={()=>{void changeTab('admin');setSearchResults(null)}}><Users size={16}/><span><b>{item.full_name||item.email||'User'}</b><small>User · {item.role.toLowerCase()}</small></span></button>)}{!searchResults.courses.length&&!searchResults.feedback.length&&!searchResults.users.length&&<p className="muted">No matching courses, forms or users were found in your permitted workspace.</p>}</div></section>}
        {error && <div className="alert error page-alert"><CircleHelp size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}{notice && <div className="alert success page-alert">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {tab==='overview' && <>
          <div className="welcome-row"><div><span className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><h2>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, {profile.full_name?.split(' ')[0]||'there'}.</h2><p>Bring course feedback into focus and turn it into action.</p></div><div className="pulse-orb"><Activity size={26}/><span>Live workspace</span></div></div>
          <div className="metric-grid"><Metric icon={<BookOpen size={19}/>} label="Courses" value={stats.courses} hint="In your workspace"/><Metric icon={<FilePlus2 size={19}/>} label={profile.role==='STUDENT'?'Pending responses':'Feedback forms'} value={profile.role==='STUDENT'?stats.open:stats.forms} hint={profile.role==='STUDENT'?`${stats.completed} completed`:`${stats.open} currently open`}/><Metric icon={<ShieldCheck size={19}/>} label="Data protection" value="On" hint="Role-based access active"/></div>
          <div className="section-heading"><div><h3>Recent courses</h3><p>Your course workspace at a glance.</p></div>{canTeach&&<button className="text-button" onClick={()=>void changeTab('courses')}>View all courses <ArrowDownToLine size={14}/></button>}</div>
          <CourseList courses={courses.slice(0,4)} role={profile.role} loading={loading} onFeedback={(id)=>{setSelectedCourse(id);setFeedbackModal(true)}}/>
          <div className="section-heading"><div><h3>Recent feedback</h3><p>Forms available to collect student insight.</p></div><button className="text-button" onClick={()=>void changeTab('feedback')}>View all forms <ArrowDownToLine size={14}/></button></div>
          <FeedbackList feedback={feedback.slice(0,4)} role={profile.role} onRespond={setResponseModal} onToggle={toggleFeedback}/>
        </>}
        {tab==='courses' && <><div className="section-heading"><div><h3>Course library</h3><p>{canTeach?'Create and manage courses you own.':'Browse published courses.'}</p></div>{canTeach&&<button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> Create course</button>}</div><CourseList courses={courses} role={profile.role} loading={loading} onFeedback={id=>{setSelectedCourse(id);setFeedbackModal(true)}}/></>}
        {tab==='feedback' && <><div className="section-heading"><div><h3>Feedback library</h3><p>Respond to an open form or manage forms you own.</p></div>{canTeach&&<button className="button primary" onClick={()=>{if(courses.length){setSelectedCourse(courses[0].id);setFeedbackModal(true)}else setError('Create a course before adding a feedback form.')}}><Plus size={16}/> New form</button>}</div><FeedbackList feedback={feedback} role={profile.role} onRespond={setResponseModal} onToggle={toggleFeedback}/></>}
        {tab==='admin' && <AdminConsole users={adminUsers} audit={adminAudit} academic={adminAcademic} currentUserId={profile.id} busy={busy} onUpdate={updateAdminUser} onAcademicCreate={createAcademic}/>}
        {tab==='analytics' && <><div className="section-heading"><div><h3>Aggregate insights</h3><p>Only groups with at least five submissions are shown. Written answers are never included.</p></div><div className="export-actions"><a className="button subtle" href="/api/exports/csv"><ArrowDownToLine size={15}/> CSV</a><a className="button subtle" href="/api/exports/xls"><ArrowDownToLine size={15}/> XLS</a><a className="button subtle" href="/api/exports/xlsx"><ArrowDownToLine size={15}/> XLSX</a><a className="button subtle" href="/api/exports/pdf"><ArrowDownToLine size={15}/> PDF</a></div></div><div className="analytics-filters"><label>Course<select value={analyticsCourseId} onChange={e=>{setAnalyticsCourseId(e.target.value);setCompareAnalytics([])}}><option value="">All assigned courses</option>{courses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Compare with<select value={compareCourseId} onChange={e=>setCompareCourseId(e.target.value)}><option value="">Select another course</option>{courses.filter(course=>course.id!==analyticsCourseId).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><button className="button primary compact" onClick={()=>void compareCourses()} disabled={!analyticsCourseId||!compareCourseId}>Compare courses</button><button className="button subtle compact" onClick={()=>void fetchAnalytics()}>Apply filter</button></div>{compareAnalytics.length>0&&<div className="comparison-panel"><div className="section-heading"><div><h3>Course comparison</h3><p>Only matching questions with reportable cohort sizes are compared.</p></div></div><div className="comparison-grid">{analytics.filter(row=>row.avg_numeric_value!=null).map((row,index)=>{const match=compareAnalytics.find(other=>other.avg_numeric_value!=null&&other.question_label===row.question_label&&other.question_type===row.question_type);return match?<article className="comparison-card" key={row.question_id+'-'+index}><b>{row.question_label}</b><div className="comparison-values"><span><small>{row.course_title}</small><strong>{Number(row.avg_numeric_value).toFixed(2)}</strong></span><span><small>{match.course_title}</small><strong>{Number(match.avg_numeric_value).toFixed(2)}</strong></span></div><p>Difference: {(Number(row.avg_numeric_value)-Number(match.avg_numeric_value)).toFixed(2)} points</p></article>:null;})}</div></div>}<div className="privacy-banner"><ShieldCheck size={18}/><span><b>Aggregate-only reporting</b><small>Response identities and free-text answers are excluded. Suppressed groups contain fewer than five responses.</small></span></div><div className="analytics-grid">{analytics.length?analytics.map((r,i)=><article className="analytics-card" key={`${r.feedback_id}-${r.question_id}-${r.option_value}-${i}`}><span className="eyebrow">{r.course_title}</span><h4>{r.question_label}</h4><p>{r.feedback_title}</p><div className="analytic-value">{r.avg_numeric_value!=null?Number(r.avg_numeric_value).toFixed(2):r.response_count}<small>{r.avg_numeric_value!=null?' average score':` responses${r.option_value?` · ${r.option_value}`:''}`}</small></div></article>):<Empty icon={<FileBarChart/>} title="No reportable groups yet" text="Reports appear once at least five students have answered a question."/>}</div></>}
      </section>
    </main>
    {courseModal&&<Modal title="Create a course" onClose={()=>setCourseModal(false)}><form className="stack-form" onSubmit={createCourse}><label>Course title<input value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} minLength={2} maxLength={160} required placeholder="e.g. Introduction to Biology"/></label><label>Description<textarea value={courseDescription} onChange={e=>setCourseDescription(e.target.value)} maxLength={5000} rows={3} placeholder="What will students learn?"/></label><button className="button primary full" disabled={busy}>Create course</button></form></Modal>}
    {feedbackModal&&<Modal title="Create feedback form" onClose={()=>setFeedbackModal(false)}><form className="stack-form" onSubmit={createForm}><label>Course<select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} required>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Form title<input value={formTitle} onChange={e=>setFormTitle(e.target.value)} required maxLength={160} placeholder="End-of-module feedback"/></label><label>Description<textarea value={formDescription} onChange={e=>setFormDescription(e.target.value)} maxLength={3000} rows={2}/></label><label>Submission deadline (optional)<input type="datetime-local" value={formDueAt} min={new Date(Date.now()+60000).toISOString().slice(0,16)} onChange={e=>setFormDueAt(e.target.value)}/><small className="fine-print">Students cannot submit after this time.</small></label><div className="section-heading"><div><h3>Questions</h3><p>Add up to 30 questions to this form.</p></div><button type="button" className="button subtle compact" disabled={questions.length>=30} onClick={()=>setQuestions(current=>[...current,{id:`question-${current.length+1}`,label:'',type:'rating',required:true}])}><Plus size={14}/> Add question</button></div>{questions.map((question,index)=><fieldset key={question.id} className="stack-form rounded-xl border border-[#e5ece6] p-4"><legend className="px-1 text-xs font-bold text-[#62766b]">Question {index+1}</legend><label>Question text<input value={question.label} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,label:e.target.value}:item))} required minLength={2} maxLength={180} placeholder="What should students answer?"/></label><label>Answer type<select value={question.type} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,type:e.target.value as Question['type'],options:['single_choice','multiple_choice'].includes(e.target.value)?(item.options??['Option 1','Option 2']):undefined}:item))}><option value="rating">Rating (1 to 5)</option><option value="number">Number</option><option value="text">Short text</option><option value="textarea">Long text</option><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option></select></label>{['single_choice','multiple_choice'].includes(question.type)&&<label>Options (comma separated)<input value={(question.options??[]).join(', ')} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,options:e.target.value.split(',').map(option=>option.trim()).filter(Boolean)}:item))} placeholder="Option 1, Option 2"/></label>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={question.required} onChange={e=>setQuestions(current=>current.map((item,i)=>i===index?{...item,required:e.target.checked}:item))}/> Required question</label>{questions.length>1&&<button type="button" className="text-button self-start" onClick={()=>setQuestions(current=>current.filter((_,i)=>i!==index))}>Remove question</button>}</fieldset>)}<button className="button primary full" disabled={busy}>Publish feedback form</button></form></Modal>}
    {responseModal&&<Modal title={responseModal.title} onClose={()=>setResponseModal(null)}><ResponseForm item={responseModal} onDone={()=>{setResponseModal(null);setNotice('Your response was submitted. Thank you.')}}/></Modal>}
  </div>;
}
function Metric({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:React.ReactNode;hint:string}){return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>}
function CourseList({courses,role,loading,onFeedback}:{courses:Course[];role:string;loading:boolean;onFeedback:(id:string)=>void}){if(loading)return <div className="loading-panel">Loading courses…</div>;if(!courses.length)return <Empty icon={<BookOpen/>} title="No courses yet" text={role==='STUDENT'?'Published courses will appear here.':'Create your first course to get started.'}/>;return <div className="course-grid">{courses.map(c=><article className="course-card" key={c.id}><div className="course-art"><span className="course-art-mark"><GraduationCap size={25}/></span><span className={`status-badge ${c.status.toLowerCase()}`}>{c.status.toLowerCase()}</span></div><div className="course-card-body"><h4>{c.title}</h4><p>{c.description||'No course description yet.'}</p><div className="course-footer"><small>Added {new Date(c.created_at).toLocaleDateString()}</small>{role!=='STUDENT'&&<button className="mini-action" onClick={()=>onFeedback(c.id)}><Plus size={14}/> Feedback</button>}</div></div></article>)}</div>}
function FeedbackList({feedback,role,onRespond,onToggle}:{feedback:Feedback[];role:string;onRespond:(f:Feedback)=>void;onToggle:(f:Feedback)=>void}){if(!feedback.length)return <Empty icon={<FilePlus2/>} title="Nothing here yet" text="When feedback forms are created, they will appear here."/>;return <div className="feedback-list">{feedback.map(f=>{const expired=Boolean(f.due_at&&new Date(f.due_at).getTime()<=Date.now());return <article className="feedback-row" key={f.id}><div className="feedback-icon"><FilePlus2 size={18}/></div><div className="feedback-copy"><b>{f.title}</b><span>{f.description||'Feedback form'} · {new Date(f.created_at).toLocaleDateString()}{f.due_at?` · Due ${new Date(f.due_at).toLocaleString()}`:''}</span></div><span className={`status-badge ${f.submitted?'published':f.is_open?'published':'archived'}`}>{f.submitted?'completed':expired?'expired':f.is_open?'open':'closed'}</span>{role==='STUDENT'&&f.is_open&&!f.submitted&&!expired&&<button className="button subtle compact" onClick={()=>onRespond(f)}>Respond <ArrowDownToLine size={14}/></button>}{role!=='STUDENT'&&<button className="button subtle compact" onClick={()=>onToggle(f)}>{f.is_open?'Close form':'Reopen form'}</button>}</article>})}</div>}
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

function AdminConsole({users,audit,academic,currentUserId,busy,onUpdate,onAcademicCreate}:{users:AdminUser[];audit:AuditEvent[];academic:AcademicData;currentUserId:string;busy:boolean;onUpdate:(id:string,role:AdminUser['role'],active:boolean)=>void;onAcademicCreate:(payload:AcademicAction)=>void}) {
  return <div className="space-y-8">
    <div className="section-heading"><div><h3>User and role management</h3><p>Role changes and account suspensions require administrator MFA and are recorded in the audit log.</p></div><span className="role-chip">{users.length} accounts</span></div>
    {!users.length?<Empty icon={<Users/>} title="No accounts found" text="Newly registered users will appear here."/>:<div className="feedback-list">{users.map(user=><article className="feedback-row" key={user.id}><div className="feedback-icon"><Users size={18}/></div><div className="feedback-copy min-w-0"><b className="truncate">{user.full_name||user.email||'CoursePulse user'}</b><span className="truncate">{user.email||'No email'} · Joined {new Date(user.created_at).toLocaleDateString()}</span></div><select aria-label={`Role for ${user.email??user.id}`} value={user.role} disabled={busy||user.id===currentUserId} onChange={e=>onUpdate(user.id,e.target.value as AdminUser['role'],user.is_active)} className="max-w-32"><option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option><option value="ADMIN">Admin</option></select><button className={`button compact ${user.is_active?'subtle':'primary'}`} disabled={busy||user.id===currentUserId} onClick={()=>onUpdate(user.id,user.role,!user.is_active)}>{user.is_active?'Suspend':'Reactivate'}</button><span className={`status-badge ${user.is_active?'published':'archived'}`}>{user.is_active?'active':'suspended'}</span></article>)}</div>}
    <AdminAcademicManager data={academic} busy={busy} onCreate={onAcademicCreate}/>
    <div><div className="section-heading"><div><h3>Administrator audit trail</h3><p>Latest privileged account and academic actions.</p></div></div>{!audit.length?<Empty icon={<ShieldCheck/>} title="No audit events yet" text="Administrator actions will be recorded here."/>:<div className="feedback-list">{audit.map(event=><article className="feedback-row" key={event.id}><div className="feedback-icon"><ShieldCheck size={18}/></div><div className="feedback-copy"><b>{event.action.replace(/\./g,' ')}</b><span>{event.target_type} · {event.target_id??'—'} · {new Date(event.created_at).toLocaleString()}</span></div></article>)}</div>}</div>
  </div>;
}

function AdminAcademicManager({data,busy,onCreate}:{data:AcademicData;busy:boolean;onCreate:(payload:AcademicAction)=>void}) {
  const [departmentName,setDepartmentName]=useState('');
  const [departmentCode,setDepartmentCode]=useState('');
  const [semesterName,setSemesterName]=useState('');
  const [semesterStart,setSemesterStart]=useState('');
  const [semesterEnd,setSemesterEnd]=useState('');
  const [enrollCourse,setEnrollCourse]=useState('');
  const [enrollStudent,setEnrollStudent]=useState('');
  const [assignCourse,setAssignCourse]=useState('');
  const [assignInstructor,setAssignInstructor]=useState('');
  const [academicCourse,setAcademicCourse]=useState('');
  const [academicDepartment,setAcademicDepartment]=useState('');
  const [academicSemester,setAcademicSemester]=useState('');
  return <section className="space-y-5"><div className="section-heading"><div><h3>Academic structure</h3><p>Manage departments, terms, student enrollments and instructor course assignments.</p></div></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <form className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-5" onSubmit={e=>{e.preventDefault();onCreate({action:'department',name:departmentName,code:departmentCode});setDepartmentName('');setDepartmentCode('');}}><h4 className="font-extrabold">Create department</h4><label>Department name<input required minLength={2} maxLength={120} value={departmentName} onChange={e=>setDepartmentName(e.target.value)} placeholder="Computer Science"/></label><label>Department code<input required minLength={2} maxLength={20} value={departmentCode} onChange={e=>setDepartmentCode(e.target.value)} placeholder="CSE"/></label><button className="button primary" disabled={busy}>Add department</button><p className="fine-print">{data.departments.length} departments configured</p></form>
      <form className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-5" onSubmit={e=>{e.preventDefault();onCreate({action:'semester',name:semesterName,start_date:semesterStart,end_date:semesterEnd});setSemesterName('');setSemesterStart('');setSemesterEnd('');}}><h4 className="font-extrabold">Create academic semester</h4><label>Semester name<input required minLength={2} maxLength={100} value={semesterName} onChange={e=>setSemesterName(e.target.value)} placeholder="Fall 2026"/></label><label>Start date<input type="date" required value={semesterStart} onChange={e=>setSemesterStart(e.target.value)}/></label><label>End date<input type="date" required min={semesterStart||undefined} value={semesterEnd} onChange={e=>setSemesterEnd(e.target.value)}/></label><button className="button primary" disabled={busy}>Add semester</button><p className="fine-print">{data.semesters.length} semesters configured</p></form>
      <form className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-5" onSubmit={e=>{e.preventDefault();onCreate({action:'enroll',course_id:enrollCourse,student_id:enrollStudent});}}><h4 className="font-extrabold">Enroll student in course</h4><label>Course<select required value={enrollCourse} onChange={e=>setEnrollCourse(e.target.value)}><option value="">Select course</option>{data.courses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Student<select required value={enrollStudent} onChange={e=>setEnrollStudent(e.target.value)}><option value="">Select student</option>{data.students.map(student=><option key={student.id} value={student.id}>{student.full_name||student.email}</option>)}</select></label><button className="button primary" disabled={busy||!data.students.length||!data.courses.length}>Enroll student</button><p className="fine-print">{data.enrollments.length} course enrollments</p></form>
      <form className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-5" onSubmit={e=>{e.preventDefault();onCreate({action:'assign',course_id:assignCourse,instructor_id:assignInstructor});}}><h4 className="font-extrabold">Assign instructor</h4><label>Course<select required value={assignCourse} onChange={e=>setAssignCourse(e.target.value)}><option value="">Select course</option>{data.courses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Instructor<select required value={assignInstructor} onChange={e=>setAssignInstructor(e.target.value)}><option value="">Select instructor</option>{data.instructors.map(instructor=><option key={instructor.id} value={instructor.id}>{instructor.full_name||instructor.email}</option>)}</select></label><button className="button primary" disabled={busy||!data.instructors.length||!data.courses.length}>Assign instructor</button><p className="fine-print">{data.assignments.length} instructor assignments</p></form>
      <form className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-5 lg:col-span-2" onSubmit={e=>{e.preventDefault();onCreate({action:'course_academic',course_id:academicCourse,department_id:academicDepartment||null,semester_id:academicSemester||null});}}><h4 className="font-extrabold">Set course department and semester</h4><label>Course<select required value={academicCourse} onChange={e=>setAcademicCourse(e.target.value)}><option value="">Select course</option>{data.courses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label>Department<select value={academicDepartment} onChange={e=>setAcademicDepartment(e.target.value)}><option value="">No department</option>{data.departments.map(item=><option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label><label>Semester<select value={academicSemester} onChange={e=>setAcademicSemester(e.target.value)}><option value="">No semester</option>{data.semesters.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><button className="button primary self-start" disabled={busy||!academicCourse}>Save course structure</button></form>
    </div>
  </section>;
}
