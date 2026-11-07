'use client';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowDown, ArrowDownToLine, ArrowUp, BookOpen, Camera, ChevronDown, CircleHelp, FileBarChart, FilePlus2, GraduationCap, KeyRound, LayoutDashboard, LogOut, Plus, Save, Search, Pencil, History, Settings as SettingsIcon, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; email: string | null; full_name: string; role: 'ADMIN'|'INSTRUCTOR'|'STUDENT'; avatar_path?: string | null; avatar_url?: string | null };
type Course = { id: string; title: string; description: string; status: string; created_at: string; instructor_id: string; instructor_name?:string|null; course_code?:string|null; department_id?:string|null; semester_id?:string|null };
type Feedback = { id: string; course_id: string; title: string; description: string; is_open: boolean; created_at: string; due_at?: string | null; version?: number; submitted?: boolean; form_schema?: Question[]; course?: { title: string } };
type FeedbackVersion = {version:number;title:string;description:string;form_schema:Question[];due_at:string|null;changed_by:string|null;created_at:string};
type Question = { id: string; label: string; type: 'rating'|'number'|'single_choice'|'multiple_choice'|'multiple_select'|'yes_no'|'text'|'textarea'; required: boolean; options?: string[]; category?: string };

export function Dashboard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [tab, setTab] = useState<'overview'|'courses'|'feedback'|'history'|'analytics'|'account'|'settings'|'faq'>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courseModal, setCourseModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<Feedback|null>(null);
  const [feedbackVersions, setFeedbackVersions] = useState<FeedbackVersion[]>([]);
  const [responseModal, setResponseModal] = useState<Feedback|null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questionLabel, setQuestionLabel] = useState('How would you rate this course?');
  const [questionType, setQuestionType] = useState<Question['type']>('rating');
  const [questionOptions, setQuestionOptions] = useState('Excellent, Good, Fair, Needs improvement');
  const [questionCategory, setQuestionCategory] = useState('Overall Satisfaction');
  const [questionRequired, setQuestionRequired] = useState(true);
  const [formQuestions, setFormQuestions] = useState<Question[]>([]);
  const [dueAt, setDueAt] = useState('');
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [analyticsRatings, setAnalyticsRatings] = useState<any[]>([]);
  const [analyticsTrends, setAnalyticsTrends] = useState<any[]>([]);
  const [analyticsOptions, setAnalyticsOptions] = useState<{courses:{id:string;title:string}[];semesters:{id:string;name:string}[];departments:{id:string;name:string}[];instructors:{id:string;name:string}[];academic_years:string[];categories:string[]}>({courses:[],semesters:[],departments:[],instructors:[],academic_years:[],categories:[]});
  const [analyticsFilters, setAnalyticsFilters] = useState({course_id:'',semester_id:'',department_id:'',instructor_id:'',academic_year:'',category:'',from_date:'',to_date:''});
  const [comparisonLeft, setComparisonLeft] = useState('');
  const [comparisonRight, setComparisonRight] = useState('');
  const [accountName, setAccountName] = useState(profile.full_name || '');
  const [savedAccountName, setSavedAccountName] = useState(profile.full_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [avatarPath, setAvatarPath] = useState<string | null>(profile.avatar_path ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteRequestBusy, setDeleteRequestBusy] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<{ id: string; status: string; created_at: string; reviewed_at?: string | null; resolution_note?: string } | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const [c, f] = await Promise.all([fetch('/api/courses', { cache: 'no-store' }), fetch('/api/feedback', { cache: 'no-store' })]);
      if (!c.ok || !f.ok) throw new Error('Could not load your workspace. Please refresh.');
      const cd = await c.json(); const fd = await f.json();
      setCourses(cd.courses ?? []);
      let submitted = new Set<string>();
      if (profile.role === 'STUDENT') {
        const supabase = createClient();
        const { data: progress } = await supabase.rpc('get_student_feedback_status');
        submitted = new Set((Array.isArray(progress) ? progress : []).filter((row: { submitted?: boolean }) => row.submitted).map((row: { feedback_id: string }) => row.feedback_id));
      }
      setFeedback((fd.feedback ?? []).map((item: Feedback) => ({ ...item, submitted: submitted.has(item.id) })));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load workspace.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    void supabase.rpc('get_my_data_deletion_requests').then(({ data, error }) => {
      if (!mounted || error) return;
      const rows = Array.isArray(data) ? data : [];
      const activeRequest = rows.find((request: { status: string }) =>
        ['PENDING', 'IN_REVIEW', 'APPROVED'].includes(request.status)
      );
      setDeletionRequest(activeRequest ?? rows[0] ?? null);
    });
    return () => { mounted = false; };
  }, []);
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
  const stats = useMemo(() => ({ courses: courses.length, forms: feedback.length, open: feedback.filter(f=>f.is_open && !f.submitted).length, submitted: feedback.filter(f=>f.submitted).length, completion: feedback.length ? Math.round(feedback.filter(f=>f.submitted).length / feedback.length * 100) : 0 }), [courses, feedback]);
  const categoryScores = useMemo(() => {
    const scores = new Map<string,{weighted:number;count:number}>();
    for (const row of analytics) {
      if (row.question_type !== 'rating' || row.avg_numeric_value == null) continue;
      const category=String(row.category??'Overall Satisfaction');const count=Number(row.response_count);
      const current=scores.get(category)??{weighted:0,count:0};current.weighted+=Number(row.avg_numeric_value)*count;current.count+=count;scores.set(category,current);
    }
    return Array.from(scores.entries()).map(([category,value])=>({category,average:value.count?value.weighted/value.count:0,responses:value.count})).sort((a,b)=>a.category.localeCompare(b.category));
  },[analytics]);
  const sentimentBuckets = useMemo(() => {
    const totals={positive:0,neutral:0,negative:0};
    for(const row of analyticsRatings){const score=Number(row.rating_value),count=Number(row.response_count);if(score>=4)totals.positive+=count;else if(score===3)totals.neutral+=count;else if(score>=1)totals.negative+=count;}
    return totals;
  },[analyticsRatings]);
  const comparisonRows = useMemo(() => {
    if (!comparisonLeft || !comparisonRight || comparisonLeft === comparisonRight || analyticsFilters.course_id) return [];
    const byCourse = (courseId: string) => {
      const grouped = new Map<string,{weighted:number;count:number}>();
      for (const row of analytics) {
        if (row.course_id !== courseId || row.question_type !== 'rating' || row.avg_numeric_value == null) continue;
        const label = String(row.question_label);
        const current = grouped.get(label) ?? { weighted: 0, count: 0 };
        const count = Number(row.response_count);
        current.weighted += Number(row.avg_numeric_value) * count; current.count += count;
        grouped.set(label,current);
      }
      return grouped;
    };
    const left = byCourse(comparisonLeft), right = byCourse(comparisonRight);
    return Array.from(left.entries()).filter(([label])=>right.has(label)).map(([label,a])=>{
      const b = right.get(label)!;
      return { label, leftScore: a.count ? a.weighted/a.count : 0, leftCount: a.count, rightScore: b.count ? b.weighted/b.count : 0, rightCount: b.count };
    });
  }, [analytics, comparisonLeft, comparisonRight, analyticsFilters.course_id]);

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
  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setAvatarBusy(true); setError(''); setNotice('');
    try {
      const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      const extension = extensions[file.type];
      if (!extension) throw new Error('Choose a JPG, PNG, or WEBP image.');
      if (file.size > 2 * 1024 * 1024) throw new Error('Profile photos must be 2 MB or smaller.');
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Your session has expired. Please sign in again.');
      const objectPath = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(objectPath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);
      const { data: signedData, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(objectPath, 3600);
      if (signedError || !signedData?.signedUrl) {
        await supabase.storage.from('avatars').remove([objectPath]);
        throw new Error(signedError?.message || 'Could not prepare the profile photo preview.');
      }
      const { error: metadataError } = await supabase.auth.updateUser({ data: { avatar_path: objectPath } });
      if (metadataError) {
        await supabase.storage.from('avatars').remove([objectPath]);
        throw new Error(metadataError.message);
      }
      const previousPath = avatarPath;
      setAvatarPath(objectPath);
      setAvatarUrl(signedData.signedUrl);
      setNotice('Your profile photo has been updated.');
      if (previousPath && previousPath !== objectPath) {
        await supabase.storage.from('avatars').remove([previousPath]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload your profile photo.');
    } finally {
      setAvatarBusy(false);
      input.value = '';
    }
  }
  async function removeAvatar() {
    if (!avatarPath) return;
    setAvatarBusy(true); setError(''); setNotice('');
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_path: null } });
      if (updateError) throw new Error(updateError.message);
      const previousPath = avatarPath;
      setAvatarPath(null); setAvatarUrl(null);
      const { error: removeError } = await supabase.storage.from('avatars').remove([previousPath]);
      if (removeError) throw new Error(removeError.message);
      setNotice('Your profile photo has been removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove your profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  }
  async function submitDeletionRequest() {
    if (deleteConfirmText.trim() !== 'DELETE') return;
    setDeleteRequestBusy(true); setError(''); setNotice('');
    try {
      const supabase = createClient();
      const { data, error: requestError } = await supabase.rpc('create_my_data_deletion_request');
      if (requestError) throw new Error(requestError.message);
      const request = Array.isArray(data) ? data[0] : data;
      if (!request?.id || !request?.status) throw new Error('The deletion request could not be confirmed. Please try again.');
      setDeletionRequest(request);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
      setNotice('Your account deletion request has been submitted for administrator review. Your account remains active until the request is reviewed and completed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your account deletion request.');
    } finally {
      setDeleteRequestBusy(false);
    }
  }
  async function updatePassword(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (newPassword.length < 10) throw new Error('Use at least 10 characters for your new password.');
      if (newPassword !== confirmPassword) throw new Error('The passwords do not match.');
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);
      const { error: revokeError } = await supabase.auth.signOut({ scope: 'global' });
      if (revokeError) throw new Error('Password changed, but other sessions could not be revoked. Please sign out and contact your administrator.');
      setNewPassword(''); setConfirmPassword(''); router.replace('/login?password=updated'); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update your password.'); }
    finally { setBusy(false); }
  }
  async function createCourse(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const res = await fetch('/api/courses', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title:courseTitle, description:courseDescription }) }); const data=await res.json(); if(!res.ok) throw new Error(data.error); setCourseModal(false); setCourseTitle(''); setCourseDescription(''); setNotice('Course created.'); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Could not create course.');} finally{setBusy(false);}
  }
  function addFormQuestion() {
    const label = questionLabel.trim();
    if (label.length < 2) { setError('Question text must contain at least two characters.'); return; }
    const choiceType = ['single_choice', 'multiple_choice', 'multiple_select'].includes(questionType);
    const options = choiceType ? questionOptions.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    if (choiceType && (!options || options.length < 2 || new Set(options).size !== options.length)) { setError('Add at least two different options, separated by commas.'); return; }
    if (formQuestions.length >= 30) { setError('A feedback form can contain at most 30 questions.'); return; }
    setFormQuestions(current => [...current, { id: `q-${formQuestions.length + 1}-${Date.now().toString(36)}`, label, type: questionType, required: questionRequired, category: questionCategory, ...(options ? { options } : {}) }]);
    setQuestionLabel(''); setQuestionRequired(true); setError('');
  }
  async function toggleFeedbackForm(form: Feedback) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/feedback/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: !form.is_open }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? 'Could not update feedback form status.');
      setNotice(payload.feedback.is_open ? 'Feedback form reopened.' : 'Feedback form closed.'); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update feedback form status.'); }
    finally { setBusy(false); }
  }
  function openNewFeedbackForm(courseId:string) {
    setEditingFeedback(null);setFeedbackVersions([]);setSelectedCourse(courseId);setFormTitle('');setFormDescription('');setFormQuestions([]);setDueAt('');setQuestionLabel('How would you rate this course?');setQuestionType('rating');setQuestionRequired(true);setFeedbackModal(true);setError('');
  }
  async function openFeedbackEditor(form:Feedback) {
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/feedback/${form.id}`,{cache:'no-store'});const payload=await response.json();if(!response.ok)throw new Error(payload.error??'Could not load form details.');
      const current=payload.feedback as Feedback;setEditingFeedback(current);setSelectedCourse(current.course_id);setFormTitle(current.title);setFormDescription(current.description);setFormQuestions(current.form_schema??[]);
      setDueAt(current.due_at?new Date(new Date(current.due_at).getTime()-new Date(current.due_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'');setFeedbackVersions(payload.versions??[]);setFeedbackModal(true);
    } catch(caught){setError(caught instanceof Error?caught.message:'Could not load form details.');}
    finally{setBusy(false);}
  }
  async function restoreFeedbackVersion(version:number) {
    if(!editingFeedback)return;setBusy(true);setError('');setNotice('');
    try{const response=await fetch(`/api/feedback/${editingFeedback.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restore_version:version})});const payload=await response.json();if(!response.ok)throw new Error(payload.error??'Could not restore the selected version.');await openFeedbackEditor(editingFeedback);setNotice(`Feedback form restored as version ${payload.version}.`);await load();}
    catch(caught){setError(caught instanceof Error?caught.message:'Could not restore the selected version.');}finally{setBusy(false);}
  }
  function moveFormQuestion(index:number,direction:-1|1) {
    setFormQuestions(current=>{const next=[...current];const target=index+direction;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return next;});
  }
  async function createForm(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!formQuestions.length) throw new Error('Add at least one question before publishing.');
      const payload = { title:formTitle, description:formDescription, form_schema:formQuestions, due_at:dueAt ? new Date(dueAt).toISOString() : null, ...(editingFeedback ? {} : {course_id:selectedCourse,retention_days:365}) };
      const res=await fetch(editingFeedback?`/api/feedback/${editingFeedback.id}`:'/api/feedback',{method:editingFeedback?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json(); if(!res.ok) throw new Error(data.error);
      setFeedbackModal(false); setNotice(editingFeedback?'Feedback form updated. A new version was recorded.':'Feedback form published.'); setEditingFeedback(null); setFeedbackVersions([]); setFormTitle(''); setFormDescription(''); setFormQuestions([]); setDueAt(''); setQuestionLabel('How would you rate this course?'); await load();
    } catch(e){setError(e instanceof Error?e.message:'Could not create form.');} finally{setBusy(false);}
  }
  async function fetchAnalytics(filters = analyticsFilters) {
    setError(''); const params = new URLSearchParams();
    for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
    const res=await fetch(`/api/analytics${params.size ? `?${params.toString()}` : ''}`,{cache:'no-store'});
    const data=await res.json(); if(!res.ok) throw new Error(data.error);
    setAnalytics(data.rows ?? []); setAnalyticsRatings(data.rating_distribution ?? []); setAnalyticsTrends(data.response_trends ?? []);
    if (data.options) setAnalyticsOptions(data.options);
  }
  async function changeTab(next: typeof tab) { setTab(next); setError(''); setNotice(''); if(next==='analytics') { try { await fetchAnalytics(); } catch(e) { setError(e instanceof Error?e.message:'Analytics unavailable.'); } } }
  const pageTitle: Record<typeof tab, string> = {
    overview: 'Your learning pulse',
    courses: 'Courses',
    feedback: 'Feedback forms',
    history: 'Submission history',
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
        {profile.role==='STUDENT'&&<button className={tab==='history'?'active':''} onClick={()=>void changeTab('history')}><History size={17}/> Submission history <span>{feedback.filter(item=>item.submitted).length}</span></button>}
        {canTeach && <button className={tab==='analytics'?'active':''} onClick={()=>void changeTab('analytics')}><FileBarChart size={17}/> Analytics</button>}
        {profile.role==='ADMIN' && <a className="side-nav-link" href="/admin"><ShieldCheck size={17}/> Admin console</a>}
      </nav>
      <span className="side-label account-nav-label">ACCOUNT & SUPPORT</span>
      <nav className="side-nav secondary-nav" aria-label="Account and support">
        <button className={tab==='account'?'active':''} onClick={()=>void changeTab('account')}><UserRound size={17}/> Account</button>
        <button className={tab==='settings'?'active':''} onClick={()=>void changeTab('settings')}><SettingsIcon size={17}/> Settings</button>
        <button className={tab==='faq'?'active':''} onClick={()=>void changeTab('faq')}><CircleHelp size={17}/> FAQ & help</button>
      </nav>
      <nav className="side-nav logout-nav" aria-label="Session">
        <button className="logout-nav-button" onClick={()=>void signOut()}><LogOut size={17}/> Log out</button>
      </nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={18}/><b>Privacy protected</b><p>Student responses stay private. Reporting shows aggregates only.</p></div><div className="user-profile"><div className="avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : (savedAccountName||profile.email||'U').slice(0,1).toUpperCase()}</div><div className="user-copy"><b>{savedAccountName||'CoursePulse user'}</b><small>{profile.role.toLowerCase()}</small></div></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="breadcrumbs">Workspace <span>/</span> <b>{tab[0].toUpperCase()+tab.slice(1)}</b></div><h1>{pageTitle[tab]}</h1></div><SmartSearch onNavigate={(next)=>{if(next==='admin'){router.push('/admin');return;}void changeTab(next as typeof tab);}}/><div className="top-actions"><span className="role-chip"><span className="role-dot"/>{profile.role.toLowerCase()}</span>{canTeach && <button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> New course</button>}</div></header>
      <section className="content-area">
        {error && <div className="alert error page-alert"><CircleHelp size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}{notice && <div className="alert success page-alert">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {tab==='overview' && <>
          <div className="welcome-row"><div><span className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span><h2>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, {savedAccountName?.split(' ')[0]||'there'}.</h2><p>Bring course feedback into focus and turn it into action.</p></div><div className="pulse-orb"><Activity size={26}/><span>Live workspace</span></div></div>
          <div className="metric-grid"><Metric icon={<BookOpen size={19}/>} label="Courses" value={stats.courses} hint="In your workspace"/><Metric icon={<FilePlus2 size={19}/>} label="Feedback forms" value={stats.forms} hint={`${stats.open} currently open`}/>{profile.role==='STUDENT'?<Metric icon={<ShieldCheck size={19}/>} label="Completed" value={`${stats.submitted}/${stats.forms}`} hint={`${stats.completion}% participation progress`}/>:<Metric icon={<ShieldCheck size={19}/>} label="Data protection" value="On" hint="Role-based access active"/>}</div>{profile.role==='STUDENT'&&<section className="student-progress-panel"><div><b>Feedback participation</b><span>{stats.submitted} completed · {stats.open} pending</span></div><div className="student-progress-track"><i style={{width:`${stats.completion}%`}}/></div><small>{stats.completion}% of available forms submitted</small></section>}
          <div className="section-heading"><div><h3>Recent courses</h3><p>Your course workspace at a glance.</p></div>{canTeach&&<button className="text-button" onClick={()=>void changeTab('courses')}>View all courses <ArrowDownToLine size={14}/></button>}</div>
          <CourseList courses={courses.slice(0,4)} role={profile.role} loading={loading} onFeedback={(id)=>openNewFeedbackForm(id)}/>
          <div className="section-heading"><div><h3>Recent feedback</h3><p>Forms available to collect student insight.</p></div><button className="text-button" onClick={()=>void changeTab('feedback')}>View all forms <ArrowDownToLine size={14}/></button></div>
          <FeedbackList feedback={feedback.slice(0,4)} role={profile.role} onRespond={setResponseModal} onToggle={toggleFeedbackForm} onEdit={openFeedbackEditor} busy={busy}/>
        </>}
        {tab==='courses' && <><div className="section-heading"><div><h3>Course library</h3><p>{canTeach?'Create and manage courses you own.':'Browse published courses.'}</p></div>{canTeach&&<button className="button primary" onClick={()=>setCourseModal(true)}><Plus size={16}/> Create course</button>}</div><CourseList courses={courses} role={profile.role} loading={loading} onFeedback={id=>{setSelectedCourse(id);setFeedbackModal(true)}}/></>}
        {tab==='history' && profile.role==='STUDENT' && <><div className="section-heading"><div><h3>Submission history</h3><p>Only submission status and form metadata are displayed here. Your answer content is not shown.</p></div></div><FeedbackList feedback={feedback.filter(form=>form.submitted)} role="STUDENT" onRespond={setResponseModal} onToggle={toggleFeedbackForm} onEdit={openFeedbackEditor} busy={busy}/></>}
        {tab==='feedback' && <><div className="section-heading"><div><h3>Feedback library</h3><p>Respond to an open form or manage forms you own.</p></div>{canTeach&&<button className="button primary" onClick={()=>{if(courses.length){openNewFeedbackForm(courses[0].id)}else setError('Create a course before adding a feedback form.')}}><Plus size={16}/> New form</button>}</div><FeedbackList feedback={feedback} role={profile.role} onRespond={setResponseModal} onToggle={toggleFeedbackForm} onEdit={openFeedbackEditor} busy={busy}/></>}
        {tab==='analytics' && <>
          <div className="section-heading"><div><h3>Aggregate insights</h3><p>Only groups with at least five submissions are shown. Written answers are never included.</p></div><div className="export-actions"><a className="button subtle" href="/api/exports/csv"><ArrowDownToLine size={15}/> CSV</a><a className="button subtle" href="/api/exports/xls"><ArrowDownToLine size={15}/> XLS</a><a className="button subtle" href="/api/exports/pdf"><ArrowDownToLine size={15}/> PDF</a></div></div>
          <div className="analytics-filters"><label>Course<select value={analyticsFilters.course_id} onChange={e=>setAnalyticsFilters(current=>({...current,course_id:e.target.value}))}><option value="">All assigned courses</option>{courses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Semester<select value={analyticsFilters.semester_id} onChange={e=>setAnalyticsFilters(current=>({...current,semester_id:e.target.value}))}><option value="">All semesters</option>{analyticsOptions.semesters.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Department<select value={analyticsFilters.department_id} onChange={e=>setAnalyticsFilters(current=>({...current,department_id:e.target.value}))}><option value="">All departments</option>{analyticsOptions.departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{profile.role==='ADMIN'&&<label>Instructor<select value={analyticsFilters.instructor_id} onChange={e=>setAnalyticsFilters(current=>({...current,instructor_id:e.target.value}))}><option value="">All instructors</option>{analyticsOptions.instructors.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label>Academic year<select value={analyticsFilters.academic_year} onChange={e=>setAnalyticsFilters(current=>({...current,academic_year:e.target.value,semester_id:''}))}><option value="">All years</option>{analyticsOptions.academic_years.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label>Question category<select value={analyticsFilters.category} onChange={e=>setAnalyticsFilters(current=>({...current,category:e.target.value}))}><option value="">All categories</option>{analyticsOptions.categories.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label>From<input type="date" value={analyticsFilters.from_date} onChange={e=>setAnalyticsFilters(current=>({...current,from_date:e.target.value}))}/></label><label>To<input type="date" value={analyticsFilters.to_date} min={analyticsFilters.from_date||undefined} onChange={e=>setAnalyticsFilters(current=>({...current,to_date:e.target.value}))}/></label><button className="button primary" onClick={()=>void fetchAnalytics()} disabled={busy}>Apply filters</button><button className="button subtle" onClick={()=>{const reset={course_id:'',semester_id:'',department_id:'',instructor_id:'',academic_year:'',category:'',from_date:'',to_date:''};setAnalyticsFilters(reset);void fetchAnalytics(reset);}}>Reset</button></div>
          <section className="analytics-detail-panel"><div className="section-heading"><div><h3>Course comparison</h3><p>Compare matching 1–5 rating questions. Response totals are shown beside each average.</p></div></div><div className="compare-selects"><label>Course A<select value={comparisonLeft} onChange={e=>setComparisonLeft(e.target.value)}><option value="">Choose a course</option>{courses.map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Course B<select value={comparisonRight} onChange={e=>setComparisonRight(e.target.value)}><option value="">Choose another course</option>{courses.filter(course=>course.id!==comparisonLeft).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></label></div>{analyticsFilters.course_id?<p className="comparison-empty">Clear the single-course filter above to compare multiple courses.</p>:comparisonRows.length?<div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Matching question</th><th>Course A</th><th>Course B</th></tr></thead><tbody>{comparisonRows.map(row=><tr key={row.label}><td>{row.label}</td><td><b>{row.leftScore.toFixed(2)}</b><small>{row.leftCount} answers</small></td><td><b>{row.rightScore.toFixed(2)}</b><small>{row.rightCount} answers</small></td></tr>)}</tbody></table></div>:<p className="comparison-empty">Choose two courses with matching reportable rating questions to see a side-by-side comparison.</p>}</section>
          {!!categoryScores.length&&<section className="analytics-detail-panel"><div className="section-heading"><div><h3>Teaching performance by category</h3><p>Response-weighted averages for reportable 1–5 rating questions. Categories without reportable ratings are omitted.</p></div></div><div className="category-visual-grid">{categoryScores.length>=3&&<CategoryRadar values={categoryScores}/>}<div className="category-score-grid">{categoryScores.map(item=><article key={item.category}><span>{item.category}</span><b>{item.average.toFixed(2)}<small>/5</small></b><div className="distribution-track"><i style={{width:`${Math.min(100,item.average*20)}%`}}/></div><small>{item.responses} responses</small></article>)}</div></div></section>}
          <div className="privacy-banner"><ShieldCheck size={18}/><span><b>Aggregate-only reporting</b><small>Response identities and free-text answers are excluded. Suppressed groups contain fewer than five responses.</small></span></div>
          <div className="analytics-grid">{analytics.length?analytics.map((r,i)=><article className="analytics-card" key={`${r.feedback_id}-${r.question_id}-${r.option_value}-${i}`}><span className="eyebrow">{r.course_title}</span><h4>{r.question_label}</h4><p>{r.feedback_title}</p><div className="analytic-value">{r.avg_numeric_value!=null?Number(r.avg_numeric_value).toFixed(2):r.response_count}<small>{r.avg_numeric_value!=null?' average score':` responses${r.option_value?` · ${r.option_value}`:''}`}</small></div></article>):<Empty icon={<FileBarChart/>} title="No reportable groups yet" text="Reports appear once at least five students have answered a question."/>}</div>
          {!!(sentimentBuckets.positive+sentimentBuckets.neutral+sentimentBuckets.negative)&&<section className="analytics-detail-panel"><div className="section-heading"><div><h3>Rating sentiment</h3><p>Counts across rating buckets that individually meet the minimum-size threshold. Buckets below five are omitted.</p></div></div><div className="sentiment-metrics"><article><span>Positive · 4–5</span><b>{sentimentBuckets.positive}</b></article><article><span>Neutral · 3</span><b>{sentimentBuckets.neutral}</b></article><article><span>Needs attention · 1–2</span><b>{sentimentBuckets.negative}</b></article></div></section>}
          {!!analyticsRatings.length&&<section className="analytics-detail-panel"><div className="section-heading"><div><h3>Rating distribution</h3><p>Counts per rating value for reportable questions.</p></div></div><div className="distribution-list">{analyticsRatings.map((row,i)=><div className="distribution-row" key={`${row.course_id}-${row.question_id}-${row.rating_value}-${i}`}><span>{row.course_title} · {row.question_label}</span><b>{row.rating_value}/5</b><div className="distribution-track"><i style={{width:`${Math.min(100,Number(row.response_count)*10)}%`}}/></div><small>{row.response_count}</small></div>)}</div></section>}
          {!!analyticsTrends.length&&!analyticsFilters.category&&<section className="analytics-detail-panel"><div className="section-heading"><div><h3>Response activity</h3><p>Weekly response counts in the selected scope. Each displayed week meets the privacy threshold.</p></div></div><WeeklyTrendChart rows={analyticsTrends}/></section>}
        </>}
        {tab==='account' && <div className="account-grid">
          <section className="settings-panel">
            <div className="settings-panel-head"><span className="settings-icon"><UserRound size={19}/></span><div><h3>Personal information</h3><p>Manage the details shown across your CoursePulse workspace.</p></div></div>
            <div className="profile-photo-control">
              <div className="account-avatar-large profile-avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="Your current profile photo" /> : (savedAccountName||profile.email||'U').slice(0,1).toUpperCase()}</div>
              <div className="profile-photo-copy">
                <b>Profile photo</b>
                <p>Choose a clear photo so your workspace feels personal.</p>
                <div className="profile-photo-actions">
                  <button type="button" className="button subtle compact" onClick={()=>avatarInputRef.current?.click()} disabled={avatarBusy}>
                    <Camera size={15}/> {avatarBusy ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {avatarUrl && <button type="button" className="text-button remove-avatar-button" onClick={()=>void removeAvatar()} disabled={avatarBusy}><Trash2 size={14}/> Remove</button>}
                </div>
                <small>JPG, PNG or WEBP · Up to 2 MB · Private to your account</small>
                <input ref={avatarInputRef} className="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} tabIndex={-1} aria-label="Choose profile photo"/>
              </div>
            </div>
            <form className="stack-form settings-form" onSubmit={saveAccount}>
              <label>Full name<input value={accountName} onChange={e=>setAccountName(e.target.value)} minLength={2} maxLength={120} required placeholder="Your name"/></label>
              <label>Email address<input value={profile.email||''} disabled readOnly/><small className="field-hint">Your sign-in email is managed by your authentication account.</small></label>
              <label>Workspace role<input value={profile.role.toLowerCase()} disabled readOnly/><small className="field-hint">Roles are assigned by a workspace administrator.</small></label>
              <button className="button primary settings-submit" disabled={busy || !accountName.trim() || accountName.trim()===savedAccountName}><Save size={15}/> {busy?'Saving…':'Save changes'}</button>
            </form>
          </section>
          <aside className="settings-panel account-summary">
            <div className="account-avatar-large">{avatarUrl ? <img src={avatarUrl} alt="" /> : (savedAccountName||profile.email||'U').slice(0,1).toUpperCase()}</div>
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
          <section className="settings-panel danger-zone">
            <div className="settings-panel-head"><span className="settings-icon danger-settings-icon"><Trash2 size={19}/></span><div><h3>Delete account</h3><p>Request the permanent deletion of your CoursePulse account and associated personal data.</p></div></div>
            {deletionRequest && <div className="deletion-request-status">
              <span className="deletion-status-dot"/>
              <span><b>Latest request: {deletionRequest.status.toLowerCase().replaceAll('_',' ')}</b><small>Submitted {new Date(deletionRequest.created_at).toLocaleDateString()}</small></span>
            </div>}
            <p className="danger-explanation">Submitting this request does not delete your account immediately. A workspace administrator must review it and complete the deletion workflow. You can keep using CoursePulse while it is under review.</p>
            <button className="button danger-button" type="button" disabled={!!deletionRequest && ['PENDING','IN_REVIEW','APPROVED'].includes(deletionRequest.status)} onClick={()=>{setDeleteConfirmText('');setDeleteConfirmOpen(true);}}>
              <Trash2 size={15}/> {deletionRequest && ['PENDING','IN_REVIEW','APPROVED'].includes(deletionRequest.status) ? 'Request already submitted' : 'Delete account'}
            </button>
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
              <details className="faq-item"><summary><span>How do I add or change my profile photo?</span><ChevronDown size={17}/></summary><p>Open Account and use Upload photo or Change photo. JPG, PNG, and WEBP images up to 2 MB are supported. Your photo is stored privately and only your signed-in account can access it.</p></details>
              <details className="faq-item"><summary><span>What happens when I request account deletion?</span><ChevronDown size={17}/></summary><p>Your request is sent to a workspace administrator for review. Your account remains active until the request is approved and the deletion process is completed. You can check the request status under Settings.</p></details>
              <details className="faq-item"><summary><span>How is workspace access protected?</span><ChevronDown size={17}/></summary><p>CoursePulse uses signed-in accounts and role-based permissions. Your available workspace actions depend on the role assigned to your account.</p></details>
            </div>
            <aside className="faq-support-panel"><span className="settings-icon"><Users size={19}/></span><h3>Need a hand?</h3><p>Start with your account details or workspace settings to manage your access and preferences.</p><button className="button subtle full" onClick={()=>void changeTab('account')}><UserRound size={15}/> Open account</button><button className="button primary full" onClick={()=>void changeTab('settings')}><SettingsIcon size={15}/> Open settings</button></aside>
          </div>
        </div>}
      </section>
    </main>
    {courseModal&&<Modal title="Create a course" onClose={()=>setCourseModal(false)}><form className="stack-form" onSubmit={createCourse}><label>Course title<input value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} minLength={2} maxLength={160} required placeholder="e.g. Introduction to Biology"/></label><label>Description<textarea value={courseDescription} onChange={e=>setCourseDescription(e.target.value)} maxLength={5000} rows={3} placeholder="What will students learn?"/></label><button className="button primary full" disabled={busy}>Create course</button></form></Modal>}
    {feedbackModal&&<Modal title={editingFeedback?'Edit feedback form':'Create feedback form'} onClose={()=>setFeedbackModal(false)}><form className="stack-form" onSubmit={createForm}>
      <label>Course<select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} required><option value="">Choose a course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>Form title<input value={formTitle} onChange={e=>setFormTitle(e.target.value)} required maxLength={160} placeholder="End-of-module feedback"/></label>
      <label>Description<textarea value={formDescription} onChange={e=>setFormDescription(e.target.value)} maxLength={3000} rows={2}/></label>
      <label>Submission deadline <span className="muted-inline">(optional)</span><input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} min={new Date(Date.now()+60000).toISOString().slice(0,16)}/></label>
      <div className="question-builder"><div className="section-heading"><div><h4>Questions</h4><p>Add up to 30 questions. Students complete the full form in one submission.</p></div><span className="role-chip">{formQuestions.length}/30</span></div>
        {formQuestions.map((question,index)=><div className="question-preview" key={question.id}><span>{index+1}</span><div><b>{question.label}</b><small>{question.type.replaceAll('_',' ')} · {question.category??'Overall Satisfaction'} · {question.required?'required':'optional'}</small></div><button type="button" className="icon-button" aria-label={`Move question ${index+1} up`} disabled={index===0} onClick={()=>moveFormQuestion(index,-1)}><ArrowUp size={14}/></button><button type="button" className="icon-button" aria-label={`Move question ${index+1} down`} disabled={index===formQuestions.length-1} onClick={()=>moveFormQuestion(index,1)}><ArrowDown size={14}/></button><button type="button" className="icon-button" aria-label={`Remove question ${index+1}`} onClick={()=>setFormQuestions(items=>items.filter(item=>item.id!==question.id))}><X size={15}/></button></div>)}
        <label>Question text<input value={questionLabel} onChange={e=>setQuestionLabel(e.target.value)} maxLength={180} placeholder="How clear were the learning objectives?"/></label>
        <label>Category<select value={questionCategory} onChange={e=>setQuestionCategory(e.target.value)}><option>Course Content</option><option>Teaching Effectiveness</option><option>Communication</option><option>Course Organization</option><option>Assessment</option><option>Learning Resources</option><option>Overall Satisfaction</option></select></label>
        <label className="admin-active-toggle"><input type="checkbox" checked={questionRequired} onChange={e=>setQuestionRequired(e.target.checked)}/> Required question</label>
        <label>Response type<select value={questionType} onChange={e=>setQuestionType(e.target.value as Question['type'])}><option value="rating">Star / numeric rating (1–5)</option><option value="number">Number</option><option value="single_choice">Single choice</option><option value="multiple_select">Multiple selection</option><option value="yes_no">Yes / No</option><option value="text">Short text</option><option value="textarea">Long text</option></select></label>
        {['single_choice','multiple_choice','multiple_select'].includes(questionType) && <label>Options <small className="field-hint">Separate options with commas.</small><input value={questionOptions} onChange={e=>setQuestionOptions(e.target.value)} maxLength={1000}/></label>}
        <button type="button" className="button subtle full" disabled={formQuestions.length>=30 || !questionLabel.trim()} onClick={addFormQuestion}><Plus size={15}/> Add question</button>
      </div>
      {editingFeedback&&<div className="feedback-version-history"><div className="section-heading"><div><h4><History size={14}/> Version history</h4><p>Edits are snapshotted automatically by the database.</p></div><span className="role-chip">Current v{editingFeedback.version??1}</span></div>{feedbackVersions.length?feedbackVersions.map(version=><div className="feedback-version-row" key={version.version}><span>v{version.version} · {new Date(version.created_at).toLocaleString()}</span><button type="button" className="button subtle compact" disabled={busy} onClick={()=>void restoreFeedbackVersion(version.version)}>Restore</button></div>):<p className="fine-print">No previous versions are available yet.</p>}</div>}
      <button className="button primary full" disabled={busy || !formQuestions.length || !selectedCourse}>{busy?'Publishing…':'Publish feedback form'}</button>
    </form></Modal>}
    {responseModal&&<Modal title={responseModal.title} onClose={()=>setResponseModal(null)}><ResponseForm item={responseModal} onDone={()=>{setResponseModal(null);void load();router.push('/feedback/thank-you');}}/></Modal>}
    {deleteConfirmOpen&&<Modal title="Confirm account deletion request" onClose={()=>{if(!deleteRequestBusy){setDeleteConfirmOpen(false);setDeleteConfirmText('');}}}>
      <div className="delete-confirm-content">
        <div className="delete-confirm-icon"><Trash2 size={21}/></div>
        <h3>Request to delete your account?</h3>
        <p>This sends a formal deletion request to your workspace administrator. Your account and sign-in remain active until the request is reviewed and completed.</p>
        <div className="delete-confirm-warning"><ShieldCheck size={17}/><span>After approval, account data may be permanently removed according to the workspace retention process.</span></div>
        <label>Type <b>DELETE</b> to confirm<input value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)} autoComplete="off" placeholder="Type DELETE"/></label>
        <div className="delete-confirm-actions">
          <button className="button subtle" type="button" disabled={deleteRequestBusy} onClick={()=>{setDeleteConfirmOpen(false);setDeleteConfirmText('');}}>Cancel</button>
          <button className="button danger-button" type="button" disabled={deleteRequestBusy || deleteConfirmText.trim()!=='DELETE'} onClick={()=>void submitDeletionRequest()}>{deleteRequestBusy?'Submitting…':'Submit deletion request'}</button>
        </div>
      </div>
    </Modal>}
  </div>;
}
function CategoryRadar({values}:{values:{category:string;average:number;responses:number}[]}) {
  const width=360,height=300,cx=180,cy=140,radius=94;
  const toPoint=(index:number,level:number)=>{const angle=(-Math.PI/2)+(index*Math.PI*2/values.length);const r=radius*level/5;return `${cx+Math.cos(angle)*r},${cy+Math.sin(angle)*r}`;};
  const points=values.map((value,index)=>toPoint(index,value.average)).join(' ');
  return <div className="category-radar-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Average ratings by category: ${values.map(value=>`${value.category} ${value.average.toFixed(2)} of 5`).join(', ')}`}>
    {[1,2,3,4,5].map(level=><polygon key={level} points={values.map((_,index)=>toPoint(index,level)).join(' ')} fill="none" stroke="#e6eee7" strokeWidth="1"/>)}
    {values.map((value,index)=>{const angle=(-Math.PI/2)+(index*Math.PI*2/values.length);const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius;return <g key={value.category}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#dce7de"/><text x={cx+Math.cos(angle)*(radius+17)} y={cy+Math.sin(angle)*(radius+17)} textAnchor={Math.cos(angle)>.25?'start':Math.cos(angle)<-.25?'end':'middle'} dominantBaseline="middle" className="radar-label">{value.category.length>19?`${value.category.slice(0,17)}…`:value.category}</text></g>;})}
    <polygon points={points} fill="rgba(71,132,91,.16)" stroke="#4e8c63" strokeWidth="2.2" strokeLinejoin="round"/>
    {values.map((value,index)=>{const angle=(-Math.PI/2)+(index*Math.PI*2/values.length);const r=radius*Math.min(1,Math.max(0,value.average/5));return <circle key={value.category} cx={cx+Math.cos(angle)*r} cy={cy+Math.sin(angle)*r} r="3.8" fill="#397b52"/>;})}
  </svg><small>Scale: 0–5 · weighted by reportable response count</small></div>;
}

function WeeklyTrendChart({rows}:{rows:{course_id:string;course_title:string;week_start:string;response_count:number}[]}) {
  const data=[...rows].sort((a,b)=>a.week_start.localeCompare(b.week_start)).slice(-12);
  const width=640,height=230,left=42,right=16,top=16,bottom=48,innerWidth=width-left-right,innerHeight=height-top-bottom;
  const max=Math.max(5,...data.map(row=>Number(row.response_count)));
  const points=data.map((row,index)=>`${left+(data.length===1?innerWidth/2:index*innerWidth/(data.length-1))},${top+innerHeight-(Number(row.response_count)/max)*innerHeight}`).join(' ');
  return <div className="weekly-trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Weekly responses: ${data.map(row=>`${row.week_start}: ${row.response_count}`).join(', ')}`}>
    {[0,1,2,3,4].map(level=>{const y=top+innerHeight-level*innerHeight/4;return <g key={level}><line x1={left} y1={y} x2={width-right} y2={y} stroke="#e9f0ea"/><text x={left-9} y={y+3} textAnchor="end" className="trend-axis-label">{Math.round(max*level/4)}</text></g>;})}
    <polyline points={points} fill="none" stroke="#4e8c63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {data.map((row,index)=>{const x=left+(data.length===1?innerWidth/2:index*innerWidth/(data.length-1));const y=top+innerHeight-(Number(row.response_count)/max)*innerHeight;return <g key={`${row.course_id}-${row.week_start}`}><circle cx={x} cy={y} r="4" fill="#fff" stroke="#397b52" strokeWidth="2.5"><title>{row.course_title} · {row.week_start}: {row.response_count} responses</title></circle><text x={x} y={height-17} textAnchor="middle" className="trend-axis-label">{new Date(`${row.week_start}T00:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</text></g>;})}
  </svg></div>;
}

function SmartSearch({onNavigate}:{onNavigate:(tab:string)=>void}) {
  const [query,setQuery]=useState(''); const [results,setResults]=useState<{id:string;title:string;detail:string;kind:string;tab:string}[]>([]); const [loading,setLoading]=useState(false); const [open,setOpen]=useState(false);
  useEffect(()=>{if(query.trim().length<2){setResults([]);setOpen(false);return;}let cancelled=false;const timer=window.setTimeout(async()=>{setLoading(true);try{const response=await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`,{cache:'no-store'});const payload=await response.json();if(!cancelled&&response.ok){setResults(payload.results??[]);setOpen(true);}}catch{if(!cancelled){setResults([]);setOpen(true);}}finally{if(!cancelled)setLoading(false);}},260);return()=>{cancelled=true;window.clearTimeout(timer);};},[query]);
  return <div className="smart-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>{if(query.trim().length>=2)setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='Enter'&&results[0]){onNavigate(results[0].tab);setOpen(false);}}} placeholder="Search courses, forms…" aria-label="Search accessible workspace records" aria-expanded={open}/>{open&&<div className="smart-search-results" role="listbox">{loading?<p>Searching…</p>:results.length?results.map(item=><button type="button" role="option" key={`${item.kind}-${item.id}`} onClick={()=>{onNavigate(item.tab);setOpen(false);}}><b>{item.title}</b><small>{item.detail}</small><span>{item.kind}</span></button>):<p>No matching records you can access.</p>}</div>}</div>;
}

function Metric({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:React.ReactNode;hint:string}){return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>}
function CourseList({courses,role,loading,onFeedback}:{courses:Course[];role:string;loading:boolean;onFeedback:(id:string)=>void}){if(loading)return <div className="loading-panel">Loading courses…</div>;if(!courses.length)return <Empty icon={<BookOpen/>} title="No courses yet" text={role==='STUDENT'?'Published courses will appear here.':'Create your first course to get started.'}/>;return <div className="course-grid">{courses.map(c=><article className="course-card" key={c.id}><div className="course-art"><span className="course-art-mark"><GraduationCap size={25}/></span><span className={`status-badge ${c.status.toLowerCase()}`}>{c.status.toLowerCase()}</span></div><div className="course-card-body"><h4>{c.title}</h4>{c.course_code&&<span className="course-code-label">{c.course_code}</span>}<p>{c.description||'No course description yet.'}</p>{c.instructor_name&&<div className="course-instructor-line">Instructor · {c.instructor_name}</div>}<div className="course-footer"><small>Added {new Date(c.created_at).toLocaleDateString()}</small>{role!=='STUDENT'&&<button className="mini-action" onClick={()=>onFeedback(c.id)}><Plus size={14}/> Feedback</button>}</div></div></article>)}</div>}
function FeedbackList({feedback,role,onRespond,onToggle,onEdit,busy}:{feedback:Feedback[];role:string;onRespond:(f:Feedback)=>void;onToggle:(f:Feedback)=>void;onEdit:(f:Feedback)=>void;busy:boolean}){if(!feedback.length)return <Empty icon={<FilePlus2/>} title="Nothing here yet" text="When feedback forms are published for your courses, they will appear here."/>;return <div className="feedback-list">{feedback.map(f=><article className="feedback-row" key={f.id}><div className="feedback-icon"><FilePlus2 size={18}/></div><div className="feedback-copy"><b>{f.title}</b><span>{f.description||'Feedback form'} · {new Date(f.created_at).toLocaleDateString()}{f.due_at?` · Due ${new Date(f.due_at).toLocaleString()}`:''}</span></div><span className={`status-badge ${f.submitted?'published':f.is_open?'published':'archived'}`}>{role==='STUDENT'&&f.submitted?'submitted':f.is_open?'open':'closed'}</span>{role==='STUDENT'&&f.is_open&&!f.submitted&&<button className="button subtle compact" onClick={()=>onRespond(f)}>Respond <ArrowDownToLine size={14}/></button>}{role!=='STUDENT'&&<><button className="button subtle compact" disabled={busy} onClick={()=>onEdit(f)}><Pencil size={13}/> Edit</button><button className="button subtle compact" disabled={busy} onClick={()=>onToggle(f)}>{f.is_open?'Close form':'Reopen form'}</button></>}</article>)}</div>}
function Empty({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="empty-state"><div>{icon}</div><h4>{title}</h4><p>{text}</p></div>}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>{children}</section></div>}
function ResponseForm({item,onDone}:{item:Feedback;onDone:()=>void}) {
  const questions = item.form_schema ?? [];
  const [answers,setAnswers] = useState<Record<string, string | string[]>>({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  function setAnswer(id:string,value:string|string[]) { setAnswers(current=>({...current,[id]:value})); }
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const question of questions) {
        const raw = answers[question.id];
        if (raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
          if (question.required) throw new Error(`Please answer: ${question.label}`);
          continue;
        }
        if (question.type === 'rating' || question.type === 'number') {
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) throw new Error(`Enter a valid number for: ${question.label}`);
          payload[question.id] = parsed;
        } else {
          payload[question.id] = raw;
        }
      }
      const res = await fetch('/api/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedback_id:item.id,answers:payload})});
      const response = await res.json(); if(!res.ok) throw new Error(response.error); onDone();
    } catch(e) { setError(e instanceof Error?e.message:'Could not submit response.'); }
    finally { setBusy(false); }
  }
  if (!questions.length) return <p className="alert error">This form has no questions.</p>;
  return <form className="stack-form response-form" onSubmit={submit}>
    <p className="muted">Your submission is stored separately from the eligibility record. Instructors see aggregate results only, with small groups suppressed.</p>
    {questions.map((question,index)=>{
      const value = answers[question.id] ?? (['multiple_choice','multiple_select'].includes(question.type) ? [] : '');
      const options = question.options ?? [];
      return <fieldset className="response-question" key={question.id}>
        <legend>{index+1}. {question.label}{question.required && <span aria-label="required"> *</span>}</legend>
        {question.type === 'rating' && <div className="rating-options" role="radiogroup" aria-label={question.label}>{[1,2,3,4,5].map(score=><label key={score} className={value===String(score)?'selected':''}><input type="radio" name={question.id} value={score} checked={value===String(score)} onChange={e=>setAnswer(question.id,e.target.value)} required={question.required}/><span>{score}</span></label>)}</div>}
        {question.type === 'number' && <input type="number" value={value as string} onChange={e=>setAnswer(question.id,e.target.value)} min="-1000000" max="1000000" step="any" required={question.required}/>}
        {question.type === 'yes_no' && <div className="choice-options"><label><input type="radio" name={question.id} value="Yes" checked={value==='Yes'} onChange={e=>setAnswer(question.id,e.target.value)} required={question.required}/> Yes</label><label><input type="radio" name={question.id} value="No" checked={value==='No'} onChange={e=>setAnswer(question.id,e.target.value)} required={question.required}/> No</label></div>}
        {question.type === 'single_choice' && <div className="choice-options">{options.map(option=><label key={option}><input type="radio" name={question.id} value={option} checked={value===option} onChange={e=>setAnswer(question.id,e.target.value)} required={question.required}/> {option}</label>)}</div>}
        {['multiple_choice','multiple_select'].includes(question.type) && <div className="choice-options">{options.map(option=>{const selected = Array.isArray(value) && value.includes(option); return <label key={option}><input type="checkbox" checked={selected} onChange={e=>setAnswer(question.id,e.target.checked?[...(Array.isArray(value)?value:[]),option]:(Array.isArray(value)?value:[]).filter(item=>item!==option))}/> {option}</label>;})}</div>}
        {(question.type === 'text' || question.type === 'textarea') && <textarea value={value as string} onChange={e=>setAnswer(question.id,e.target.value)} rows={question.type==='text'?2:4} maxLength={2000} required={question.required} placeholder="Share a thought…"/>}
      </fieldset>;
    })}
    {error&&<p className="alert error" role="alert">{error}</p>}
    <p className="fine-print">Submitting this form will mark your feedback as complete. You cannot submit another response to the same form.</p>
    <button className="button primary full" disabled={busy}>{busy?'Submitting securely…':'Submit anonymous feedback'}</button>
  </form>;
}
