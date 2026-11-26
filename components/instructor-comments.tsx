'use client';

import { useState } from 'react';
import { Search, MessageSquareText } from 'lucide-react';

type Course={id:string;title:string;course_code?:string|null};
type CommentRow={id:string;feedback_id:string;course_id:string;created_at:string;comment:string;ratings_json:Record<string,number>;course?:{title:string;course_code?:string|null}|null;feedback?:{title:string}|null};

export function InstructorComments({courses}:{courses:Course[]}) {
  const [courseId,setCourseId]=useState('');const [fromDate,setFromDate]=useState('');const [toDate,setToDate]=useState('');const [search,setSearch]=useState('');
  const [comments,setComments]=useState<CommentRow[]>([]);const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);const [error,setError]=useState('');
  async function searchComments(){
    setBusy(true);setError('');
    try{const params=new URLSearchParams();if(courseId)params.set('course_id',courseId);if(fromDate)params.set('from_date',fromDate);if(toDate)params.set('to_date',toDate);if(search.trim())params.set('q',search.trim());
      const response=await fetch('/api/comments?'+params.toString(),{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error??'Comments could not be loaded.');setComments(body.comments??[]);setLoaded(true);
    }catch(e){setError(e instanceof Error?e.message:'Comments could not be loaded.');}finally{setBusy(false);}
  }
  return <section className="mt-7 space-y-4">
    <div className="section-heading"><div><h3>Anonymous student comments</h3><p>Search feedback comments from your assigned courses. Direct identifiers are redacted and only reportable groups are available.</p></div><MessageSquareText size={22}/></div>
    <div className="grid gap-3 rounded-2xl border border-[#e5ece6] bg-white p-4 md:grid-cols-4 md:items-end">
      <label className="text-sm font-semibold">Course<select className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">All assigned courses</option>{courses.map(c=><option key={c.id} value={c.id}>{c.course_code?c.course_code+' · ':''}{c.title}</option>)}</select></label>
      <label className="text-sm font-semibold">From<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="date" value={fromDate} max={toDate||undefined} onChange={e=>setFromDate(e.target.value)}/></label>
      <label className="text-sm font-semibold">To<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="date" value={toDate} min={fromDate||undefined} onChange={e=>setToDate(e.target.value)}/></label>
      <button className="button primary" type="button" disabled={busy} onClick={()=>void searchComments()}><Search size={15}/>{busy?'Searching…':'Search comments'}</button>
      <label className="text-sm font-semibold md:col-span-4">Comment contains<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={search} onChange={e=>setSearch(e.target.value)} maxLength={100} placeholder="Search keywords…"/></label>
    </div>
    {error&&<p className="alert error">{error}</p>}
    {loaded&&<div className="space-y-3">{comments.length?comments.map(comment=><article key={comment.id} className="rounded-2xl border border-[#e5ece6] bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><div><b>{comment.course?.title??'Course'}</b><p className="text-xs text-[#708176]">{comment.feedback?.title??'Feedback form'}</p></div><time className="text-xs text-[#708176]">{new Date(comment.created_at).toLocaleDateString()}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#465c4e]">{comment.comment||'No written comment was provided.'}</p></article>):<p className="rounded-xl border border-[#e5ece6] bg-white p-5 muted">No comments matched these filters, or the response group is below the minimum of five submissions.</p>}</div>}
  </section>;
}
