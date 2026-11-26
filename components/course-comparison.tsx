'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, GitCompareArrows } from 'lucide-react';

type Course={id:string;title:string;course_code?:string|null;semester_id?:string|null;semester?:{id:string;name:string}|null};
type Comparison={question_id:string;question_label:string;question_category:string|null;values:Record<string,{average:number|null;response_count:number}>};
type CourseResult=Course&{instructor_name:string;response_count:number;average_rating:number|null};

export function CourseComparison({courses}:{courses:Course[]}) {
  const [selected,setSelected]=useState<string[]>(courses.slice(0,Math.min(courses.length,3)).map(c=>c.id));
  const [fromDate,setFromDate]=useState('');const [toDate,setToDate]=useState('');const [semesterId,setSemesterId]=useState('');
  useEffect(()=>{if(selected.length===0&&courses.length>1)setSelected(courses.slice(0,Math.min(courses.length,3)).map(c=>c.id));},[courses,selected.length]);
  const [results,setResults]=useState<CourseResult[]>([]);const [comparisons,setComparisons]=useState<Comparison[]>([]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const selectedCourses=useMemo(()=>courses.filter(c=>selected.includes(c.id)),[courses,selected]);
  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length>=8?current:[...current,id]);}
  async function compare(){
    setBusy(true);setError('');
    try{
      const params=new URLSearchParams({course_ids:selected.join(',')});
      if(fromDate)params.set('from_date',fromDate);if(toDate)params.set('to_date',toDate);if(semesterId)params.set('semester_id',semesterId);
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
      <div className="grid gap-3 md:grid-cols-4 md:items-end"><label className="text-sm font-semibold">Semester filter<select className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={semesterId} onChange={e=>setSemesterId(e.target.value)}><option value="">All semesters</option>{Array.from(new Map(courses.filter(c=>c.semester_id&&c.semester).map(c=>[c.semester_id!,{id:c.semester_id!,name:c.semester!.name}])).values()).map(semester=><option key={semester.id} value={semester.id}>{semester.name}</option>)}</select></label><label className="text-sm font-semibold">From date<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="date" value={fromDate} max={toDate||undefined} onChange={e=>setFromDate(e.target.value)}/></label><label className="text-sm font-semibold">To date<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" type="date" value={toDate} min={fromDate||undefined} onChange={e=>setToDate(e.target.value)}/></label><button type="button" className="button primary" disabled={busy||selected.length<2} onClick={()=>void compare()}><BarChart3 size={15}/>{busy?'Comparing…':'Compare selected courses'}</button></div>
      <p className="fine-print">{selected.length} selected · choose between 2 and 8 courses.</p>
    </div>
    {error&&<p role="alert" className="alert error">{error}</p>}
    {loaded&&<div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{results.map(course=><article key={course.id} className="rounded-2xl border border-[#e5ece6] bg-white p-4"><span className="eyebrow">{course.course_code??'COURSE'}</span><h4 className="mt-1 font-semibold">{course.title}</h4><p className="muted">{course.instructor_name}</p><div className="mt-4 grid grid-cols-2 gap-3"><div><strong className="block text-2xl text-[#285f43]">{course.response_count}</strong><small className="muted">Responses</small></div><div><strong className="block text-2xl text-[#285f43]">{course.average_rating==null?'—':course.average_rating.toFixed(2)+'/5'}</strong><small className="muted">Average rating</small></div></div></article>)}</div>
      {comparisons.length===0?<div className="rounded-2xl border border-[#e5ece6] bg-white p-5"><p className="muted">No matching rating criteria meet the report threshold for these courses.</p></div>:<>
        <div className="rounded-2xl border border-[#e5ece6] bg-white p-5"><h4 className="font-semibold">Comparison table · rating criteria</h4><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead><tr className="border-b border-[#e5ece6] text-xs uppercase text-[#718178]"><th className="p-3">Criterion</th>{results.map(course=><th key={course.id} className="p-3">{course.course_code??course.title}<small className="block normal-case font-normal">{course.instructor_name}</small></th>)}</tr></thead><tbody>{comparisons.map(question=><tr key={question.question_id} className="border-b border-[#edf1ed] last:border-0"><th className="p-3 font-semibold">{question.question_label}<small className="block font-normal text-[#718178]">{question.question_category??'Course criterion'}</small></th>{results.map(course=>{const value=question.values[course.id];return <td key={course.id} className="p-3"><b>{value?.average==null?'—':value.average.toFixed(2)+'/5'}</b><small className="block text-[#718178]">{value?.response_count??0} reportable answers</small></td>;})}</tr>)}</tbody></table></div></div>
        <div className="rounded-2xl border border-[#e5ece6] bg-white p-5"><h4 className="font-semibold">Grouped rating comparison</h4><div className="mt-4 space-y-5">{comparisons.map(question=><div key={question.question_id}><div className="mb-2"><b>{question.question_label}</b><small className="block text-[#708176]">{question.question_category??'Course criterion'}</small></div><div className="space-y-2">{results.map(course=>{const value=question.values[course.id];const average=value?.average??null;return <div key={course.id} className="grid grid-cols-[minmax(90px,180px)_1fr_65px] items-center gap-3 text-xs"><span className="truncate text-[#617368]">{course.course_code??course.title}</span><div className="h-3 overflow-hidden rounded-full bg-[#edf2ee]"><div className="h-full rounded-full bg-[#397b56]" style={{width:(average===null?0:average/5*100)+'%'}}/></div><b className="text-right">{average===null?'—':average.toFixed(2)+'/5'}</b></div>})}</div></div>)}</div></div>
        <div className="rounded-2xl border border-[#e5ece6] bg-white p-5"><h4 className="font-semibold">Rating radar comparison</h4><p className="muted">First eight shared rating criteria. Each course is plotted on the same 1–5 scale.</p><svg viewBox="0 0 520 390" role="img" aria-label="Radar chart comparing course rating averages" className="mx-auto mt-3 block w-full max-w-[560px]">{[1,2,3,4,5].map(level=><polygon key={level} points={comparisons.slice(0,8).map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/Math.min(comparisons.length,8);const r=level*26;return (260+Math.cos(a)*r)+','+(185+Math.sin(a)*r);}).join(' ')} fill="none" stroke="#e2ebe4" strokeWidth="1"/>)}{results.map((course,index)=>{const colors=['#2e714e','#c28b36','#6686a6','#a16c85','#7b8e54','#6c6c9e','#b36e47','#4d8d8a'];const points=comparisons.slice(0,8).map((q,i)=>{const v=q.values[course.id]?.average??0;const a=-Math.PI/2+i*2*Math.PI/Math.min(comparisons.length,8);const r=v*26;return (260+Math.cos(a)*r)+','+(185+Math.sin(a)*r);}).join(' ');return <polygon key={course.id} points={points} fill={colors[index%colors.length]} fillOpacity=".09" stroke={colors[index%colors.length]} strokeWidth="2"/>;})}{comparisons.slice(0,8).map((q,i)=>{const a=-Math.PI/2+i*2*Math.PI/Math.min(comparisons.length,8);return <text key={q.question_id} x={260+Math.cos(a)*153} y={185+Math.sin(a)*153} fontSize="9" fill="#5c7063" textAnchor={Math.cos(a)>.25?'start':Math.cos(a)<-.25?'end':'middle'} dominantBaseline="middle">{q.question_label.slice(0,24)}</text>;})}</svg><div className="flex flex-wrap gap-3">{results.map((course,index)=><span key={course.id} className="text-xs text-[#64766b]"><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{background:['#2e714e','#c28b36','#6686a6','#a16c85'][index%4]}}/>{course.course_code??course.title}</span>)}</div></div>
      </>}
    </div>}
  </section>;
}
