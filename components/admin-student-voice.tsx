'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Save } from 'lucide-react';

type Suggestion = {
  id: string; student_id: string; student_name: string; student_email: string | null;
  category: string; title: string; details: string; course_id: string | null;
  status: 'RECEIVED'|'UNDER_REVIEW'|'IN_PROGRESS'|'RESOLVED';
  resolution_note: string | null; created_at: string; updated_at: string;
};

const labels: Record<Suggestion['status'], string> = {
  RECEIVED: 'Received', UNDER_REVIEW: 'Under review', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved'
};

export function AdminStudentVoice() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [statuses, setStatuses] = useState<Record<string,Suggestion['status']>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/student-voice', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Student Voice could not be loaded.');
      setItems(payload.suggestions ?? []);
      setStatuses(Object.fromEntries((payload.suggestions ?? []).map((item: Suggestion) => [item.id, item.status])));
      setNotes(Object.fromEntries((payload.suggestions ?? []).map((item: Suggestion) => [item.id, item.resolution_note ?? ''])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Student Voice could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function update(item: Suggestion) {
    const status = statuses[item.id];
    const resolution_note = (notes[item.id] ?? '').trim();
    if (!status || status === item.status || resolution_note.length < 2) return;
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/student-voice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: item.id, status, resolution_note })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Suggestion could not be updated.');
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, status, resolution_note, updated_at: payload.suggestion.updated_at } : entry));
      setNotice('Suggestion status updated and action audited.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suggestion could not be updated.');
    } finally {
      setBusyId('');
    }
  }

  return <section className="admin-panel space-y-4" aria-labelledby="admin-student-voice-title">
    <div className="admin-panel-heading"><div><span className="eyebrow">COLLEGE HEAD ONLY</span><h2 id="admin-student-voice-title">Student Voice</h2><p>Review student-submitted college suggestions and record the action taken.</p></div><span className="role-chip"><ClipboardList size={14}/> {items.length} submissions</span></div>
    {error&&<div className="alert error" role="alert">{error}</div>}
    {notice&&<div className="alert success" role="status">{notice}</div>}
    <div className="flex justify-end"><button className="button subtle compact" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    {loading?<p className="fine-print">Loading suggestions…</p>:items.length===0?<p className="admin-empty-state">No student suggestions have been submitted yet.</p>:<div className="space-y-3">{items.map(item=>{
      const allowed: Suggestion['status'][] = item.status==='RECEIVED'?['UNDER_REVIEW']:item.status==='UNDER_REVIEW'?['IN_PROGRESS','RESOLVED']:item.status==='IN_PROGRESS'?['UNDER_REVIEW','RESOLVED']:[];
      return <article key={item.id} className="rounded-xl border border-[#e5ece6] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="eyebrow">{item.category.replace('_',' ')}</span><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5e6f65]">{item.details}</p><small className="fine-print mt-2 block">From {item.student_name} · {item.student_email??'No email'} · {new Date(item.created_at).toLocaleString()}</small></div><span className="role-chip">{labels[item.status]}</span></div>
        {allowed.length>0?<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"><label>Next status<select value={statuses[item.id]??item.status} onChange={event=>setStatuses(current=>({...current,[item.id]:event.target.value as Suggestion['status']}))}><option value={item.status}>{labels[item.status]}</option>{allowed.map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label><label>Resolution note<textarea rows={2} maxLength={1000} value={notes[item.id]??''} onChange={event=>setNotes(current=>({...current,[item.id]:event.target.value}))} placeholder="Explain the next action or resolution…"/></label><button className="button primary compact" disabled={busyId===item.id||(statuses[item.id]??item.status)===item.status||(notes[item.id]??'').trim().length<2} onClick={()=>void update(item)}>{busyId===item.id?'Saving…':<><Save size={14}/> Save</>}</button></div>:item.resolution_note&&<p className="mt-3 rounded-lg bg-[#f4f7f4] p-3 text-sm text-[#52685a]"><b>Resolution:</b> {item.resolution_note}</p>}
      </article>;
    })}</div>}
  </section>;
}
