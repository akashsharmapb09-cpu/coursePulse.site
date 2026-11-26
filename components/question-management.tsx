'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';

type Course = { id:string; title:string; course_code?:string|null };
type Question = {
  id:string; course_id:string|null; feedback_id:string|null; answer_key:string;
  label:string; type:'rating'|'text'|'textarea'|'number'|'single_choice'|'multiple_choice'|'multiple_select'|'yes_no';
  order_index:number; is_active:boolean; is_required:boolean; options:string[]; category:string|null;
};
const types:Question['type'][]=['rating','text','textarea','number','single_choice','multiple_choice','multiple_select','yes_no'];

export function QuestionManagement({ courses }:{courses:Course[]}) {
  const [courseId,setCourseId]=useState('global');
  const [questions,setQuestions]=useState<Question[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [label,setLabel]=useState('');
  const [type,setType]=useState<Question['type']>('rating');
  const [options,setOptions]=useState('Excellent, Good, Fair, Needs improvement');
  const [category,setCategory]=useState('Teaching Effectiveness');
  const [required,setRequired]=useState(true);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editLabel,setEditLabel]=useState('');
  const [editType,setEditType]=useState<Question['type']>('rating');
  const [editOptions,setEditOptions]=useState('');
  const [editCategory,setEditCategory]=useState('');
  const [editRequired,setEditRequired]=useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const query=courseId==='global'?'':'?course_id='+encodeURIComponent(courseId);
      const response=await fetch('/api/questions'+query,{cache:'no-store'});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error??'Questions could not be loaded.');
      setQuestions((body.questions??[]).filter((q:Question)=>q.feedback_id===null && (courseId==='global'?q.course_id===null:q.course_id===courseId||q.course_id===null)));
    } catch(e) { setError(e instanceof Error?e.message:'Questions could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[courseId]);

  async function persist(id:string,patch:Partial<Question>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response=await fetch('/api/questions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...patch})});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error??'Question update failed.');
      setNotice('Question updated. Active feedback forms have been refreshed.');
      await load();
    } catch(e) { setError(e instanceof Error?e.message:'Question update failed.'); }
    finally { setBusy(false); }
  }

  async function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const needsOptions=['single_choice','multiple_choice','multiple_select'].includes(type);
    const parsedOptions=needsOptions?options.split(',').map(x=>x.trim()).filter(Boolean):[];
    if(needsOptions && parsedOptions.length<2) {setError('Choice questions need at least two options.');setBusy(false);return;}
    try {
      const response=await fetch('/api/questions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        course_id:courseId==='global'?null:courseId,feedback_id:null,label,type,order_index:questions.length,
        is_active:true,is_required:required,options:parsedOptions,category
      })});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error??'Question could not be created.');
      setLabel('');setOptions('Excellent, Good, Fair, Needs improvement');setNotice('Question added. Feedback forms have been refreshed.');
      await load();
    } catch(e) { setError(e instanceof Error?e.message:'Question could not be created.'); }
    finally { setBusy(false); }
  }

  function beginEdit(question:Question) {
    setEditingId(question.id);setEditLabel(question.label);setEditType(question.type);
    setEditOptions((question.options??[]).join(', '));setEditCategory(question.category??'');
    setEditRequired(question.is_required);
  }

  async function saveEdit(id:string) {
    setBusy(true);setError('');setNotice('');
    const needsOptions=['single_choice','multiple_choice','multiple_select'].includes(editType);
    const parsedOptions=needsOptions?editOptions.split(',').map(x=>x.trim()).filter(Boolean):[];
    if(needsOptions&&parsedOptions.length<2){setError('Choice questions need at least two options.');setBusy(false);return;}
    try {
      const response=await fetch('/api/questions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        id,label:editLabel,type:editType,options:parsedOptions,category:editCategory||null,is_required:editRequired
      })});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Question update failed.');
      setEditingId(null);setNotice('Question updated and active forms refreshed.');await load();
    } catch(e){setError(e instanceof Error?e.message:'Question update failed.');}
    finally{setBusy(false);}
  }

  async function moveQuestion(index:number,offset:number) {
    const nextIndex=index+offset;
    if(nextIndex<0||nextIndex>=questions.length)return;
    const current=questions[index],next=questions[nextIndex];
    setBusy(true);setError('');setNotice('');
    try {
      const first=await fetch('/api/questions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:current.id,order_index:next.order_index})});
      const firstBody=await first.json();if(!first.ok)throw new Error(firstBody.error??'Question order could not be updated.');
      const second=await fetch('/api/questions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:next.id,order_index:current.order_index})});
      const secondBody=await second.json();if(!second.ok)throw new Error(secondBody.error??'Question order could not be updated.');
      setNotice('Question order saved and feedback forms refreshed.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Question order could not be updated.');await load();}
    finally{setBusy(false);}
  }

  async function remove(question:Question) {
    if(!window.confirm('Delete this question? Existing answer records are not changed.')) return;
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/questions?id='+encodeURIComponent(question.id),{method:'DELETE'});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error??'Question could not be deleted.');
      setNotice('Question deleted. Active feedback forms have been refreshed.');
      await load();
    } catch(e) { setError(e instanceof Error?e.message:'Question could not be deleted.');}
    finally {setBusy(false);}
  }

  return <section className="space-y-5">
    <div className="section-heading"><div><h3>Manage Questions</h3><p>Create global or course-specific rating criteria and comment prompts. Form-specific questions continue to override shared questions.</p></div><button className="button subtle compact" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {error&&<p className="alert error" role="alert">{error}</p>}{notice&&<p className="alert success" role="status">{notice}</p>}
    <div className="rounded-2xl border border-[#e5ece6] bg-white p-5">
      <label className="block text-sm font-semibold">Question scope<select className="mt-2 w-full rounded-xl border border-[#dce6de] bg-white p-3" value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="global">Global questions · all courses</option>{courses.map(course=><option key={course.id} value={course.id}>{course.course_code?course.course_code+' · ':''}{course.title}</option>)}</select></label>
      <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={add}>
        <label className="text-sm font-semibold md:col-span-2">Question text<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={label} onChange={e=>setLabel(e.target.value)} minLength={2} maxLength={180} required placeholder="e.g. How clear were the lesson explanations?"/></label>
        <label className="text-sm font-semibold">Answer type<select className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={type} onChange={e=>setType(e.target.value as Question['type'])}>{types.map(value=><option key={value} value={value}>{value==='rating'?'Rating · 1–5':value==='text'?'Short comment':value==='textarea'?'Long comment':value.replaceAll('_',' ')}</option>)}</select></label>
        <label className="text-sm font-semibold">Category<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={category} onChange={e=>setCategory(e.target.value)} maxLength={80}/></label>
        {['single_choice','multiple_choice','multiple_select'].includes(type)&&<label className="text-sm font-semibold md:col-span-2">Options, separated by commas<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={options} onChange={e=>setOptions(e.target.value)}/></label>}
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> Required for submission</label>
        <div className="md:col-span-2"><button className="button primary" disabled={busy}><Plus size={15}/> Add question</button></div>
      </form>
    </div>
    <div className="rounded-2xl border border-[#e5ece6] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h4 className="font-semibold">Question catalogue</h4><span className="role-chip">{questions.length} questions</span></div>
      {loading?<p className="muted">Loading questions…</p>:questions.length===0?<p className="muted">No shared questions in this scope yet.</p>:<div className="space-y-3">{questions.map((question,index)=><article key={question.id} className="rounded-xl border border-[#e5ece6] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{index+1}. {question.label}</b><span className="role-chip">{question.type==='rating'?'1–5 rating':question.type.replaceAll('_',' ')}</span><span className={'status-badge '+(question.is_active?'published':'archived')}>{question.is_active?'active':'inactive'}</span></div><small className="muted">{question.category??'Uncategorized'} · {question.is_required?'Required':'Optional'}{question.options?.length?' · '+question.options.join(', '):''}</small></div>
          <div className="flex flex-wrap items-center gap-1">
            <button className="icon-button" title="Move up" aria-label={'Move '+question.label+' up'} disabled={busy||index===0} onClick={()=>void moveQuestion(index,-1)}><ArrowUp size={15}/></button>
            <button className="icon-button" title="Move down" aria-label={'Move '+question.label+' down'} disabled={busy||index===questions.length-1} onClick={()=>void moveQuestion(index,1)}><ArrowDown size={15}/></button>
            <button className="button subtle compact" disabled={busy} onClick={()=>void persist(question.id,{is_active:!question.is_active})}>{question.is_active?'Deactivate':'Activate'}</button>
            <button className="button subtle compact" disabled={busy} onClick={()=>beginEdit(question)}><Pencil size={13}/> Edit</button>
            <button className="icon-button" title="Delete question" aria-label={'Delete '+question.label} disabled={busy} onClick={()=>void remove(question)}><Trash2 size={15}/></button>
          </div>
        </div>
        {editingId===question.id&&<div className="mt-4 grid gap-3 rounded-xl bg-[#f7faf7] p-4 md:grid-cols-2">
          <label className="text-sm font-semibold md:col-span-2">Question text<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={editLabel} onChange={e=>setEditLabel(e.target.value)} minLength={2} maxLength={180}/></label>
          <label className="text-sm font-semibold">Answer type<select className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={editType} onChange={e=>setEditType(e.target.value as Question['type'])}>{types.map(value=><option key={value} value={value}>{value==='rating'?'Rating · 1–5':value.replaceAll('_',' ')}</option>)}</select></label>
          <label className="text-sm font-semibold">Category<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={editCategory} onChange={e=>setEditCategory(e.target.value)} maxLength={80}/></label>
          {['single_choice','multiple_choice','multiple_select'].includes(editType)&&<label className="text-sm font-semibold md:col-span-2">Options<input className="mt-2 w-full rounded-xl border border-[#dce6de] p-3 font-normal" value={editOptions} onChange={e=>setEditOptions(e.target.value)} placeholder="Option 1, Option 2"/></label>}
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={editRequired} onChange={e=>setEditRequired(e.target.checked)}/> Required question</label>
          <div className="flex gap-2 md:col-span-2"><button type="button" className="button primary compact" disabled={busy} onClick={()=>void saveEdit(question.id)}><Save size={14}/> Save question</button><button type="button" className="button subtle compact" onClick={()=>setEditingId(null)}><X size={14}/> Cancel</button></div>
        </div>}
      </article>)}</div>}
    </div>
  </section>;
}
