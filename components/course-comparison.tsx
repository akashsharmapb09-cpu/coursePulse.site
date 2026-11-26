'use client';

import { useMemo, useState } from 'react';
import { BarChart3, GitCompareArrows } from 'lucide-react';

type Course={id:string;title:string;course_code?:string|null;semester?:{name:string}|null};
type Comparison={question_id:string;question_label:string;question_category:string|null;values:Record<string,{average:number|null;response_count:number}>};
type CourseResult=Course&{instructor_name:string;response_count:number;average_rating:number|null};

export function CourseComparison({courses}:{courses:Course[]}) {
  const [selected,setSelected]=useState<string[]>(courses.slice(0,Math.min(courses.length,3)).map(c=>c.id));
  const [fromDate,setFromDate]=useState('');const [toDate,setToDate]=useState('');
  const [results,setResults]=useState<CourseResult[]>([]);const [comparisons,setComparisons]=useState<Comparison[]>([]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const selectedCourses=useMemo(()=>courses.filter(c=>selected.includes(c.id)),[courses,selected]);
  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length>=8?current:[...current,id]);}
  async function compare(){
    setBusy(true);setError('');
    try{
      const params=new URLSearchParams({course_ids:selected.join(',')});
      if(fromDate)params.set('from_date',fromDate);if(toDate)params.set('to_date',toDate);
      const response=await fetch('/api/analytics/compare?'+params.toString(),{cache:'no-store'});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Course comparison is unavailable.');
      setResults(body.courses??[]);setComparisons(body.comparisons??[]);setLoaded(true);
    }catch(e){setError(e instanceof Error?e.message:'Course comparison is unavailable.');}
    finally{setBusy(false);}
  }
  const max=Math.max(5,...comparisons.flatMap(q=>selected.map(id=>q.values[id]?.average??0)));
  return <section className="space-y-5">
    <div className="section-heading"><div><h3>Compare courses & instructors</h3><p>Select two or more assigned courses to compare response volume, average performance and rating criteria side by side. Each displayed question group requires at least five responses.</p></div><GitCompareArrows size={24}/></div>
    <div className="rounded-2xl border border-[#e5ece6] bg-white p-5 space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{courses.map(course=><label key={course.id} className="flex items-center gap-2 rounded-xl border border-[#e5ece6] p-3 text-sm"><input type="checkbox" checked={selected.includes(course.id)} onChange={()=>toggle(course.id)}/><span>{course.course_code?course.course_code+' · ':''}{course.title}</span></label>)}</div>
      <div className="grid gap-3 md:grid-cols-3 md:items-end"><label className="text-sm font-semibold">From date<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="date" value={fromDate} max={toDate||undefined} onChange={e=>setFromDate(e.target.value)}/></label><label className="text-sm font-semibold">To date<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="date" value={toDate} min={fromDate||undefined} onChange={e=>setToDate(e.target.value)}/></label><button type="button" className="button primary" disabled={busy||selected.length<2} onClick={()=>void compare()}><BarChart3 size={15}/>{busy?'Comparing…':'Compare selected courses'}</button></div>
      <p className="fine-print">{selected.length} selected · choose between 2 and 8 courses.</p>
    </div>
    {error&&<p role="alert" className="alert error">{error}</p>}
    {loaded&&<div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{results.map(course=><article key={course.id} className="rounded-2xl border border-[#e5ece6] bg-white p-4"><span className="eyebrow">{course.course_code??'COURSE'}</span><h4 className="mt-1 font-semibold">{course.title}</h4><p className="muted">{course.instructor_name}</p><div className="mt-4 grid grid-cols-2 gap-3"><div><strong className="block text-2xl text-[#285f43]">{course.response_count}</strong><small className="muted">Responses</small></div><div><strong className="block text-2xl text-[#285f43]">{course.average_rating==null?'—':course.average_rating.toFixed(2)+'/5'}</strong><small className="muted">Average rating</small></div></div></article>)}</div>
      {comparisons.length===0?<div className="rounded-2xl border border-[#e5ece6] bg-white p-5"><p className="muted">No matching rating criteria meet the report threshold for these courses.</p></div>:<div className="rounded-2xl border border-[#e5ece6] bg-white p-5"><h4 className="font-semibold">Criterion comparison</h4><div className="mt-4 space-y-5">{comparisons.map(question=><div key={question.question_id}><div className="mb-2"><b>{question.question_label}</b><small className="block text-[#708176]">{question.question_category??'Course criterion'}</small></div><div className="space-y-2">{results.map(course=>{const value=question.values[course.id];const average=value?.average??null;return <div key={course.id} className="grid grid-cols-[minmax(90px,180px)_1fr_65px] items-center gap-3 text-xs"><span className="truncate text-[#617368]">{course.course_code??course.title}</span><div className="h-3 overflow-hidden rounded-full bg-[#edf2ee]"><div className="h-full rounded-full bg-[#397b56]" style={{width:(average===null?0:average/5*100)+'%'}}/></div><b className="text-right">{average===null?'—':average.toFixed(2)+'/5'}</b></div>})}</div></div>)}</div></div>}
    </div>}
  </section>;
}
