'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Clock3, Trash2 } from 'lucide-react';
import { formatLocalDateTimeInput, isFeedbackReminder, isFeedbackReminderDue, isFutureReminderDateTime, shouldNotifyFeedbackReminder, type FeedbackReminder } from '@/lib/feedback-reminders';

type Course={id:string;title:string;course_code?:string|null};
const REMINDER_KEY='coursepulse-feedback-reminders-v1';

export function StudentReminders({courses}:{courses:Course[]}) {
  const [reminders,setReminders]=useState<FeedbackReminder[]>([]);
  const [courseId,setCourseId]=useState(courses[0]?.id??'');
  const [remindAt,setRemindAt]=useState('');
  const [permission,setPermission]=useState<'default'|'granted'|'denied'|'unsupported'>('default');
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [clock,setClock]=useState(Date.now());
  const courseIds=useMemo(()=>courses.map(c=>c.id),[courses]);
  useEffect(()=>{
    try {
      const raw=window.localStorage.getItem(REMINDER_KEY);
      if(raw){const value:unknown=JSON.parse(raw);if(Array.isArray(value))setReminders(value.filter(item=>isFeedbackReminder(item,courseIds)).slice(0,100));}
    } catch {setError('Saved reminders could not be read from this browser.');}
    setPermission('Notification' in window?Notification.permission:'unsupported');
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(9,0,0,0);
    setReminderAt(formatLocalDateTimeInput(tomorrow));
    const timer=window.setInterval(()=>setClock(Date.now()),15000);
    return()=>window.clearInterval(timer);
  },[courseIds]);
  useEffect(()=>{try{window.localStorage.setItem(REMINDER_KEY,JSON.stringify(reminders));}catch{setError('The browser could not save your reminders.');}},[reminders]);
  const due=reminders.filter(r=>isFeedbackReminderDue(r,clock));
  const upcoming=reminders.filter(r=>!r.completedAt&&!isFeedbackReminderDue(r,clock)).sort((a,b)=>a.remindAt.localeCompare(b.remindAt));
  const completed=reminders.filter(r=>r.completedAt).sort((a,b)=>(b.completedAt??'').localeCompare(a.completedAt??''));
  useEffect(()=>{
    if(permission!=='granted'||!('Notification' in window))return;
    const pending=reminders.filter(r=>shouldNotifyFeedbackReminder(r,clock));
    if(!pending.length)return;
    try{
      new Notification(pending.length===1?'Course feedback reminder':'Course feedback reminders',{
        body:pending.map(r=>courses.find(c=>c.id===r.courseId)?.title??'Your course').slice(0,2).join(', '),
        icon:'/icon.svg',tag:'coursepulse-authenticated-reminders'
      });
      setReminders(current=>current.map(r=>pending.some(p=>p.id===r.id)?{...r,notifiedAt:new Date(clock).toISOString()}:r));
    }catch{/* In-app due list remains available. */}
  },[permission,reminders,clock,courses]);
  function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setNotice('');
    if(!courseIds.includes(courseId)){setError('Choose one of your courses.');return;}
    if(!isFutureReminderDateTime(remindAt)){setError('Choose a reminder time in the future.');return;}
    const item:FeedbackReminder={id:crypto.randomUUID(),courseId,remindAt:new Date(remindAt).toISOString(),createdAt:new Date().toISOString(),completedAt:null,notifiedAt:null};
    setReminders(current=>[item,...current].slice(0,100));setNotice('Reminder saved in this browser.');
  }
  async function enableNotifications(){
    if(!('Notification' in window)){setPermission('unsupported');return;}
    const next=await Notification.requestPermission();setPermission(next);
    setNotice(next==='granted'?'Browser notifications enabled. Keep CoursePulse open for reminders.':'Browser notifications were not enabled; in-app reminders remain available.');
  }
  function complete(id:string){const at=new Date().toISOString();setReminders(current=>current.map(r=>r.id===id?{...r,completedAt:at,notifiedAt:null}:r));}
  function snooze(id:string){setReminders(current=>current.map(r=>{if(r.id!==id)return r;const d=new Date(Math.max(Date.parse(r.remindAt),Date.now()));d.setHours(d.getHours()+24);return {...r,remindAt:d.toISOString(),notifiedAt:null};}));}
  function remove(id:string){setReminders(current=>current.filter(r=>r.id!==id));}
  const label=(r:FeedbackReminder)=>courses.find(c=>c.id===r.courseId)?.title??'Course unavailable';
  return <section className="space-y-5">
    <div className="section-heading"><div><h3>Feedback reminders</h3><p>Set a personal reminder for a course feedback session. Reminders are stored in this browser, separately from submissions.</p></div><BellRing size={24}/></div>
    {error&&<p role="alert" className="alert error">{error}</p>}{notice&&<p role="status" className="alert success">{notice}</p>}
    <form onSubmit={add} className="grid gap-3 rounded-2xl border border-[#e5ece6] bg-white p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="text-sm font-semibold">Course<select className="mt-2 w-full rounded-xl border border-[#dce6de] bg-white p-3 font-normal" value={courseId} onChange={e=>setCourseId(e.target.value)} required>{courses.map(c=><option key={c.id} value={c.id}>{c.course_code?c.course_code+' · ':''}{c.title}</option>)}</select></label>
      <label className="text-sm font-semibold">Reminder date & time<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="datetime-local" value={remindAt} onChange={e=>setRemindAt(e.target.value)} required/></label>
      <button className="button primary" disabled={!courses.length}><BellRing size={15}/> Add reminder</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5ece6] bg-white p-4"><div><b>Desktop notifications</b><p className="fine-print">Browser alerts require permission and CoursePulse to remain open.</p></div><button className="button subtle compact" type="button" onClick={()=>void enableNotifications()} disabled={permission==='granted'||permission==='unsupported'}>{permission==='granted'?'Enabled':permission==='denied'?'Blocked':'Enable alerts'}</button></div>
    {[{title:'Due now',items:due},{title:'Upcoming',items:upcoming},{title:'Completed',items:completed}].map(group=><section key={group.title} className="rounded-2xl border border-[#e5ece6] bg-white p-5"><h4 className="mb-3 font-semibold">{group.title} <span className="role-chip">{group.items.length}</span></h4>{group.items.length===0?<p className="muted">No reminders in this section.</p>:<div className="space-y-2">{group.items.map(r=><article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edf1ed] p-3"><div><b>{label(r)}</b><small className="block text-[#708176]">{new Date(r.remindAt).toLocaleString()}</small></div><div className="flex flex-wrap gap-2">{!r.completedAt&&<>{!isFeedbackReminderDue(r,clock)&&<button className="button subtle compact" onClick={()=>snooze(r.id)} type="button">Snooze 24h</button>}<button className="button subtle compact" onClick={()=>complete(r.id)} type="button"><Check size={14}/> Done</button></>}<button className="icon-button" aria-label="Delete reminder" onClick={()=>remove(r.id)} type="button"><Trash2 size={15}/></button></div></article>)}</div>}</section>)}
  </section>;
}
