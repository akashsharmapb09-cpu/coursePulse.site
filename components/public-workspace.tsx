'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { StudentAccountControl } from '@/components/student-account-control';
import { Activity, ArrowLeft, ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2, Download, MessageSquareText, Moon, RotateCcw, Star, Sun, Trash2 } from 'lucide-react';

type Course = { id:string; code:string; title:string; teacher:string; semester:string };
type Response = { id:string; courseId:string; overall:number; clarity:number; pace:number; resources:number; comment:string; createdAt:string };
type Tab = 'overview'|'feedback'|'reminders'|'results';
type Reminder = { id:string; courseId:string; title:string; dueAt:string; completed:boolean; createdAt:string };
const KEY = 'coursepulse-college-demo-responses-v1';
const REMINDER_KEY = 'coursepulse-feedback-reminders-v1';
const THEME_KEY = 'coursepulse-dashboard-theme-v1';
const COURSES:Course[] = [
  {id:'cse201',code:'CSE 201',title:'Data Structures',teacher:'Dr. Priya Sharma',semester:'Semester 3'},
  {id:'cse305',code:'CSE 305',title:'Database Management',teacher:'Prof. Aman Verma',semester:'Semester 5'},
  {id:'cse310',code:'CSE 310',title:'Web Development',teacher:'Ms. Neha Kapoor',semester:'Semester 5'},
  {id:'cse402',code:'CSE 402',title:'Operating Systems',teacher:'Dr. Rahul Mehta',semester:'Semester 7'}
];
function isResponse(value:unknown):value is Response {
  if(!value || typeof value!=='object') return false;
  const item=value as Record<string,unknown>;
  const rating=(v:unknown)=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=5;
  return typeof item.id==='string' && typeof item.courseId==='string' && COURSES.some(c=>c.id===item.courseId)
    && rating(item.overall)&&rating(item.clarity)&&rating(item.pace)&&rating(item.resources)
    && typeof item.comment==='string'&&typeof item.createdAt==='string';
}
function isReminder(value:unknown):value is Reminder {
  if(!value || typeof value!=='object') return false;
  const item=value as Record<string,unknown>;
  return typeof item.id==='string' && typeof item.courseId==='string' && COURSES.some(c=>c.id===item.courseId)
    && typeof item.title==='string' && typeof item.dueAt==='string' && !Number.isNaN(Date.parse(item.dueAt))
    && typeof item.completed==='boolean' && typeof item.createdAt==='string';
}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function StarRating({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}) {
  return <fieldset><legend className="text-sm font-semibold text-[#253b2e]">{label}</legend><div className="mt-2 flex items-center gap-2">
    {[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={label+' '+n+' out of 5'} aria-pressed={value===n} onClick={()=>onChange(n)} className={'grid h-10 w-10 place-items-center rounded-xl border '+(n<=value?'border-[#245b3e] bg-[#eaf3ec] text-[#245b3e]':'border-[#dce6de] bg-white text-[#9aa99e]')}><Star size={17} fill={n<=value?'currentColor':'none'}/></button>)}
    <span className="text-xs text-[#6b7d71]">{value?value+'/5':'Choose a rating'}</span></div></fieldset>;
}
export function PublicWorkspace() {
  const [tab,setTab]=useState<Tab>('overview');
  const [responses,setResponses]=useState<Response[]>([]);
  const [reminders,setReminders]=useState<Reminder[]>([]);
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [reminderCourseId,setReminderCourseId]=useState(COURSES[0].id);
  const [reminderTitle,setReminderTitle]=useState('');
  const [reminderDueAt,setReminderDueAt]=useState('');
  const [reminderError,setReminderError]=useState('');
  const [ready,setReady]=useState(false);
  const [courseId,setCourseId]=useState(COURSES[0].id);
  const [overall,setOverall]=useState(0),[clarity,setClarity]=useState(0),[pace,setPace]=useState(0),[resources,setResources]=useState(0);
  const [comment,setComment]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[storageWarning,setStorageWarning]=useState(false);
  useEffect(()=>{
    try{const raw=window.localStorage.getItem(KEY);if(raw){const value:unknown=JSON.parse(raw);if(Array.isArray(value))setResponses(value.filter(isResponse).slice(0,500));}}
    catch{setStorageWarning(true);}
    try{const raw=window.localStorage.getItem(REMINDER_KEY);if(raw){const value:unknown=JSON.parse(raw);if(Array.isArray(value))setReminders(value.filter(isReminder).slice(0,100));}}
    catch{setStorageWarning(true);}
    try{if(window.localStorage.getItem(THEME_KEY)==='dark')setTheme('dark');}
    catch{setStorageWarning(true);}
    setReady(true);
  },[]);
  useEffect(()=>{if(!ready)return;try{window.localStorage.setItem(KEY,JSON.stringify(responses));}catch{setStorageWarning(true);}},[ready,responses]);
  useEffect(()=>{if(!ready)return;try{window.localStorage.setItem(REMINDER_KEY,JSON.stringify(reminders));}catch{setStorageWarning(true);}},[ready,reminders]);
  useEffect(()=>{if(!ready)return;document.documentElement.dataset.coursepulseTheme=theme;try{window.localStorage.setItem(THEME_KEY,theme);}catch{setStorageWarning(true);}},[ready,theme]);
  const totalAverage=useMemo(()=>avg(responses.map(r=>r.overall)),[responses]);
  const summary=useMemo(()=>COURSES.map(course=>{const items=responses.filter(r=>r.courseId===course.id);return {...course,count:items.length,rating:avg(items.map(r=>r.overall))};}),[responses]);
  const upcomingReminders=useMemo(()=>reminders.filter(r=>!r.completed).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt)),[reminders]);
  const sortedReminders=useMemo(()=>[...reminders].sort((a,b)=>Number(a.completed)-Number(b.completed)||Date.parse(a.dueAt)-Date.parse(b.dueAt)),[reminders]);
  const selected=COURSES.find(c=>c.id===courseId)??COURSES[0];
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setNotice('');
    if(![overall,clarity,pace,resources].every(v=>v>=1&&v<=5)){setError('Please complete all four ratings before submitting.');return;}
    const next:Response={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),courseId,overall,clarity,pace,resources,comment:comment.trim(),createdAt:new Date().toISOString()};
    setResponses(current=>[next,...current].slice(0,500));
    setReminders(current=>current.map(item=>item.courseId===courseId&&!item.completed?{...item,completed:true}:item));
    setOverall(0);setClarity(0);setPace(0);setResources(0);setComment('');
    setNotice('Your feedback has been saved locally. Any active reminder for this course is now complete.');setTab('results');
  }
  function addReminder(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setReminderError('');
    if(!reminderDueAt || Number.isNaN(Date.parse(reminderDueAt)) || Date.parse(reminderDueAt)<=Date.now()){
      setReminderError('Choose a future date and time for this reminder.');return;
    }
    const course=COURSES.find(c=>c.id===reminderCourseId)??COURSES[0];
    const next:Reminder={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),courseId:course.id,title:reminderTitle.trim()||`Submit ${course.code} course feedback`,dueAt:reminderDueAt,completed:false,createdAt:new Date().toISOString()};
    setReminders(current=>[next,...current].slice(0,100));setReminderTitle('');setReminderDueAt('');setNotice('Your feedback reminder has been saved in this browser.');
  }
  function exportCsv(){
    if(!responses.length)return;
    const cell=(v:string|number)=>'"'+String(v).replaceAll('"','""')+'"';
    const rows=[['Course code','Course','Overall rating','Teaching clarity','Course pace','Learning resources','Comment','Submitted at'].map(cell).join(','),
      ...responses.map(r=>{const c=COURSES.find(x=>x.id===r.courseId);return [c?.code??'',c?.title??'',r.overall,r.clarity,r.pace,r.resources,r.comment,new Date(r.createdAt).toLocaleString()].map(cell).join(',');})];
    const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='coursepulse-feedback.csv';anchor.click();URL.revokeObjectURL(url);
  }
  function clearData(){if(!responses.length||!window.confirm('Clear all feedback saved in this browser? This cannot be undone.'))return;setResponses([]);setNotice('The local project responses have been cleared.');}
  const tabs:[Tab,string,typeof Activity][]=[['overview','Overview',BarChart3],['feedback','Give feedback',MessageSquareText],['reminders','Reminders',Bell],['results','Results',BookOpen]];
  return <main className="coursepulse-workspace min-h-screen bg-[#f5f8f5] text-[#20352a]">
    <header className="border-b border-[#e2ebe3] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
      <Link href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="gap-3 text-lg font-extrabold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#245b3e] text-white"><Activity size={20}/></span>CoursePulse<span className="hidden rounded-full bg-[#edf5ef] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#477956] sm:inline-flex">College project</span></Link>
      <nav aria-label="Workspace navigation" className="flex flex-wrap gap-2">{tabs.map(([id,label,Icon])=><button key={id} type="button" onClick={()=>{setTab(id);setNotice('');setError('');}} aria-pressed={tab===id} className={'inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold '+(tab===id?'bg-[#245b3e] text-white':'text-[#53685a] hover:bg-[#eff5f0]')}><Icon size={16}/>{label}</button>)}</nav>
      <button type="button" onClick={()=>setTheme(current=>current==='dark'?'light':'dark')} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce6de] bg-white px-3 py-2 text-sm font-semibold text-[#456052] hover:bg-[#eff5f0]"><span className="grid h-5 w-5 place-items-center">{theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</span><span className="hidden sm:inline">{theme==='dark'?'Light mode':'Dark mode'}</span></button>
      <StudentAccountControl />
    </div></header>
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#477956]">Course feedback workspace</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{tab==='overview'?'A better way to hear every student.':tab==='feedback'?'Share your course feedback.':tab==='reminders'?'Your feedback reminders.':'Feedback results.'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#607267]">{tab==='overview'?'Choose a course, share an honest opinion, and see how the class is doing.':tab==='feedback'?'Your feedback stays anonymous and is not linked to your student account. The form does not add your name or username.':tab==='reminders'?'Set a due date for course feedback and keep track of what is still pending.':'Review course-level summaries based on responses saved in this browser.'}</p></div><Link href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} className="gap-2 rounded-xl border border-[#dce6de] bg-white px-4 py-2.5 text-sm font-semibold text-[#456052]"><ArrowLeft size={15}/>Home</Link></div>
      <div className="mb-6 rounded-2xl border border-[#dce9dd] bg-[#edf5ef] px-4 py-3 text-sm leading-6 text-[#456052]"><b>Student project:</b> student accounts store your name, username and programme. There are no Admin or HOD sign-up roles. Feedback remains separate from your account, is saved only in this browser, and is not sent to a college server.</div>
      {notice&&<p role="status" className="mb-5 rounded-xl border border-[#cfe2d2] bg-white px-4 py-3 text-sm font-semibold text-[#286640]">{notice}</p>}
      {storageWarning&&<p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This browser could not save local project data. Responses may not remain after the page closes.</p>}
      {!ready?<div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(n=><div key={n} className="h-28 animate-pulse rounded-2xl bg-white"/>)}</div>:
      tab==='overview'?<>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[#e4ece5] bg-white p-5"><p className="text-sm font-semibold text-[#5c7463]">Responses saved</p><p className="mt-4 text-3xl font-extrabold">{responses.length}</p><p className="mt-1 text-xs text-[#829087]">On this device</p></article>
          <article className="rounded-2xl border border-[#e4ece5] bg-white p-5"><p className="text-sm font-semibold text-[#5c7463]">Average rating</p><p className="mt-4 text-3xl font-extrabold">{totalAverage===null?'Not rated':totalAverage.toFixed(1)+'/5'}</p><p className="mt-1 text-xs text-[#829087]">Across local responses</p></article>
          <article className="rounded-2xl border border-[#e4ece5] bg-white p-5"><p className="text-sm font-semibold text-[#5c7463]">Courses available</p><p className="mt-4 text-3xl font-extrabold">{COURSES.length}</p><p className="mt-1 text-xs text-[#829087]">Example college courses</p></article>
          <article className="rounded-2xl border border-[#e4ece5] bg-white p-5"><p className="text-sm font-semibold text-[#5c7463]">Pending reminders</p><p className="mt-4 text-3xl font-extrabold">{upcomingReminders.length}</p><p className="mt-1 text-xs text-[#829087]">Feedback due dates</p></article>
        </section>
        <section className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold">Your courses</h2><p className="mt-1 text-sm text-[#718177]">Select a course to submit feedback.</p></div><button type="button" onClick={()=>setTab('feedback')} className="inline-flex items-center gap-2 rounded-xl bg-[#245b3e] px-4 py-2.5 text-sm font-bold text-white"><MessageSquareText size={16}/>Give feedback<ArrowRight size={15}/></button></div>
          <div className="grid gap-4 md:grid-cols-2">{summary.map(course=><article key={course.id} className="rounded-2xl border border-[#e4ece5] bg-white p-5 sm:p-6"><p className="text-xs font-bold text-[#477956]">{course.code} / {course.semester}</p><h3 className="mt-2 text-lg font-extrabold">{course.title}</h3><p className="mt-1 text-sm text-[#75857a]">{course.teacher}</p><div className="mt-5 flex justify-between border-t border-[#edf1ed] pt-4 text-sm"><span>{course.count} responses</span><b>{course.rating===null?'Not rated':course.rating.toFixed(1)+'/5'}</b></div><button type="button" onClick={()=>{setCourseId(course.id);setTab('feedback');setNotice('');}} className="mt-4 text-sm font-bold text-[#286640]">Review this course <ArrowRight size={14} className="inline"/></button></article>)}</div>
        </section>
        <section className="mt-8 rounded-2xl border border-[#e4ece5] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Upcoming feedback reminders</h2><p className="mt-1 text-sm text-[#718177]">Keep track of the courses you still need to review.</p></div><button type="button" onClick={()=>setTab('reminders')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce6de] px-4 py-2 text-sm font-bold text-[#286640]"><Bell size={15}/>Manage reminders<ArrowRight size={14}/></button></div>{upcomingReminders.length?<div className="mt-4 grid gap-3 sm:grid-cols-2">{upcomingReminders.slice(0,4).map(reminder=>{const course=COURSES.find(c=>c.id===reminder.courseId);return <div key={reminder.id} className="flex items-start gap-3 rounded-xl bg-[#f5f8f5] p-4"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf3ec] text-[#286640]"><CalendarDays size={17}/></span><div className="min-w-0"><p className="text-sm font-bold">{reminder.title}</p><p className="mt-1 text-xs text-[#718177]">{course?.code??'Course'} · {new Date(reminder.dueAt).toLocaleString()}</p></div></div>;})}</div>:<p className="mt-4 rounded-xl bg-[#f5f8f5] px-4 py-5 text-sm text-[#718177]">No reminders yet. Add one before your next course-feedback deadline.</p>}</section>
        <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl bg-[#214f37] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-[#c5dfcb]">One simple process</p><h2 className="mt-3 text-2xl font-extrabold">Your feedback helps make the next class better.</h2><p className="mt-3 text-sm leading-6 text-[#d6e7d9]">Rate teaching clarity, class pace, and learning resources. Review the response summary in one place.</p><button type="button" onClick={()=>setTab('feedback')} className="mt-6 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#214f37]">Start feedback <ArrowRight size={15} className="inline"/></button></div><div className="rounded-2xl border border-[#e4ece5] bg-white p-6"><div className="flex items-center gap-2 text-[#477956]"><CheckCircle2 size={19}/><b className="text-sm">Separate from your account</b></div><h3 className="mt-3 text-lg font-extrabold">Anonymous by design</h3><p className="mt-2 text-sm leading-6 text-[#718177]">The feedback form does not ask for your name, username, or roll number. Keep comments general and do not include personal details.</p></div></section>
      </>:tab==='feedback'?<section className="grid gap-6 lg:grid-cols-[1fr_.72fr]">
        <form onSubmit={submit} className="rounded-2xl border border-[#e4ece5] bg-white p-5 sm:p-8"><div className="mb-7"><p className="text-xs font-bold uppercase tracking-widest text-[#477956]">Anonymous course review</p><h2 className="mt-2 text-2xl font-extrabold">Tell us how the course is going.</h2></div>
          <label className="block text-sm font-semibold">Choose a course<select value={courseId} onChange={e=>setCourseId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6de] bg-white px-4 text-sm">{COURSES.map(c=><option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></label>
          <div className="mt-7 space-y-6"><StarRating label="Overall course experience" value={overall} onChange={setOverall}/><StarRating label="Teaching clarity" value={clarity} onChange={setClarity}/><StarRating label="Class pace and organization" value={pace} onChange={setPace}/><StarRating label="Learning resources" value={resources} onChange={setResources}/></div>
          <label className="mt-7 block text-sm font-semibold">Optional comment<textarea value={comment} onChange={e=>setComment(e.target.value)} maxLength={1000} rows={4} placeholder="What is working well, or what could be improved?" className="mt-2 w-full rounded-xl border border-[#dce6de] px-4 py-3 text-sm"/></label>
          {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#839087]">Feedback does not include your name or username.</p><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white">Submit feedback <ArrowRight size={16}/></button></div>
        </form>
        <aside className="rounded-2xl border border-[#e4ece5] bg-[#edf5ef] p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-widest text-[#477956]">Selected course</p><h3 className="mt-3 text-xl font-extrabold">{selected.title}</h3><p className="mt-1 text-sm text-[#607267]">{selected.code} · {selected.semester}</p><p className="mt-6 text-sm leading-6 text-[#53685a]">Feedback is most useful when it is specific and respectful. Focus on teaching clarity, course structure, pace, and learning resources.</p><button type="button" onClick={()=>{setReminderCourseId(courseId);setTab('reminders');}} className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d3e3d6] bg-white px-4 py-2 text-sm font-bold text-[#286640]"><Bell size={15}/>Set a feedback reminder</button><div className="mt-6 border-t border-[#d7e5d9] pt-5"><h4 className="text-sm font-extrabold">Rating guide</h4><ul className="mt-3 space-y-2 text-sm text-[#607267]"><li>5 Excellent</li><li>4 Good</li><li>3 Average</li><li>2 Needs improvement</li><li>1 Poor</li></ul></div></aside>
      </section>:tab==='reminders'?<section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <form onSubmit={addReminder} className="rounded-2xl border border-[#e4ece5] bg-white p-5 sm:p-7"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#477956]">Stay on schedule</p><h2 className="mt-2 text-xl font-extrabold">Create a feedback reminder</h2><p className="mt-2 text-sm leading-6 text-[#718177]">Choose a course and due date. Reminders are saved only in this browser.</p></div>
          <label className="block text-sm font-semibold">Course<select value={reminderCourseId} onChange={e=>setReminderCourseId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6de] bg-white px-4 text-sm">{COURSES.map(c=><option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></label>
          <label className="mt-5 block text-sm font-semibold">Reminder title <span className="font-normal text-[#87948c]">(optional)</span><input value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} maxLength={90} placeholder="Submit course feedback" className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6de] bg-white px-4 text-sm"/></label>
          <label className="mt-5 block text-sm font-semibold">Due date and time<input type="datetime-local" required value={reminderDueAt} onChange={e=>setReminderDueAt(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6de] bg-white px-4 text-sm"/></label>
          {reminderError&&<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{reminderError}</p>}
          <button type="submit" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#245b3e] px-5 py-3 text-sm font-bold text-white"><Bell size={16}/>Save reminder</button>
          <p className="mt-3 text-xs leading-5 text-[#87948c]">This is an in-dashboard reminder list. It does not send email or phone notifications.</p>
        </form>
        <div className="rounded-2xl border border-[#e4ece5] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#477956]">Your schedule</p><h2 className="mt-2 text-xl font-extrabold">Feedback reminders</h2></div><span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-bold text-[#477956]">{upcomingReminders.length} pending</span></div>
          {sortedReminders.length?<div className="mt-5 divide-y divide-[#edf1ed]">{sortedReminders.map(reminder=>{const course=COURSES.find(c=>c.id===reminder.courseId);const overdue=!reminder.completed&&Date.parse(reminder.dueAt)<Date.now();return <article key={reminder.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff5f0] text-[#477956]"><CalendarDays size={18}/></span><div className="min-w-0 flex-1"><p className={'text-sm font-bold '+(reminder.completed?'line-through opacity-60':'')}>{reminder.title}</p><p className="mt-1 text-xs text-[#718177]">{course?.code??'Course'} · {new Date(reminder.dueAt).toLocaleString()}</p><span className={'mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold '+(reminder.completed?'bg-[#edf2ee] text-[#718177]':overdue?'bg-amber-50 text-amber-800':'bg-[#edf5ef] text-[#477956]')}>{reminder.completed?'Completed':overdue?'Overdue':'Upcoming'}</span></div><div className="flex items-center gap-2"><button type="button" onClick={()=>setReminders(current=>current.map(item=>item.id===reminder.id?{...item,completed:!item.completed}:item))} aria-label={reminder.completed?'Mark reminder pending':'Mark reminder completed'} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dce6de] px-3 py-2 text-xs font-bold text-[#286640]">{reminder.completed?<RotateCcw size={14}/>:<Check size={14}/>}<span className="hidden sm:inline">{reminder.completed?'Reopen':'Done'}</span></button><button type="button" onClick={()=>setReminders(current=>current.filter(item=>item.id!==reminder.id))} aria-label="Delete reminder" className="grid h-9 w-9 place-items-center rounded-lg border border-[#eadfdf] text-[#9b5757] hover:bg-red-50"><Trash2 size={15}/></button></div></article>;})}</div>:<div className="mt-5 rounded-xl bg-[#f5f8f5] px-5 py-12 text-center"><Bell size={24} className="mx-auto text-[#8aa493]"/><p className="mt-3 font-bold">No reminders yet</p><p className="mt-1 text-sm text-[#718177]">Create a reminder for your next course review.</p></div>}
        </div>
      </section>:<section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Course feedback summary</h2><p className="mt-1 text-sm text-[#718177]">Only responses stored in this browser are included.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportCsv} disabled={!responses.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dce6de] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"><Download size={15}/>Export CSV</button><button type="button" onClick={clearData} disabled={!responses.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#eadfdf] bg-white px-4 py-2 text-sm font-semibold text-[#8b4b4b] disabled:opacity-40"><RotateCcw size={15}/>Clear demo data</button></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-[#e4ece5] bg-white p-6"><p className="text-sm font-semibold text-[#6b7d71]">Total responses</p><p className="mt-3 text-3xl font-extrabold">{responses.length}</p></article><article className="rounded-2xl border border-[#e4ece5] bg-white p-6"><p className="text-sm font-semibold text-[#6b7d71]">Overall average</p><p className="mt-3 text-3xl font-extrabold">{totalAverage===null?'Not rated':totalAverage.toFixed(1)+' / 5'}</p></article></div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e4ece5] bg-white"><div className="border-b border-[#edf1ed] px-5 py-4"><h3 className="font-extrabold">Results by course</h3></div>{summary.map(course=><div key={course.id} className="grid gap-3 border-b border-[#edf1ed] px-5 py-5 last:border-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><p className="font-bold">{course.title}</p><p className="mt-1 text-xs text-[#829087]">{course.code} · {course.count} responses</p></div><div><div className="mb-2 flex justify-between text-xs text-[#718177]"><span>Average rating</span><span>{course.rating===null?'No ratings':course.rating.toFixed(1)+'/5'}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf2ee]"><div className="h-full rounded-full bg-[#5b9369]" style={{width:((course.rating??0)/5*100)+'%'}}/></div></div><button type="button" onClick={()=>{setCourseId(course.id);setTab('feedback');setNotice('');}} className="text-sm font-bold text-[#286640]">Add feedback <ArrowRight size={14} className="inline"/></button></div>)}</div>
        <div className="mt-5 rounded-2xl border border-[#e4ece5] bg-white p-5"><h3 className="font-extrabold">Recent submissions</h3>{responses.length?<div className="mt-4 divide-y divide-[#edf1ed]">{responses.slice(0,6).map(r=>{const course=COURSES.find(c=>c.id===r.courseId);return <div key={r.id} className="flex justify-between gap-3 py-3 text-sm"><span>{course?.title??'Course'} <span className="text-xs text-[#829087]">· {new Date(r.createdAt).toLocaleDateString()}</span></span><b>{r.overall}/5</b></div>;})}</div>:<p className="py-8 text-center text-sm text-[#829087]">No feedback submitted yet.</p>}</div>
      </section>}
      <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-[#e1e9e2] pt-5 text-xs text-[#526158]"><span>CoursePulse · College course feedback project</span><span>Local demo data only</span></footer>
    </div>
  </main>;
}
