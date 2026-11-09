'use client';

import { FormEvent, useEffect, useState } from 'react';
import { MessageSquarePlus, RefreshCw, Send, ShieldCheck } from 'lucide-react';

type CourseOption = { id: string; title: string; course_code?: string | null };
type Suggestion = {
  id: string;
  category: string;
  title: string;
  details: string;
  course_id: string | null;
  status: 'RECEIVED' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'RESOLVED';
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

const categories = [
  ['INFRASTRUCTURE','Infrastructure'],
  ['CANTEEN','Canteen'],
  ['LIBRARY','Library'],
  ['TEACHING_QUALITY','Teaching quality'],
  ['LABS','Laboratories'],
  ['OTHER','Other']
];

const statusLabel: Record<Suggestion['status'], string> = {
  RECEIVED: 'Received',
  UNDER_REVIEW: 'Under review',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved'
};

export function StudentVoice({ courses }: { courses: CourseOption[] }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [category, setCategory] = useState('INFRASTRUCTURE');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/student-voice', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Student Voice could not be loaded.');
      setSuggestions(payload.suggestions ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Student Voice could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/student-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, details, course_id: courseId || null })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Suggestion could not be submitted.');
      setTitle('');
      setDetails('');
      setCourseId('');
      setNotice('Your suggestion has been sent to the College Head.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suggestion could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-5" aria-labelledby="student-voice-title">
    <div className="section-heading">
      <div><h3 id="student-voice-title">Student Voice</h3><p>Share an idea or raise an issue about your college experience.</p></div>
      <MessageSquarePlus size={23}/>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-[#dce8df] bg-[#f7faf7] p-4 text-sm text-[#52685a]">
      <ShieldCheck size={18} className="mt-0.5 shrink-0"/>
      <p>Student Voice is a separate, identified suggestion channel. The College Head can see who submitted it so they can follow up. This is not anonymous course feedback; your anonymous teaching ratings remain separate.</p>
    </div>
    <form className="stack-form rounded-2xl border border-[#e5ece6] bg-white p-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Category<select value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Related course (optional)<select value={courseId} onChange={event=>setCourseId(event.target.value)}><option value="">College-wide suggestion</option>{courses.map(course=><option key={course.id} value={course.id}>{course.course_code ? course.course_code+' · ' : ''}{course.title}</option>)}</select></label>
      </div>
      <label>Subject<input value={title} onChange={event=>setTitle(event.target.value)} minLength={4} maxLength={140} required placeholder="e.g. Improve the computer lab schedule"/></label>
      <label>Suggestion or issue<textarea value={details} onChange={event=>setDetails(event.target.value)} minLength={10} maxLength={4000} rows={5} required placeholder="Describe what is happening and what change would help…"/></label>
      <button className="button primary self-start" disabled={busy}>{busy?'Sending…':<><Send size={15}/> Submit to College Head</>}</button>
    </form>
    {error&&<p className="alert error" role="alert">{error}</p>}
    {notice&&<p className="alert success" role="status">{notice}</p>}
    <div className="section-heading"><div><h4>My suggestions</h4><p>Track each suggestion as the college reviews it.</p></div><button className="button subtle compact" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {loading?<p className="fine-print">Loading suggestions…</p>:suggestions.length===0?<p className="rounded-xl border border-dashed border-[#dce7df] p-5 text-center text-sm text-[#748279]">You have not submitted a suggestion yet.</p>:<div className="space-y-3">{suggestions.map(item=><article key={item.id} className="rounded-xl border border-[#e5ece6] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="eyebrow">{categories.find(([value])=>value===item.category)?.[1]??item.category}</span><h4 className="mt-1 font-semibold">{item.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm text-[#607066]">{item.details}</p></div><span className="role-chip">{statusLabel[item.status]}</span></div>
      {item.resolution_note&&<p className="mt-3 rounded-lg bg-[#f4f7f4] p-3 text-sm text-[#4e6255]"><b>College update:</b> {item.resolution_note}</p>}
      <small className="fine-print mt-3 block">Submitted {new Date(item.created_at).toLocaleString()} · Updated {new Date(item.updated_at).toLocaleString()}</small>
    </article>)}</div>}
  </section>;
}
