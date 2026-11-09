'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CalendarDays, Download, FileBarChart, Lightbulb, Mail, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { HeadAiInsights } from '@/components/head-ai-insights';

type Course = { id:string; title:string; department_id?:string|null; instructor_id:string; status:string };
type User = { id:string; full_name:string; email:string|null; role:'ADMIN'|'INSTRUCTOR'|'STUDENT'; is_active:boolean };
type Department = { id:string; name:string; code:string };
type AnalyticsRow = {
  course_id:string;
  course_title:string;
  feedback_id:string;
  feedback_title:string;
  question_id:string;
  question_label:string;
  question_type:string;
  response_count:number;
  avg_numeric_value:number|string|null;
  question_category?:string|null;
};
type Props = { courses:Course[]; users:User[]; departments:Department[] };
type CourseMetric = { id:string; title:string; departmentId:string|null; instructorId:string; average:number; responses:number; forms:number };
type TeacherMetric = { id:string; name:string; email:string|null; average:number; responses:number; courses:number };
type MonthlyReport = { report_month:string; scope_type:'COLLEGE'|'DEPARTMENT'|'COURSE'; scope_id:string; scope_label:string; response_count:number; average_rating:number; previous_average:number|null; rating_change:number|null; recommendation:string; generated_at:string };

function dateRange(month:string) {
  const [year,monthNumber]=month.split('-').map(Number);
  if(!year||!monthNumber||monthNumber<1||monthNumber>12) return null;
  const lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const mm=String(monthNumber).padStart(2,'0');
  return {fromDate:`${year}-${mm}-01`,toDate:`${year}-${mm}-${String(lastDay).padStart(2,'0')}`};
}

/** Head-only reporting surface built exclusively from privacy-suppressed aggregate RPC results. */
export function HeadIntelligence({courses,users,departments}:Props) {
  const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const [departmentId,setDepartmentId]=useState('');
  const [courseId,setCourseId]=useState('');
  const [threshold,setThreshold]=useState('3');
  const [minimumResponses,setMinimumResponses]=useState('10');
  const [rows,setRows]=useState<AnalyticsRow[]>([]);
  const [reportReady,setReportReady]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [archiveMonth,setArchiveMonth]=useState(()=>{
    const date=new Date();
    date.setUTCMonth(date.getUTCMonth()-1);
    return date.toISOString().slice(0,7);
  });
  const [archiveReports,setArchiveReports]=useState<MonthlyReport[]>([]);
  const [archiveLoading,setArchiveLoading]=useState(false);
  const [archiveError,setArchiveError]=useState('');

  const visibleCourses=useMemo(()=>courses.filter(course=>
    (!departmentId||course.department_id===departmentId)&&(!courseId||course.id===courseId)
  ),[courses,departmentId,courseId]);

  async function loadArchive() {
    setArchiveLoading(true);
    setArchiveError('');
    try {
      const response=await fetch('/api/admin/monthly-reports?month='+encodeURIComponent(archiveMonth),{cache:'no-store'});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error??'Scheduled monthly reports could not be loaded.');
      setArchiveReports(payload.reports??[]);
    } catch(caught) {
      setArchiveError(caught instanceof Error?caught.message:'Scheduled monthly reports could not be loaded.');
    } finally {
      setArchiveLoading(false);
    }
  }

  useEffect(()=>{void loadArchive();},[archiveMonth]);

  useEffect(()=>{
    let active=true;
    void fetch('/api/admin/teacher-notifications',{cache:'no-store'})
      .then(async response=>{
        const payload=await response.json();
        if(!response.ok) throw new Error(payload.error??'Saved review settings could not be loaded.');
        if(active){
          setThreshold(String(payload.settings?.rating_threshold??3));
          setMinimumResponses(String(payload.settings?.minimum_responses??10));
        }
      })
      .catch(caught=>{
        if(active) setError(caught instanceof Error?caught.message:'Saved review settings could not be loaded.');
      });
    return ()=>{active=false;};
  },[]);

  const courseMetrics=useMemo<CourseMetric[]>(()=>{
    const forms=new Map<string,{course_id:string;feedback_id:string;scoreTotal:number;questionCount:number;responses:number}>();
    for(const row of rows){
      if(row.question_type!=='rating'||row.avg_numeric_value===null||row.avg_numeric_value===undefined) continue;
      const score=Number(row.avg_numeric_value);
      const responseCount=Number(row.response_count||0);
      if(!Number.isFinite(score)||!Number.isFinite(responseCount)||responseCount<5) continue;
      const key=[row.course_id,row.feedback_id].join(':');
      const current=forms.get(key)??{course_id:row.course_id,feedback_id:row.feedback_id,scoreTotal:0,questionCount:0,responses:0};
      current.scoreTotal+=score;
      current.questionCount+=1;
      current.responses=Math.max(current.responses,responseCount);
      forms.set(key,current);
    }
    const byCourse=new Map<string,{weightedRating:number;responses:number;forms:number}>();
    for(const form of forms.values()){
      if(!form.responses||!form.questionCount) continue;
      const formAverage=form.scoreTotal/form.questionCount;
      const current=byCourse.get(form.course_id)??{weightedRating:0,responses:0,forms:0};
      current.weightedRating+=formAverage*form.responses;
      current.responses+=form.responses;
      current.forms+=1;
      byCourse.set(form.course_id,current);
    }
    return courses.filter(course=>(!departmentId||course.department_id===departmentId)&&(!courseId||course.id===courseId))
      .map(course=>{
        const metric=byCourse.get(course.id);
        return metric?{id:course.id,title:course.title,departmentId:course.department_id??null,instructorId:course.instructor_id,average:metric.weightedRating/metric.responses,responses:metric.responses,forms:metric.forms}:null;
      }).filter((metric):metric is CourseMetric=>metric!==null);
  },[rows,courses,departmentId,courseId]);

  const teacherMetrics=useMemo<TeacherMetric[]>(()=>{
    const instructors=users.filter(user=>user.role==='INSTRUCTOR'&&user.is_active);
    return instructors.map(instructor=>{
      const assigned=courseMetrics.filter(course=>course.instructorId===instructor.id);
      const responses=assigned.reduce((sum,course)=>sum+course.responses,0);
      const weighted=assigned.reduce((sum,course)=>sum+course.average*course.responses,0);
      return {id:instructor.id,name:instructor.full_name||'Unnamed teacher',email:instructor.email,average:responses?weighted/responses:0,responses,courses:assigned.length};
    }).filter(teacher=>teacher.courses>0).sort((a,b)=>a.average-b.average);
  },[users,courseMetrics]);

  const flaggedTeachers=useMemo(()=>teacherMetrics.filter(teacher=>teacher.responses>=Number(minimumResponses)&&teacher.average<Number(threshold)),[teacherMetrics,threshold,minimumResponses]);
  const overall=useMemo(()=>{
    const total=courseMetrics.reduce((sum,course)=>sum+course.responses,0);
    const weighted=courseMetrics.reduce((sum,course)=>sum+course.average*course.responses,0);
    return {average:total?weighted/total:null,responses:total,courses:courseMetrics.length};
  },[courseMetrics]);

  async function generateReport(){
    setError('');setNotice('');
    const range=dateRange(month);
    if(!range){setError('Choose a valid reporting month.');return;}
    setLoading(true);
    try{
      const params=new URLSearchParams({from_date:range.fromDate,to_date:range.toDate});
      if(departmentId) params.set('department_id',departmentId);
      if(courseId) params.set('course_id',courseId);
      const response=await fetch('/api/analytics?'+params.toString(),{cache:'no-store'});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error??'Monthly report could not be generated.');
      if(payload.raw_answers_included!==false) throw new Error('The reporting response did not confirm aggregate-only output.');
      setRows(payload.rows??[]);
      setReportReady(true);
      let notificationMessage = '';
      if (!departmentId && !courseId) {
        const notifyResponse = await fetch('/api/admin/teacher-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_date: range.fromDate,
            to_date: range.toDate,
            threshold: Number(threshold),
            minimum_responses: Number(minimumResponses)
          })
        });
        const notifyPayload = await notifyResponse.json();
        if (!notifyResponse.ok) throw new Error(notifyPayload.error ?? 'Report generated, but private teacher notifications could not be processed.');
        notificationMessage = notifyPayload.created > 0
          ? ` ${notifyPayload.created} private teacher meeting request(s) sent.`
          : notifyPayload.eligible_teachers > 0
            ? ' Eligible teachers were already notified for this month.'
            : ' No teacher met the review threshold and response minimum.';
      }
      setNotice('Monthly report generated. Review settings saved for the scheduled monthly run.' + notificationMessage);
    }catch(caught){
      setError(caught instanceof Error?caught.message:'Monthly report could not be generated.');
    }finally{setLoading(false);}
  }

  const exportQuery=()=>{
    const range=dateRange(month);
    if(!range)return '';
    const params=new URLSearchParams({from_date:range.fromDate,to_date:range.toDate});
    if(departmentId)params.set('department_id',departmentId);
    if(courseId)params.set('course_id',courseId);
    return params.toString();
  };
  const selectedDepartment=departments.find(department=>department.id===departmentId);

  return <section className="admin-panel space-y-5" aria-labelledby="head-intelligence-title">
    <div className="admin-panel-heading">
      <div>
        <span className="eyebrow">HEAD DASHBOARD ONLY</span>
        <h2 id="head-intelligence-title">Monthly academic intelligence</h2>
        <p>Course and teacher performance from privacy-suppressed ratings. Raw answers and student identities are never loaded.</p>
      </div>
      <span className="role-chip"><ShieldCheck size={14}/> Confidential</span>
    </div>

    <article className="rounded-2xl border border-[#e5ece6] bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold">Scheduled monthly archive</h3><p className="fine-print mt-1">Generated automatically on day 1 for the previous month at 00:15 UTC. Only course, department and college rating aggregates with at least five responses are stored.</p></div>
        <span className="role-chip"><ShieldCheck size={13}/> Head only</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-[#43584d]">Archived month<input type="month" className="mt-2 block rounded-lg border border-[#dce6df] bg-white p-2.5" value={archiveMonth} onChange={event=>setArchiveMonth(event.target.value)}/></label>
        <button className="button subtle compact" onClick={()=>void loadArchive()} disabled={archiveLoading}><RefreshCw size={14}/> Refresh archive</button>
        <span className="fine-print">{archiveReports.length} report group(s)</span>
      </div>
      {archiveError&&<p className="alert error" role="alert">{archiveError}</p>}
      {archiveLoading?<p className="fine-print">Loading scheduled archive…</p>:archiveReports.length===0?<p className="rounded-xl border border-dashed border-[#dce7df] p-4 text-sm text-[#748279]">No scheduled snapshot exists for this month yet. The archive is populated on the first day of the following month.</p>:<div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>Scope</th><th>Average</th><th>Rating answers</th><th>Change vs previous month</th><th>Recommendation</th></tr></thead><tbody>{archiveReports.map(item=><tr key={item.scope_type+'-'+item.scope_id}><td><b>{item.scope_type}</b><small>{item.scope_label}</small></td><td>{Number(item.average_rating).toFixed(2)} / 5</td><td>{item.response_count}</td><td>{item.rating_change===null?'—':(Number(item.rating_change)>0?'+':'')+Number(item.rating_change).toFixed(2)}</td><td>{item.recommendation}</td></tr>)}</tbody></table></div>}
      <p className="fine-print">Stored snapshots contain no student identifiers, raw answers or comments. They are aggregate rating answers, not unique-student counts. Insights are rules-based, not generative AI.</p>
    </article>
    <HeadAiInsights month={archiveMonth}/>
    
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="admin-metric"><span><FileBarChart size={18}/></span><small>Reportable average</small><b>{reportReady&&overall.average!==null?`${overall.average.toFixed(2)} / 5`:'—'}</b></article>
      <article className="admin-metric"><span><BookOpen size={18}/></span><small>Courses covered</small><b>{reportReady?overall.courses:'—'}</b></article>
      <article className="admin-metric"><span><Users size={18}/></span><small>Reportable responses</small><b>{reportReady?overall.responses:'—'}</b></article>
      <article className="admin-metric"><span><AlertTriangle size={18}/></span><small>Teachers to review</small><b>{reportReady?flaggedTeachers.length:'—'}</b></article>
    </div>

    <div className="grid gap-4 rounded-2xl border border-[#e5ece6] bg-[#fbfdfb] p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-semibold text-[#43584d]">Reporting month<input className="mt-2 w-full rounded-lg border border-[#dce6df] bg-white p-2.5" type="month" value={month} onChange={event=>{setMonth(event.target.value);setReportReady(false);}}/></label>
      <label className="text-xs font-semibold text-[#43584d]">Department<select className="mt-2 w-full rounded-lg border border-[#dce6df] bg-white p-2.5" value={departmentId} onChange={event=>{setDepartmentId(event.target.value);setCourseId('');setReportReady(false);}}><option value="">All departments</option>{departments.map(item=><option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
      <label className="text-xs font-semibold text-[#43584d]">Course<select className="mt-2 w-full rounded-lg border border-[#dce6df] bg-white p-2.5" value={courseId} onChange={event=>{setCourseId(event.target.value);setReportReady(false);}}><option value="">All courses</option>{visibleCourses.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="text-xs font-semibold text-[#43584d]">Flag teachers below<select className="mt-2 w-full rounded-lg border border-[#dce6df] bg-white p-2.5" value={threshold} onChange={event=>setThreshold(event.target.value)}><option value="2.5">2.5 / 5</option><option value="3">3.0 / 5</option><option value="3.5">3.5 / 5</option><option value="4">4.0 / 5</option></select></label>
      <label className="text-xs font-semibold text-[#43584d]">Minimum review responses<select className="mt-2 w-full rounded-lg border border-[#dce6df] bg-white p-2.5" value={minimumResponses} onChange={event=>setMinimumResponses(event.target.value)}><option value="5">5 responses</option><option value="10">10 responses</option><option value="15">15 responses</option><option value="20">20 responses</option><option value="30">30 responses</option></select></label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4">
        <button type="button" className="button primary" disabled={loading} onClick={()=>void generateReport()}><RefreshCw size={15}/>{loading?'Generating…':'Generate monthly report'}</button>
        {reportReady&&<a className="button subtle" href={'/api/exports/pdf?'+exportQuery()}><Download size={15}/> Download PDF</a>}
        {reportReady&&<a className="button subtle" href={'/api/exports/xlsx?'+exportQuery()}><Download size={15}/> Download Excel</a>}
        {selectedDepartment&&<span className="fine-print">Department: {selectedDepartment.name}</span>}
      </div>
    </div>

    {error&&<div className="alert error" role="alert">{error}</div>}
    {notice&&<div className="alert success" role="status">{notice}</div>}

    {!reportReady?<div className="rounded-xl border border-dashed border-[#cddbd2] p-6 text-center"><CalendarDays className="mx-auto mb-2 text-[#4c7861]" size={24}/><h3 className="font-semibold">Select a month to build its report</h3><p className="fine-print mt-1">The report includes only questions with at least five responses. Months with insufficient data are clearly marked as unavailable.</p></div>:<>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#e5ece6] bg-white p-5">
          <div className="mb-3 flex items-center gap-2"><Lightbulb size={18} className="text-[#4d7b62]"/><h3 className="font-semibold">Smart improvement insights</h3></div>
          {courseMetrics.length===0?<p className="fine-print">No rating groups meet the minimum privacy threshold for this period.</p>:<ul className="space-y-3 text-sm text-[#53645b]">
            {flaggedTeachers.length>0&&<li><b>{flaggedTeachers.length} teacher(s)</b> are below the selected review threshold with at least {minimumResponses} reportable course responses. This is a prompt for human review, not an automatic finding of poor performance.</li>}
            {flaggedTeachers.length===0&&<li>No teacher crossed the selected review threshold with the minimum response volume in this reporting period.</li>}
            {courseMetrics.slice().sort((a,b)=>a.average-b.average).slice(0,2).map(course=><li key={course.id}><b>{course.title}:</b> {course.average.toFixed(2)}/5 across reportable rating questions. Review course feedback and compare the next period.</li>)}
            <li>Free-text comments and student identity are excluded from this report. Use the institution's separately approved feedback-review process for qualitative follow-up.</li>
          </ul>}
          <p className="mt-4 rounded-lg bg-[#f1f6f2] p-3 text-xs text-[#53645b]">These are rules-based insights from aggregate metrics. A generative AI provider is not configured for this environment, so the system does not claim that an external AI model analysed the data.</p>
        </article>
        <article className="rounded-2xl border border-[#e5ece6] bg-white p-5">
          <div className="mb-3 flex items-center gap-2"><Users size={18} className="text-[#4d7b62]"/><h3 className="font-semibold">Teacher performance review</h3></div>
          {teacherMetrics.length===0?<p className="fine-print">No assigned teacher has reportable rating data for this period.</p>:<div className="space-y-3">{teacherMetrics.map(teacher=><div key={teacher.id} className="border-b border-[#edf1ee] pb-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">{teacher.name}</b><p className="fine-print">{teacher.courses} course(s) · {teacher.responses} reportable rating responses</p></div><div className="text-right"><b className="text-lg">{teacher.average.toFixed(2)}/5</b>{teacher.responses>=Number(minimumResponses)&&teacher.average<Number(threshold)&&<span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">Review suggested</span>}</div></div>
            {teacher.email&&<a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#35674f]" href={`mailto:${encodeURIComponent(teacher.email)}?subject=${encodeURIComponent('CoursePulse teaching feedback review')}&body=${encodeURIComponent(`Dear ${teacher.name},\n\nPlease meet the College Head to discuss recent course feedback and possible improvement support. The office will confirm a meeting time separately.\n\nRegards,\nCollege Administration`)}`}><Mail size={13}/> Draft a private meeting email</a>}
          </div>)}</div>}
          <p className="mt-3 text-xs text-[#748179]">Teacher averages are derived from reportable ratings on courses assigned to them. Low scores trigger a review suggestion only; they do not automatically send a message or disciplinary action.</p>
        </article>
      </div>

      <article className="rounded-2xl border border-[#e5ece6] bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-semibold">Course-wise monthly report</h3><p className="fine-print">{month} · {courseMetrics.length} course(s) with reportable ratings</p></div><span className="role-chip">Minimum group size: 5</span></div>
        {courseMetrics.length===0?<p className="fine-print">No reportable rating data for the selected filters.</p>:<div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>Course</th><th>Average rating</th><th>Responses</th><th>Forms</th></tr></thead><tbody>{courseMetrics.sort((a,b)=>a.title.localeCompare(b.title)).map(course=><tr key={course.id}><td><b>{course.title}</b></td><td>{course.average.toFixed(2)} / 5</td><td>{course.responses}</td><td>{course.forms}</td></tr>)}</tbody></table></div>}
      </article>
    </>}
  </section>;
}
